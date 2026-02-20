/**
 * 多媒体资源类型（跨功能共享）
 *
 * 由 image-gen、image-gallery、chat 等模块共同使用。
 */

export interface MediaResource {
	type: 'image' | 'video' | 'audio' | 'file' | 'url';
	data: string;
	mimeType?: string;
	filename?: string;
	isBase64?: boolean;
}
