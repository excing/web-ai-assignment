import { CHAT_ATTACHMENTS } from '$lib/config/constants';

/**
 * 将图片文件压缩到指定大小限制以内。
 * 利用 Canvas 重绘 + 逐步降低质量/缩小尺寸的策略。
 *
 * - 如果文件已经在限制内，直接返回原文件。
 * - GIF 不做压缩（Canvas 无法保留动画帧），超限则拒绝。
 * - 输出格式统一为 image/jpeg（PNG/WebP 也转为 JPEG 以获得更好的压缩率）。
 */
export async function compressImage(
	file: File,
	maxSize: number = CHAT_ATTACHMENTS.MAX_FILE_SIZE
): Promise<File> {
	// 已经在限制内，直接返回
	if (file.size <= maxSize) return file;

	// GIF 不支持压缩（会丢失动画）
	if (file.type === 'image/gif') {
		throw new Error(`GIF 文件过大（${formatSize(file.size)}），无法自动压缩，请手动裁剪后重试`);
	}

	const img = await loadImage(file);

	// 策略：先尝试降低质量，再尝试缩小尺寸
	let quality = 0.9;
	const minQuality = 0.3;
	let scale = 1;
	const minScale = 0.25;

	while (true) {
		const blob = await drawToBlob(img, scale, quality);

		if (blob.size <= maxSize) {
			return new File([blob], replaceExtension(file.name, 'jpg'), {
				type: 'image/jpeg',
				lastModified: Date.now()
			});
		}

		// 先降低质量
		if (quality > minQuality) {
			quality = Math.max(quality - 0.1, minQuality);
			continue;
		}

		// 质量已到最低，开始缩小尺寸
		if (scale > minScale) {
			scale = Math.max(scale - 0.1, minScale);
			quality = 0.7; // 重置质量到中等
			continue;
		}

		// 都到最低了仍然超限，返回最终结果（极端情况）
		return new File([blob], replaceExtension(file.name, 'jpg'), {
			type: 'image/jpeg',
			lastModified: Date.now()
		});
	}
}

function loadImage(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(img.src);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(img.src);
			reject(new Error('图片加载失败'));
		};
		img.src = URL.createObjectURL(file);
	});
}

function drawToBlob(
	img: HTMLImageElement,
	scale: number,
	quality: number
): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(img.naturalWidth * scale);
		canvas.height = Math.round(img.naturalHeight * scale);

		const ctx = canvas.getContext('2d');
		if (!ctx) {
			reject(new Error('无法创建 Canvas 上下文'));
			return;
		}

		ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
		canvas.toBlob(
			(blob) => {
				if (blob) resolve(blob);
				else reject(new Error('Canvas toBlob 失败'));
			},
			'image/jpeg',
			quality
		);
	});
}

function replaceExtension(filename: string, ext: string): string {
	const dotIndex = filename.lastIndexOf('.');
	if (dotIndex === -1) return `${filename}.${ext}`;
	return `${filename.substring(0, dotIndex)}.${ext}`;
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
