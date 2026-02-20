/**
 * URL → Blob 转换工具
 *
 * 提供跨平台兼容的 data URL / blob URL 转 Blob 方法。
 * - data URL: 使用 atob + Uint8Array 分片解码，不依赖 fetch(dataUrl)
 *   （部分 WebView / 移动端浏览器不支持 fetch data URI）。
 * - blob URL: 通过 XMLHttpRequest 读取（兼容性优于 fetch blob:）。
 * - http(s) URL: 使用 fetch。
 */

const SLICE_SIZE = 512 * 1024; // 512KB per slice, avoids call stack overflow on large files

/**
 * 将 data URL (data:mime;base64,...) 转为 Blob。
 * 先一次性 atob 解码，再分片构建 Uint8Array，避免对大文件重复解码。
 */
export function dataUrlToBlob(dataUrl: string): Blob {
	const commaIndex = dataUrl.indexOf(',');
	if (commaIndex === -1) throw new Error('Invalid data URL');

	const header = dataUrl.slice(0, commaIndex);
	const b64 = dataUrl.slice(commaIndex + 1);

	const mimeMatch = header.match(/^data:([^;,]+)/);
	const mime = mimeMatch?.[1] ?? '';

	const bin = atob(b64);
	const len = bin.length;
	const slices: BlobPart[] = [];

	for (let offset = 0; offset < len; offset += SLICE_SIZE) {
		const end = Math.min(offset + SLICE_SIZE, len);
		const bytes = new Uint8Array(end - offset);
		for (let i = offset; i < end; i++) {
			bytes[i - offset] = bin.charCodeAt(i);
		}
		slices.push(bytes);
	}

	return new Blob(slices, { type: mime });
}

/**
 * 将 blob:// URL 转为 Blob（使用 XMLHttpRequest，兼容性优于 fetch）。
 */
function blobUrlToBlob(blobUrl: string): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('GET', blobUrl, true);
		xhr.responseType = 'blob';
		xhr.onload = () => {
			if (xhr.status === 200) resolve(xhr.response as Blob);
			else reject(new Error(`XHR failed for blob URL: ${xhr.status}`));
		};
		xhr.onerror = () => reject(new Error('XHR network error for blob URL'));
		xhr.send();
	});
}

/**
 * 将任意 URL（data: / blob: / http(s):）转为 Blob。
 */
export async function urlToBlob(url: string): Promise<Blob> {
	if (url.startsWith('data:')) {
		return dataUrlToBlob(url);
	}

	if (url.startsWith('blob:')) {
		return blobUrlToBlob(url);
	}

	if (url.startsWith('http://') || url.startsWith('https://')) {
		const response = await fetch(url);
		return response.blob();
	}

	throw new Error(`Unsupported URL scheme: ${url.slice(0, 20)}`);
}
