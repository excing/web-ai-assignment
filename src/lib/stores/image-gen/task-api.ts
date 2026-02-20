/**
 * Image Gen Task API — 纯 API 调用层
 *
 * 职责：构建请求体、发送 POST /api/image-gen、返回结果。
 * 不涉及状态管理或持久化。
 */

import type { MediaResource } from '$lib/types/media';
import type { AspectRatio } from '$lib/config/constants';
import { compositeImages } from '$lib/utils/image-composite';

function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

export async function callImageGenApi(
	prompt: string,
	files?: File[],
	aspectRatio?: AspectRatio,
	featureKey?: string,
): Promise<MediaResource[]> {
	const parts: Array<Record<string, unknown>> = [];

	if (prompt) {
		parts.push({ type: 'text', text: prompt });
	}

	if (files && files.length > 0) {
		const composited = await compositeImages(files, aspectRatio);
		const dataUrl = await fileToDataUrl(composited);
		parts.push({
			type: 'file',
			mediaType: composited.type,
			filename: composited.name,
			url: dataUrl,
		});
	}

	if (parts.length === 0) {
		parts.push({ type: 'text', text: '生成一张图片' });
	}

	const res = await fetch('/api/image-gen', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			messages: [{ role: 'user', parts }],
			featureKey,
		}),
	});

	if (!res.ok) {
		const error = await res.json();
		throw new Error(error.error || '请求失败');
	}

	const result = await res.json();
	return result.mediaResources || [];
}
