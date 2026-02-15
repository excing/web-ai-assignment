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
	reportProxySuccess,
	reportProxyFailure,
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

			// 记录 Proxy 请求成功
			await reportProxySuccess(this.proxyConfig.proxyId);

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
				reasoning: result.reasoningText
			};
		} catch (error) {
			// generateText 失败（如网络不可达、API Key 无效等）
			const errorMsg = error instanceof Error ? error.message : String(error);
			log.error('AI 请求失败', error instanceof Error ? error : new Error(String(error)));
			await reportProxyFailure(this.proxyConfig.proxyId, errorMsg);
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
