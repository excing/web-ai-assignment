import { convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
import { BaseAIService } from './base-ai-service';
import { extractMediaResources, type MediaResource } from './media-extractor';
import { createLogger } from '$lib/server/logger';

export type { MediaResource } from './media-extractor';

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
			skipAutoCharge: true,
		});

		const { text: processedText, resources: mediaResources } = await extractMediaResources({
			text: result.text,
			files: result.files || [],
			content: result.content || [],
			responseBody: result.response?.body,
		});

		// 仅在成功生成图片时扣费
		if (mediaResources.length > 0) {
			const usage = {
				promptTokens: result.usage.inputTokens || 0,
				completionTokens: result.usage.outputTokens || 0,
			};
			await this.base.manualCharge(
				usage,
				`图像生成扣费 - 输入${usage.promptTokens}tokens/输出${usage.completionTokens}tokens`
			);
		} else {
			log.info('图像生成请求成功但未产出图片，跳过扣费');
		}

		return {
			text: processedText,
			finishReason: result.finishReason,
			usage: {
				promptTokens: result.usage.inputTokens || 0,
				completionTokens: result.usage.outputTokens || 0,
				totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0)
			},
			reasoning: result.reasoningText,
			mediaResources
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
