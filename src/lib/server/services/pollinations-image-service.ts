/**
 * Pollinations Image 生成服务
 *
 * 负责调用 Pollinations API 生成图像
 * API 文档：https://pollinations.ai/
 */

import type { UIMessage } from 'ai';
import { BaseAIService } from './base-ai-service';
import { createLogger } from '$lib/server/logger';
import { reportAssignmentSuccess, reportAssignmentFailure } from '$lib/server/ai-proxy';
import { BillingService, InsufficientBalanceError } from '$lib/server/credits/billing-service';
import { extractMediaResources, type MediaResource } from './media-extractor';
import { AI_PROVIDER } from '$lib/config/constants';

const log = createLogger('pollinations-image-service');

/**
 * 通用图片生成请求参数
 */
export interface ImageGenerationRequest {
	/** UI 消息列表（包含 parts） */
	messages: Array<Omit<UIMessage, 'id'>>;
}

/**
 * Pollinations Image 生成请求参数
 */
export interface PollinationsImageGenerationRequest {
	/** 图片提示词 */
	prompt: string;
	/** 图片模型（flux, gptimage, veo 等），默认 flux */
	model?: string;
	/** 图片宽度，默认 1024 */
	width?: number;
	/** 图片高度，默认 1024 */
	height?: number;
	/** 随机种子 */
	seed?: number;
	/** AI 优化提示词 */
	enhance?: boolean;
	/** 负面提示词 */
	negative_prompt?: string;
	/** 质量等级 */
	quality?: string;
	/** 参考图像 URL */
	image?: string;
	/** 透明背景 */
	transparent?: boolean;
	/** 视频时长（视频模型） */
	duration?: number;
	/** 视频宽高比 */
	aspectRatio?: string;
	/** 视频音频 */
	audio?: boolean;
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
 * Pollinations Image 生成响应
 */
export interface PollinationsImageGenerationResponse {
	/** 生成的图像 URL 或本地路径 */
	imageUrl: string;
	/** 提取的多媒体资源 */
	mediaResources: MediaResource[];
	/** 完成原因 */
	finishReason: string;
	/** 是否成功 */
	success: boolean;
	/** 错误信息 */
	error?: string;
}

/**
 * 图片上传响应
 */
export interface ImageUploadResponse {
	/** 上传的文件 ID */
	id: string;
	/** 上传的文件 URL */
	url: string;
	/** 内容类型 */
	contentType: string;
	/** 文件大小 */
	size: number;
	/** 是否重复（内容相同的文件） */
	duplicate: boolean;
}

/**
 * Pollinations Image 服务配置选项
 */
export interface PollinationsImageServiceOptions {
	/** AI 功能特性名称（用于获取对应的 Proxy 配置） */
	feature?: string;
	/** 用户 ID（用于计费，不传则不计费） */
	userId?: string;
	/** 默认模型 */
	defaultModel?: string;
}

/**
 * Pollinations Image 服务核心类
 */
export class PollinationsImageService {
	private base: BaseAIService;
	private defaultModel: string;
	private billingService: BillingService | null = null;

	constructor(private options: PollinationsImageServiceOptions = {}) {
		this.base = new BaseAIService({
			feature: options.feature || 'pollinations-image',
			userId: options.userId,
		});
		this.defaultModel = options.defaultModel || 'flux';
		if (options.userId) {
			this.billingService = new BillingService(options.userId);
		}
	}

	/**
	 * 检查 URL 是否为 base64 或 data URL 格式
	 */
	private isBase64OrDataUrl(url: string): boolean {
		return url.startsWith('data:') || /^[A-Za-z0-9+/=]+$/.test(url.substring(0, 100));
	}

	/**
	 * 处理图片部分（上传或使用直接 URL）
	 */
	private async processImagePart(
		imageUrl: string,
		mediaType: string
	): Promise<string | undefined> {
		// 判断 URL 是否为 base64 或 data URL 格式
		if (this.isBase64OrDataUrl(imageUrl)) {
			log.info('Detected base64 image, uploading to Pollinations media storage');
			const uploadResult = await this.uploadImage(imageUrl, mediaType);
			if (uploadResult && uploadResult.url) {
				log.info('Image uploaded successfully, using remote URL as reference image', {
					uploadId: uploadResult.id,
					url: uploadResult.url,
				});
				return uploadResult.url;
			} else {
				log.warn('Image upload failed, proceeding without reference image');
				return undefined;
			}
		} else {
			// URL 已经是远程 URL，直接使用
			log.info('Using direct URL as reference image', { url: imageUrl });
			return imageUrl;
		}
	}

