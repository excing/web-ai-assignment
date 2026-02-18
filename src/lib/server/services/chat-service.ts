import {
	streamText,
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
import { BillingService } from '$lib/server/credits/billing-service';
import { createLogger } from '$lib/server/logger';

const log = createLogger('chat-service');

/**
 * 聊天服务配置选项
 */
export interface ChatServiceOptions {
	/** AI 功能特性名称（用于获取对应的 Proxy 配置） */
	feature?: string;
	/** 最大输出 token 数 */
	maxOutputTokens?: number;
	/** 推理标签名称（用于提取 <think> 等标签内容） */
	reasoningTagName?: string;
	/** 用户 ID（用于计费，不传则不计费） */
	userId?: string;
}

/**
 * 聊天请求参数
 */
export interface ChatRequest {
	/** UI 消息列表（包含 parts） */
	messages: Array<Omit<UIMessage, 'id'>>;
}

/**
 * 聊天服务核心类
 * 负责处理 AI 聊天的核心业务逻辑，可在多个场景复用
 */
export class ChatService {
	private proxyConfig: ProxyConfig | null = null;

	constructor(private options: ChatServiceOptions = {}) {}

	/**
	 * 初始化服务：获取 Proxy 配置
	 */
	async initialize(): Promise<void> {
		const feature = this.options.feature || 'chat';
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
			throw new Error('ChatService 未初始化，请先调用 initialize()');
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
	 * 执行流式聊天
	 * @param modelMessages 已转换的模型消息
	 * @returns 流式响应对象
	 */
	async streamChat(modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>) {
		if (!this.proxyConfig) {
			throw new Error('ChatService 未初始化，请先调用 initialize()');
		}

		const model = this.createModel();
		const maxOutputTokens = this.options.maxOutputTokens ?? 4096;

		// 计费预检
		const billingService = this.options.userId
			? new BillingService(this.options.userId)
			: null;
		if (billingService) {
			await billingService.autoPreCheck(this.proxyConfig, {
				maxOutputTokens,
				description: 'AI 对话',
			});
		}

		const proxyConfig = this.proxyConfig;

		try {
			const result = streamText({
				model,
				messages: modelMessages,
				maxOutputTokens,
				onFinish: async ({ usage }) => {
					// 记录 Assignment 请求成功
					await reportAssignmentSuccess(proxyConfig.assignmentId);

					// 计费扣款
					if (billingService) {
						await billingService.autoCharge(proxyConfig, {
							usage: {
								promptTokens: usage.inputTokens || 0,
								completionTokens: usage.outputTokens || 0,
							},
							description: `AI 对话扣费 - 输入${usage.inputTokens || 0}tokens/输出${usage.outputTokens || 0}tokens`,
						});
					}
				},
				onError: async ({ error }) => {
					// 流式传输中途出错，报告 Assignment 失败
					const errorMsg = error instanceof Error ? error.message : String(error);
					log.error('AI 流式响应错误', undefined, { error: errorMsg });
					await reportAssignmentFailure(proxyConfig.assignmentId, errorMsg);
				}
			});

			return result;
		} catch (error) {
			// streamText 初始化失败（如网络不可达、API Key 无效等）
			const errorMsg = error instanceof Error ? error.message : String(error);
			log.error('AI 请求失败', error instanceof Error ? error : new Error(String(error)));
			await reportAssignmentFailure(proxyConfig.assignmentId, errorMsg);
			throw error;
		}
	}

	/**
	 * 便捷方法：处理完整的聊天请求
	 * @param request 聊天请求
	 * @returns 流式响应对象
	 */
	async handleChatRequest(request: ChatRequest) {
		await this.initialize();
		const modelMessages = await this.convertMessages(request.messages);
		return await this.streamChat(modelMessages);
	}
}

/**
 * 创建聊天服务实例的工厂函数
 */
export function createChatService(options?: ChatServiceOptions): ChatService {
	return new ChatService(options);
}
