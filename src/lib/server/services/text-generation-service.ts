import {
	generateText,
	convertToModelMessages,
	extractReasoningMiddleware,
	wrapLanguageModel
} from 'ai';
import type { UIMessage } from 'ai';
import {
	getProxyForFeatureWithFallback,
	createModelFromProxy,
	reportAssignmentSuccess,
	reportAssignmentFailure,
	type ProxyConfig
} from '$lib/server/ai-proxy';
import { createLogger } from '$lib/server/logger';

const log = createLogger('text-generation-service');

/**
 * 文本生成服务配置选项
 */
export interface TextGenerationServiceOptions {
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
	/** 计费上下文（可选） */
	billingContext?: {
		usageData?: unknown;
		resolveUsageData: () => void;
	};
}

/**
 * 文本生成请求参数
 */
export interface TextGenerationRequest {
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
 * 文本生成响应
 */
export interface TextGenerationResponse {
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
 * 文本生成服务核心类
 * 负责处理非流式 AI 文本生成的核心业务逻辑，可在多个场景复用
 */
export class TextGenerationService {
	private proxyConfig: ProxyConfig | null = null;

	constructor(private options: TextGenerationServiceOptions = {}) {}

	/**
	 * 初始化服务：获取 Proxy 配置
	 */
	async initialize(): Promise<void> {
		const feature = this.options.feature || 'text-generation';
		this.proxyConfig = await getProxyForFeatureWithFallback(feature);
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
					'User-Agent': 'Mozilla/5.0 (compatible; TextGenerationService/1.0)'
				}
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				log.error(`下载资源失败: ${url}`, undefined, { status: response.status });
				return null;
			}

			// 获取 MIME 类型
			const mimeType = response.headers.get('content-type') || 'application/octet-stream';

			// 检查文件大小（限制 10MB）
			const contentLength = response.headers.get('content-length');
			if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
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
	private async extractMediaResources(text: string, files: Array<any>, content: Array<any>): Promise<MediaResource[]> {
		const resources: MediaResource[] = [];

		// 1. 提取生成的文件（来自 AI SDK）
		if (files && files.length > 0) {
			for (const file of files) {
				resources.push({
					type: this.getMediaType(file.mediaType || file.mimeType),
					data: file.url || file.data,
					mimeType: file.mediaType || file.mimeType,
					filename: file.filename || file.name,
					isBase64: file.url?.startsWith('data:') || false
				});
			}
		}

		// 2. 从 content 中提取多媒体内容
		if (content && content.length > 0) {
			for (const part of content) {
				if (part.type === 'file' || part.type === 'image') {
					resources.push({
						type: this.getMediaType(part.mediaType || part.mimeType),
						data: part.url || part.data,
						mimeType: part.mediaType || part.mimeType,
						filename: part.filename || part.name,
						isBase64: part.url?.startsWith('data:') || false
					});
				}
			}
		}

		// 3. 使用正则提取文本中的 URL 链接
		const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+\.(jpg|jpeg|png|gif|webp|mp4|webm|mp3|wav|pdf|doc|docx)/gi;
		const urls = text.match(urlRegex);
		if (urls) {
			// 并行下载所有 URL
			const downloadPromises = urls.map(async (url) => {
				const result = await this.downloadAndConvertToBase64(url);
				if (result) {
					const ext = url.split('.').pop()?.toLowerCase();
					return {
						type: this.getMediaTypeFromExtension(ext || ''),
						data: result.data,
						mimeType: result.mimeType,
						isBase64: true
					} as MediaResource;
				}
				return null;
			});

			const downloadedResources = await Promise.all(downloadPromises);
			resources.push(...downloadedResources.filter((r): r is MediaResource => r !== null));
		}

		// 4. 提取 Base64 编码的图片（data:image/...;base64,...）
		const base64Regex = /data:(image|video|audio)\/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)/g;
		let match;
		while ((match = base64Regex.exec(text)) !== null) {
			const [fullMatch, mediaType, format, base64Data] = match;
			resources.push({
				type: mediaType as 'image' | 'video' | 'audio',
				data: fullMatch,
				mimeType: `${mediaType}/${format}`,
				isBase64: true
			});
		}

		// 5. 提取 Markdown 图片语法中的 URL
		const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
		const markdownUrls: Array<{ alt: string; url: string }> = [];
		while ((match = markdownImageRegex.exec(text)) !== null) {
			const [, alt, url] = match;
			if (url && !url.startsWith('data:')) {
				markdownUrls.push({ alt, url });
			}
		}

