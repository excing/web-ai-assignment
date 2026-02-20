import { convertToModelMessages } from 'ai';
import type { ContentPart, GeneratedFile, ToolSet, UIMessage } from 'ai';
import { BaseAIService } from './base-ai-service';
import { createLogger } from '$lib/server/logger';

const log = createLogger('image-generation-service');

/**
 * 图片生成服务配置选项
 */
export interface ImageGenerationServiceOptions {
	/** AI 功能特性名称（用于获取对应的 Proxy 配置） */
	feature?: string;
	/** 最大输出 token 数 */
	maxOutputTokens?: number;
	/** 推理标签名称（用于提取 <think> 等标签内容） */
	reasoningTagName?: string;
	/** 温度参数（0-2，控制随机性） */
	temperature?: number;
	/** Top P 参数（0-1，控制多样性） */
	topP?: number;
	/** 用户 ID（用于计费，不传则不计费） */
	userId?: string;
}

/**
 * 图片生成请求参数
 */
export interface ImageGenerationRequest {
	/** UI 消息列表（包含 parts） */
	messages: Array<Omit<UIMessage, 'id'>>;
}

/**
 * 多媒体资源类型
 */
export interface MediaResource {
	/** 资源类型 */
	type: 'image' | 'video' | 'audio' | 'file' | 'url';
	/** 资源 URL 或 Base64 数据 */
	data: string;
	/** MIME 类型 */
	mimeType?: string;
	/** 文件名 */
	filename?: string;
	/** 是否为 Base64 编码 */
	isBase64?: boolean;
}

/**
 * 图片生成响应
 */
export interface ImageGenerationResponse {
	/** 生成的文本内容 */
	text: string;
	/** 完成原因 */
	finishReason: string;
	/** Token 使用情况 */
	usage: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	/** 推理内容（如果有） */
	reasoning?: string;
	/** 提取的多媒体资源 */
	mediaResources: MediaResource[];
}

/**
 * 图片生成服务核心类
 * 负责处理非流式 AI 图片生成的核心业务逻辑，可在多个场景复用
 */
export class ImageGenerationService {
	private base: BaseAIService;
	private maxOutputTokens: number;
	private temperature?: number;
	private topP?: number;

	constructor(private options: ImageGenerationServiceOptions = {}) {
		this.base = new BaseAIService({
			feature: options.feature || 'image-generation',
			userId: options.userId,
			reasoningTagName: options.reasoningTagName,
		});
		this.maxOutputTokens = options.maxOutputTokens ?? 4096;
		this.temperature = options.temperature;
		this.topP = options.topP;
	}

	/**
	 * 将 UI 消息转换为模型消息
	 */
	async convertMessages(messages: Array<Omit<UIMessage, 'id'>>) {
		return await convertToModelMessages(messages);
	}

	/**
	 * 下载 HTTP 资源并转换为 Base64
	 */
	private async downloadAndConvertToBase64(
		url: string,
		timeout = 10000
	): Promise<{ data: string; mimeType: string } | null> {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeout);

