/**
 * 多媒体资源提取工具
 *
 * 从 AI 生成结果中提取多媒体资源（图片/视频/音频），
 * 统一上传到 R2 并返回 public URL。
 *
 * 提取优先级：
 * 1. AI SDK GeneratedFile（base64）
 * 2. AI SDK ContentPart file 类型
 * 3. Provider 响应体中的图片（OpenRouter/Gemini 格式）
 * 4. 文本中的 inline base64 data URI
 * 5. Markdown 图片语法 ![alt](url)
 * 6. HTML 媒体标签 <img>/<video>/<audio>
 * 7. 纯文本中的媒体文件 URL
 */

import type { ContentPart, GeneratedFile, ToolSet } from 'ai';
import { uploadMediaToR2 } from '$lib/server/upload-media';
import { createLogger } from '$lib/server/logger';

const log = createLogger('media-extractor');

// ─── 类型 ───

export interface MediaResource {
	type: 'image' | 'video' | 'audio' | 'file' | 'url';
	data: string;
	mimeType?: string;
	filename?: string;
	isBase64?: boolean;
}

export interface ExtractMediaOptions {
	text: string;
	files?: GeneratedFile[];
	content?: ContentPart<ToolSet>[];
	responseBody?: unknown;
}

export interface ExtractMediaResult {
	text: string;
	resources: MediaResource[];
}

// ─── 工具函数 ───

export function getMediaType(mimeType?: string): MediaResource['type'] {
	if (!mimeType) return 'file';
	if (mimeType.startsWith('image/')) return 'image';
	if (mimeType.startsWith('video/')) return 'video';
	if (mimeType.startsWith('audio/')) return 'audio';
	return 'file';
}

async function downloadAndUploadToR2(
	url: string,
	timeout = 10000,
): Promise<{ data: string; mimeType: string }> {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		const response = await fetch(url, {
			signal: controller.signal,
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; MediaExtractor/1.0)',
			},
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			log.error(`下载资源失败: ${url}`, undefined, { status: response.status });
			return { data: url, mimeType: 'application/octet-stream' };
		}

		const mimeType = response.headers.get('content-type') || 'application/octet-stream';

		const contentLength = response.headers.get('content-length');
		if (contentLength && parseInt(contentLength) > 20 * 1024 * 1024) {
			log.error(`资源过大: ${url}`, undefined, { size: contentLength });
			return { data: url, mimeType: 'application/octet-stream' };
		}

		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		const publicUrl = await uploadMediaToR2(buffer, mimeType);
		return { data: publicUrl, mimeType };
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			log.error(`下载资源超时: ${url}`);
		} else {
			log.error(`下载资源异常: ${url}`, error instanceof Error ? error : undefined);
		}
		return { data: url, mimeType: 'application/octet-stream' };
	}
}

// ─── 核心提取函数 ───