	/**
	 * 处理图片生成请求（从 ImageGenerationRequest 中提取数据）
	 */
	async handleImageGenerationRequest(
		request: ImageGenerationRequest
	): Promise<ImageGenerationResponse> {
		// 从消息中提取提示词（最后一个用户消息）
		const pollinationsRequest: PollinationsImageGenerationRequest = {
			prompt: '',
		};

		for (let i = request.messages.length - 1; i >= 0; i--) {
			const message = request.messages[i];
			if (message.role === 'user') {
				// UIMessage 的 content 可能是字符串或 ContentPart[] 数组
				const content = (message as any).parts;
				if (typeof content === 'string') {
					pollinationsRequest.prompt = content;
					break;
				} else if (Array.isArray(content)) {
					for (const part of content) {
						if (part.type === 'text' && part.text) {
							pollinationsRequest.prompt = part.text;
						} else if (part.type === 'file' && part.mediaType?.startsWith('image/') && part.url) {
							const imageUrl = await this.processImagePart(part.url, part.mediaType);
							if (imageUrl) {
								pollinationsRequest.image = imageUrl;
							}
						}
					}
					if (pollinationsRequest.prompt) break;
				}
			}
		}

		if (!pollinationsRequest.prompt) {
			return {
				text: '',
				finishReason: 'error',
				usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
				mediaResources: [],
			};
		}

		// 使用 generateImage 生成图像
		const result = await this.generateImage(pollinationsRequest);

		if (!result.success || !result.imageUrl) {
			return {
				text: result.error || 'Failed to generate image',
				finishReason: 'error',
				usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
				mediaResources: [],
			};
		}

		return {
			text: result.imageUrl,
			finishReason: result.finishReason,
			usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
			reasoning: undefined,
			mediaResources: result.mediaResources,
		};
	}

	/**
	 * 生成图像
	 */
	async generateImage(
		request: PollinationsImageGenerationRequest
	): Promise<PollinationsImageGenerationResponse> {
		try {
			// 初始化 base service 并获取 proxy 配置
			await this.base.initialize();
			const config = this.base.getProxyConfig();

			// 验证 provider 类型
			if (config.provider !== AI_PROVIDER.POLLINATIONS_IMAGE) {
				return {
					imageUrl: '',
					mediaResources: [],
					success: false,
					error: 'Invalid provider type for Pollinations Image',
					finishReason: 'error',
				};
			}

			// 余额预检：在 API 调用前拦截余额不足的用户
			if (this.billingService) {
				await this.billingService.autoPreCheck(config, {
					description: `Pollinations Image 生成 - ${request.model || this.defaultModel}`,
				});
			}

			// 构建 API URL
			const apiUrl = this.buildApiUrl(config.baseUrl, request);

			log.info('Calling Pollinations Image API', {
				url: apiUrl.toString().replace(config.apiKey, '***'),
				model: request.model || this.defaultModel,
				prompt: request.prompt.substring(0, 100),
			});

			// 发送请求
			const response = await fetch(apiUrl.toString(), {
				method: 'GET',
				headers: this.buildHeaders(config.apiKey),
			});

			if (!response.ok) {
				const errorText = await response.text();
				const errorMessage = `Pollinations API error: ${response.status} ${errorText}`;
				log.error(errorMessage);

				// 记录失败
				await reportAssignmentFailure(config.assignmentId, errorMessage, config.isBackup);

				return {
					imageUrl: '',
					mediaResources: [],
					success: false,
					error: errorMessage,
					finishReason: 'error',
				};
			}

			// 获取图像数据
			const imageBuffer = await response.arrayBuffer();
			const imageData = Buffer.from(imageBuffer);

			// 记录成功
			await reportAssignmentSuccess(config.assignmentId, config.isBackup);

			// 图片生成成功即扣费（不依赖后续 R2 上传结果）
			if (this.billingService) {
				await this.billingService.autoCharge(config, {
					usage: { promptTokens: 0, completionTokens: 0 },
					description: `Pollinations Image 生成 - ${request.model || this.defaultModel}`,
				});
			}

			// 生成 data URL
			const contentType = response.headers.get('content-type') || 'image/jpeg';
			const dataUrl = `data:${contentType};base64,${imageData.toString('base64')}`;

			// 上传到 R2（失败不影响计费和返回）
			const { text: processedText, resources: mediaResources } = await extractMediaResources({
				text: dataUrl,
			});

			return {
				imageUrl: processedText,
				mediaResources,
				success: true,
				finishReason: 'success',
			};
		} catch (error) {
			// 余额不足需向上传播，由 API 路由返回 402
			if (error instanceof InsufficientBalanceError) throw error;

			const errorMessage = error instanceof Error ? error.message : String(error);
			log.error('Pollinations Image generation failed', error instanceof Error ? error : new Error(errorMessage));

			// 记录失败
			try {
				const config = this.base.getProxyConfig();
				await reportAssignmentFailure(config.assignmentId, errorMessage, config.isBackup);
			} catch (reportError) {
				log.error('Failed to report failure', reportError instanceof Error ? reportError : new Error(String(reportError)));
			}

			return {
				imageUrl: '',
				mediaResources: [],
				success: false,
				error: errorMessage,
				finishReason: 'error',
			};
		}
	}