			const response = await fetch(url, {
				signal: controller.signal,
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; ImageGenerationService/1.0)'
				}
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				log.error(`下载资源失败: ${url}`, undefined, { status: response.status });
				return null;
			}

			// 获取 MIME 类型
			const mimeType = response.headers.get('content-type') || 'application/octet-stream';

			// 检查文件大小（限制 20MB）
			const contentLength = response.headers.get('content-length');
			if (contentLength && parseInt(contentLength) > 20 * 1024 * 1024) {
				log.error(`资源过大: ${url}`, undefined, { size: contentLength });
				return null;
			}

			// 下载到内存
			const arrayBuffer = await response.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);

			// 转换为 Base64
			const base64 = buffer.toString('base64');
			const dataUrl = `data:${mimeType};base64,${base64}`;

			return { data: dataUrl, mimeType };
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				log.error(`下载资源超时: ${url}`);
			} else {
				log.error(`下载资源异常: ${url}`, error instanceof Error ? error : undefined);
			}
			return null;
		}
	}

	/**
	 * 提取文本中的多媒体资源
	 */
	private async extractMediaResources(text: string, files: Array<GeneratedFile>, content: Array<ContentPart<ToolSet>>): Promise<MediaResource[]> {
		const resources: MediaResource[] = [];

		// 1. 提取生成的文件（来自 AI SDK）
		if (files && files.length > 0) {
			for (const file of files) {
				log.info(`file: ${file.mediaType}`);
				resources.push({
					type: this.getMediaType(file.mediaType),
					data: `data:${file.mediaType};base64,${file.base64}`,
					mimeType: file.mediaType,
					filename: "generated-image",
					isBase64: true
				});
			}
		}

		if (resources.length > 0) return resources;

		// 2. 从 content 中提取多媒体内容
		if (content && content.length > 0) {
			for (const part of content) {
				log.info(`content part: ${part.type}`);
				if (part.type === 'file') {
					resources.push({
						type: part.type,
						data: `data:${part.file.mediaType};base64,${part.file.base64}`,
						mimeType: part.file.mediaType,
						filename: "generated-image",
						isBase64: true
					});
				}
			}
		}

		if (resources.length > 0) return resources;

		// 收集所有需要下载的 URL 及其元数据，最后统一去重下载
		const pendingDownloads: Array<{ url: string; filename?: string }> = [];

		// 3. 提取 Base64 编码的图片（data:image/...;base64,...）
		const base64Regex = /data:(image|video|audio)\/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)/g;
		let match;
		while ((match = base64Regex.exec(text)) !== null) {
			const [fullMatch, mediaType, format] = match;
			log.info(`found base64 ${mediaType}`);
			resources.push({
				type: mediaType as 'image' | 'video' | 'audio',
				data: fullMatch,
				mimeType: `${mediaType}/${format}`,
				isBase64: true
			});
		}

		// 4. 提取 Markdown 图片语法中的 URL
		const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
		while ((match = markdownImageRegex.exec(text)) !== null) {
			const [, alt, url] = match;
			if (url && !url.startsWith('data:')) {
				pendingDownloads.push({ url, filename: alt || undefined });
			}
		}

		// 5. 提取 HTML 标签中的媒体资源（<img>, <video>, <audio>）
		const htmlMediaRegex = /<(img|video|audio|source)[^>]+src=["']([^"']+)["'][^>]*>/gi;
		while ((match = htmlMediaRegex.exec(text)) !== null) {
			const [fullMatch, , url] = match;
			if (url && !url.startsWith('data:')) {
				const altMatch = fullMatch.match(/(?:alt|title)=["']([^"']+)["']/i);
				pendingDownloads.push({ url, filename: altMatch?.[1] });
			}
		}

		// 6. 使用正则提取文本中的 URL 链接
		const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+\.(jpg|jpeg|png|gif|webp|mp4|webm|mp3|wav|pdf|doc|docx)/gi;
		const urls = text.match(urlRegex);
		if (urls) {
			for (const url of urls) {
				pendingDownloads.push({ url });
			}
		}

		// 统一去重下载：相同 URL 只下载一次，type 由响应 mimeType 决定
		if (pendingDownloads.length > 0) {
			// 去重 URL，保留第一次出现的 filename
			const urlMap = new Map<string, string | undefined>();
			for (const d of pendingDownloads) {
				if (!urlMap.has(d.url)) {
					urlMap.set(d.url, d.filename);
				}
			}

			log.info(`downloading ${urlMap.size} unique URLs (from ${pendingDownloads.length} references)`);

			const downloadResults = await Promise.all(
				[...urlMap.entries()].map(async ([url, filename]) => {
					log.info(`downloading: ${url}`);
					const result = await this.downloadAndConvertToBase64(url);
					if (result) {
						return {
							type: this.getMediaType(result.mimeType),
							data: result.data,
							mimeType: result.mimeType,
							filename,
							isBase64: true
						} as MediaResource;
					}
					return null;
				})
			);

			resources.push(...downloadResults.filter((r): r is MediaResource => r !== null));
		}

		return resources;
	}

	/**
	 * 根据 MIME 类型判断媒体类型
	 */
	private getMediaType(mimeType?: string): MediaResource['type'] {
		if (!mimeType) return 'file';
		if (mimeType.startsWith('image/')) return 'image';
		if (mimeType.startsWith('video/')) return 'video';
		if (mimeType.startsWith('audio/')) return 'audio';
		return 'file';
	}

	/**
	 * 执行非流式图片生成
	 */
	async generateImage(
		modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>
	): Promise<ImageGenerationResponse> {
		const result = await this.base.executeGenerate({
			messages: modelMessages,
			maxOutputTokens: this.maxOutputTokens,
			temperature: this.temperature,
			topP: this.topP,
			billingDescription: '图像生成',
		});

		return {
			text: result.text.replace(/data:(?:image|video|audio)\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/g, '[Base64 File]'), // 替换 Base64 编码的多媒体资源, mediaResources 里已有相同的数据
			finishReason: result.finishReason,
			usage: {
				promptTokens: result.usage.inputTokens || 0,
				completionTokens: result.usage.outputTokens || 0,
				totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0)
			},
			reasoning: result.reasoningText,
			mediaResources: await this.extractMediaResources(
				result.text,
				result.files || [],
				result.content || []
			)
		};
	}

	/**
	 * 便捷方法：处理完整的图片生成请求
	 */
	async handleImageGenerationRequest(
		request: ImageGenerationRequest
	): Promise<ImageGenerationResponse> {
		await this.base.initialize();
		const modelMessages = await this.convertMessages(request.messages);
		return await this.generateImage(modelMessages);
	}
}

/**
 * 创建图片生成服务实例的工厂函数
 */
export function createImageGenerationService(
	options?: ImageGenerationServiceOptions
): ImageGenerationService {
	return new ImageGenerationService(options);
}