export async function extractMediaResources(
	opts: ExtractMediaOptions,
): Promise<ExtractMediaResult> {
	const { files, content, responseBody } = opts;
	let { text } = opts;
	const resources: MediaResource[] = [];

	// 1. AI SDK GeneratedFile
	if (files && files.length > 0) {
		for (const file of files) {
			try {
				const buffer = Buffer.from(file.base64, 'base64');
				const url = await uploadMediaToR2(buffer, file.mediaType);
				resources.push({
					type: getMediaType(file.mediaType),
					data: url,
					mimeType: file.mediaType,
					filename: 'generated-image',
				});
			} catch (err) {
				log.error('R2 upload failed for generated file', err instanceof Error ? err : undefined);
			}
		}
	}

	if (resources.length > 0) return { text, resources };

	// 2. AI SDK ContentPart file 类型
	if (content && content.length > 0) {
		for (const part of content) {
			if (part.type === 'file') {
				try {
					const buffer = Buffer.from(part.file.base64, 'base64');
					const url = await uploadMediaToR2(buffer, part.file.mediaType);
					resources.push({
						type: getMediaType(part.file.mediaType),
						data: url,
						mimeType: part.file.mediaType,
						filename: 'generated-image',
					});
				} catch (err) {
					log.error('R2 upload failed for content part', err instanceof Error ? err : undefined);
				}
			}
		}
	}

	if (resources.length > 0) return { text, resources };

	// 2.5 Provider 响应体中的图片
	try {
		const body = responseBody as Record<string, unknown> | undefined;
		const choicesImageURLs =
			(body?.choices as Array<Record<string, unknown>>)
				?.flatMap((choice) =>
					(
						(choice?.message as Record<string, unknown>)?.images as Array<
							Record<string, unknown>
						>
					)?.map(
						(img) =>
							((img?.image_url as Record<string, unknown>)?.url as string) || '',
					),
				)
				?.filter((url) => url && url.length > 0) || [];

		for (const imageUrl of choicesImageURLs) {
			const dataMatch = imageUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/s);
			if (dataMatch) {
				const [, mimeType, b64] = dataMatch;
				try {
					const buffer = Buffer.from(b64, 'base64');
					const url = await uploadMediaToR2(buffer, mimeType);
					resources.push({
						type: getMediaType(mimeType),
						data: url,
						mimeType,
						filename: 'generated-image',
					});
				} catch (err) {
					log.error(
						'R2 upload failed for response.body image',
						err instanceof Error ? err : undefined,
					);
				}
			} else if (imageUrl.startsWith('http')) {
				const result = await downloadAndUploadToR2(imageUrl);
				resources.push({
					type: getMediaType(result.mimeType),
					data: result.data,
					mimeType: result.mimeType,
					filename: 'generated-image',
				});
			}
		}
	} catch {
		// provider 响应格式不匹配，忽略
	}

	if (resources.length > 0) return { text, resources };

	// 文本中的 URL → R2 URL 替换映射
	const urlReplacements = new Map<string, string>();
	const pendingDownloads: Array<{ url: string; filename?: string }> = [];

	// 3. Inline base64 data URI
	const base64Regex =
		/data:(image|video|audio)\/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)/g;
	let match;
	while ((match = base64Regex.exec(text)) !== null) {
		const [fullMatch, mediaType, format, b64] = match;
		const mimeType = `${mediaType}/${format}`;
		try {
			const buffer = Buffer.from(b64, 'base64');
			const url = await uploadMediaToR2(buffer, mimeType);
			resources.push({
				type: mediaType as 'image' | 'video' | 'audio',
				data: url,
				mimeType,
			});
			urlReplacements.set(fullMatch, url);
		} catch (err) {
			log.error('R2 upload failed for inline base64', err instanceof Error ? err : undefined);
		}
	}

	// 4. Markdown 图片语法
	const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
	while ((match = markdownImageRegex.exec(text)) !== null) {
		const [, alt, url] = match;
		if (url && !url.startsWith('data:')) {
			pendingDownloads.push({ url, filename: alt || undefined });
		}
	}

	// 5. HTML 媒体标签
	const htmlMediaRegex = /<(img|video|audio|source)[^>]+src=["']([^"']+)["'][^>]*>/gi;
	while ((match = htmlMediaRegex.exec(text)) !== null) {
		const [fullMatch, , url] = match;
		if (url && !url.startsWith('data:')) {
			const altMatch = fullMatch.match(/(?:alt|title)=["']([^"']+)["']/i);
			pendingDownloads.push({ url, filename: altMatch?.[1] });
		}
	}

	// 6. 纯文本中的媒体 URL
	const urlRegex =
		/https?:\/\/[^\s<>"{}|\\^`\[\]]+\.(jpg|jpeg|png|gif|webp|mp4|webm|mp3|wav|pdf|doc|docx)/gi;
	const urls = text.match(urlRegex);
	if (urls) {
		for (const url of urls) {
			pendingDownloads.push({ url });
		}
	}

	// 去重下载
	if (pendingDownloads.length > 0) {
		const urlMap = new Map<string, string | undefined>();
		for (const d of pendingDownloads) {
			if (!urlMap.has(d.url)) {
				urlMap.set(d.url, d.filename);
			}
		}

		const downloadResults = await Promise.all(
			[...urlMap.entries()].map(async ([url, filename]) => {
				const result = await downloadAndUploadToR2(url, 60*1000);
				urlReplacements.set(url, result.data);
				return {
					type: getMediaType(result.mimeType),
					data: result.data,
					mimeType: result.mimeType,
					filename,
				} as MediaResource;
			}),
		);

		resources.push(...downloadResults);
	}

	// 替换文本中的原始引用为 R2 URL
	for (const [original, r2Url] of urlReplacements) {
		text = text.replaceAll(original, r2Url);
	}

	return { text, resources };
}