	/**
	 * 构建 API 请求 URL
	 */
	private buildApiUrl(baseUrl: string, request: PollinationsImageGenerationRequest): URL {
		const model = request.model || this.defaultModel;
		const width = request.width || 1024;
		const height = request.height || 1024;

		// 确保 prompt 正确编码
		const encodedPrompt = encodeURIComponent(request.prompt);

		// 构建 URL
		const urlString = `${baseUrl}/${encodedPrompt}`;
		const url = new URL(urlString);

		// 添加参数
		url.searchParams.set('model', model);
		url.searchParams.set('width', String(width));
		url.searchParams.set('height', String(height));

		if (request.seed !== undefined) {
			url.searchParams.set('seed', String(request.seed));
		}
		if (request.enhance !== undefined) {
			url.searchParams.set('enhance', String(request.enhance));
		}
		if (request.negative_prompt) {
			url.searchParams.set('negative_prompt', request.negative_prompt);
		}
		if (request.quality) {
			url.searchParams.set('quality', request.quality);
		}
		if (request.image) {
			url.searchParams.set('image', request.image);
		}
		if (request.transparent !== undefined) {
			url.searchParams.set('transparent', String(request.transparent));
		}
		if (request.duration !== undefined) {
			url.searchParams.set('duration', String(request.duration));
		}
		if (request.aspectRatio) {
			url.searchParams.set('aspectRatio', request.aspectRatio);
		}
		if (request.audio !== undefined) {
			url.searchParams.set('audio', String(request.audio));
		}

		return url;
	}

	/**
	 * 构建请求头
	 * 支持两种认证方式：Header 或 Query 参数
	 */
	private buildHeaders(apiKey: string): HeadersInit {
		return {
			'Authorization': `Bearer ${apiKey}`,
			'Accept': 'image/jpeg, image/png, video/mp4',
			'User-Agent': 'web-ai-assignment/1.0',
		};
	}

	/**
	 * 上传图片到 Pollinations 媒体存储
	 * 支持 base64 和二进制数据上传
	 */
	async uploadImage(
		imageData: string | Buffer,
		contentType: string = 'image/jpeg'
	): Promise<ImageUploadResponse | null> {
		try {
			await this.base.initialize();
			const config = this.base.getProxyConfig();

			// 验证 provider 类型
			if (config.provider !== AI_PROVIDER.POLLINATIONS_IMAGE) {
				log.error('Invalid provider type for Pollinations Image upload');
				return null;
			}

			// 将数据转换为 FormData
			const formData = new FormData();

			let buffer: Buffer;

			if (typeof imageData === 'string') {
				// 处理 base64 数据
				if (imageData.startsWith('data:')) {
					// 去掉 data URL 前缀
					const base64String = imageData.split(',')[1];
					buffer = Buffer.from(base64String, 'base64');
				} else {
					// 直接是 base64 字符串
					buffer = Buffer.from(imageData, 'base64');
				}
			} else {
				// 直接使用 Buffer
				buffer = imageData;
			}

			// 将 Buffer 转换为 Uint8Array 以兼容 FormData
			const uint8Array = new Uint8Array(buffer);
			formData.append('file', new Blob([uint8Array], { type: contentType }), 'image');

			const uploadUrl = 'https://media.pollinations.ai/upload';

			log.info('Uploading image to Pollinations media storage', {
				url: uploadUrl,
				contentType,
			});

			const response = await fetch(uploadUrl, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${config.apiKey}`,
				},
				body: formData,
			});

			if (!response.ok) {
				const errorText = await response.text();
				log.error('Pollinations image upload failed', {
					status: response.status,
					error: errorText,
				});
				return null;
			}

			const uploadResult = await response.json();
			log.info('Image uploaded successfully', {
				id: uploadResult.id,
				url: uploadResult.url,
				duplicate: uploadResult.duplicate,
			});

			return uploadResult as ImageUploadResponse;
		} catch (error) {
			log.error('Image upload error', error instanceof Error ? error : new Error(String(error)));
			return null;
		}
	}
}

/**
 * 创建 Pollinations Image 服务实例的工厂函数
 */
export function createPollinationsImageService(
	options?: PollinationsImageServiceOptions
): PollinationsImageService {
	return new PollinationsImageService(options);
}