		if (markdownUrls.length > 0) {
			// 并行下载所有 Markdown 图片
			const downloadPromises = markdownUrls.map(async ({ alt, url }) => {
				const result = await this.downloadAndConvertToBase64(url);
				if (result) {
					return {
						type: 'image' as const,
						data: result.data,
						mimeType: result.mimeType,
						filename: alt || undefined,
						isBase64: true
					} as MediaResource;
				}
				return null;
			});

			const downloadedResources = await Promise.all(downloadPromises);
			resources.push(...downloadedResources.filter((r): r is MediaResource => r !== null));
		}

		// 6. 提取 HTML 标签中的媒体资源（<img>, <video>, <audio>）
		const htmlMediaRegex = /<(img|video|audio|source)[^>]+src=["']([^"']+)["'][^>]*>/gi;
		const htmlMediaUrls: Array<{ tag: string; url: string; alt?: string }> = [];
		while ((match = htmlMediaRegex.exec(text)) !== null) {
			const [fullMatch, tag, url] = match;
			if (url && !url.startsWith('data:')) {
				// 尝试提取 alt 或 title 属性
				const altMatch = fullMatch.match(/(?:alt|title)=["']([^"']+)["']/i);
				htmlMediaUrls.push({
					tag: tag.toLowerCase(),
					url,
					alt: altMatch?.[1]
				});
			}
		}

		if (htmlMediaUrls.length > 0) {
			// 并行下载所有 HTML 媒体资源
			const downloadPromises = htmlMediaUrls.map(async ({ tag, url, alt }) => {
				const result = await this.downloadAndConvertToBase64(url);
				if (result) {
					// 根据标签类型判断媒体类型
					let type: MediaResource['type'] = 'file';
					if (tag === 'img') type = 'image';
					else if (tag === 'video' || tag === 'source') type = 'video';
					else if (tag === 'audio') type = 'audio';

					return {
						type,
						data: result.data,
						mimeType: result.mimeType,
						filename: alt || undefined,
						isBase64: true
					} as MediaResource;
				}
				return null;
			});

			const downloadedResources = await Promise.all(downloadPromises);
			resources.push(...downloadedResources.filter((r): r is MediaResource => r !== null));
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
	 * 根据文件扩展名判断媒体类型
	 */
	private getMediaTypeFromExtension(ext: string): MediaResource['type'] {
		const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
		const videoExts = ['mp4', 'webm', 'avi', 'mov', 'mkv'];
		const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'm4a'];

		if (imageExts.includes(ext)) return 'image';
		if (videoExts.includes(ext)) return 'video';
		if (audioExts.includes(ext)) return 'audio';
		return 'file';
	}

	/**
	 * 创建并配置 AI 模型
	 */
	private createModel() {
		if (!this.proxyConfig) {
			throw new Error('TextGenerationService 未初始化，请先调用 initialize()');
		}

		const rawModel = createModelFromProxy(this.proxyConfig);

		// 包装模型，提取推理内容
		return wrapLanguageModel({
			model: rawModel,
			middleware: extractReasoningMiddleware({
				tagName: this.options.reasoningTagName || 'think'
			})
		});
	}

	/**
	 * 执行非流式文本生成
	 * @param modelMessages 已转换的模型消息
	 * @returns 文本生成响应
	 */
	async generateText(
		modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>
	): Promise<TextGenerationResponse> {
		if (!this.proxyConfig) {
			throw new Error('TextGenerationService 未初始化，请先调用 initialize()');
		}

		const model = this.createModel();
		const {
			billingContext,
			maxOutputTokens = 4096,
			temperature,
			topP
		} = this.options;

		try {
			const result = await generateText({
				model,
				messages: modelMessages,
				maxOutputTokens,
				temperature,
				topP
			});

			// 记录 Assignment 请求成功
			await reportAssignmentSuccess(this.proxyConfig.assignmentId);

			// 计费回调
			if (billingContext) {
				billingContext.usageData = result.usage;
				billingContext.resolveUsageData();
			}

			// 构造响应
			return {
				text: result.text,
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
		} catch (error) {
			// generateText 失败（如网络不可达、API Key 无效等）
			const errorMsg = error instanceof Error ? error.message : String(error);
			log.error('AI 请求失败', error instanceof Error ? error : new Error(String(error)));
			await reportAssignmentFailure(this.proxyConfig.assignmentId, errorMsg);
			throw error;
		}
	}

	/**
	 * 便捷方法：处理完整的文本生成请求
	 * @param request 文本生成请求
	 * @returns 文本生成响应
	 */
	async handleTextGenerationRequest(
		request: TextGenerationRequest
	): Promise<TextGenerationResponse> {
		await this.initialize();
		const modelMessages = await this.convertMessages(request.messages);
		return await this.generateText(modelMessages);
	}
}

/**
 * 创建文本生成服务实例的工厂函数
 */
export function createTextGenerationService(
	options?: TextGenerationServiceOptions
): TextGenerationService {
	return new TextGenerationService(options);
}
