/**
 * Base AI Service
 *
 * 封装 AI 请求（流式 / 非流式）的公共基础设施：
 * - Proxy 初始化 & 模型创建
 * - 计费预检 & 扣费
 * - 被动健康检查上报
 * - 统一错误处理
 *
 * 业务 Service（ChatService、TextGenerationService 等）通过组合使用本服务。
 */

import {
	streamText,
	generateText,
	extractReasoningMiddleware,
	wrapLanguageModel,
} from 'ai';
import type { ModelMessage } from 'ai';
import {
	getProxyForFeatureWithFallback,
	createModelFromProxy,
	reportAssignmentSuccess,
	reportAssignmentFailure,
	type ProxyConfig,
} from '$lib/server/ai-proxy';
import { BillingService } from '$lib/server/credits/billing-service';
import { createLogger } from '$lib/server/logger';

const log = createLogger('base-ai-service');

// ─── 类型定义 ───

export interface BaseAIServiceOptions {
	/** AI 功能特性名称（用于获取对应的 Proxy 配置） */
	feature: string;
	/** 用户 ID（用于计费，不传则不计费） */
	userId?: string;
	/** 推理标签名称（用于提取 <think> 等标签内容） */
	reasoningTagName?: string;
}

export interface StreamingCallOptions {
	messages: ModelMessage[];
	maxOutputTokens?: number;
	temperature?: number;
	topP?: number;
	/** 计费描述 */
	billingDescription?: string;
}

export interface GenerateCallOptions {
	messages: ModelMessage[];
	maxOutputTokens?: number;
	temperature?: number;
	topP?: number;
	/** 计费描述 */
	billingDescription?: string;
}

// ─── BaseAIService ───

export class BaseAIService {
	private proxyConfig: ProxyConfig | null = null;
	private billingService: BillingService | null = null;

	constructor(private options: BaseAIServiceOptions) {
		if (options.userId) {
			this.billingService = new BillingService(options.userId);
		}
	}

	/** 获取已初始化的 ProxyConfig（初始化后可用） */
	getProxyConfig(): ProxyConfig {
		if (!this.proxyConfig) {
			throw new Error('BaseAIService 未初始化，请先调用 initialize()');
		}
		return this.proxyConfig;
	}

	/**
	 * 初始化：获取 Proxy 配置
	 */
	async initialize(): Promise<ProxyConfig> {
		this.proxyConfig = await getProxyForFeatureWithFallback(this.options.feature);
		return this.proxyConfig;
	}

	/**
	 * 创建并配置 AI 模型（包装推理中间件）
	 */
	createModel() {
		const config = this.getProxyConfig();
		const rawModel = createModelFromProxy(config);
		return wrapLanguageModel({
			model: rawModel,
			middleware: extractReasoningMiddleware({
				tagName: this.options.reasoningTagName || 'think',
			}),
		});
	}

	/**
	 * 流式 AI 请求
	 *
	 * 完整流程：计费预检 → streamText → onFinish 扣费 + 健康上报
	 */
	async executeStreaming(opts: StreamingCallOptions) {
		const config = this.getProxyConfig();
		const model = this.createModel();
		const maxOutputTokens = opts.maxOutputTokens ?? 4096;
		const billingDesc = opts.billingDescription || 'AI 请求';

		// 计费预检
		if (this.billingService) {
			await this.billingService.autoPreCheck(config, {
				maxOutputTokens,
				description: billingDesc,
			});
		}

		const billingService = this.billingService;

		try {
			const result = streamText({
				model,
				messages: opts.messages,
				maxOutputTokens,
				temperature: opts.temperature,
				topP: opts.topP,
				onFinish: async ({ usage }) => {
					await reportAssignmentSuccess(config.assignmentId);

					if (billingService) {
						await billingService.autoCharge(config, {
							usage: {
								promptTokens: usage.inputTokens || 0,
								completionTokens: usage.outputTokens || 0,
							},
							description: `${billingDesc}扣费 - 输入${usage.inputTokens || 0}tokens/输出${usage.outputTokens || 0}tokens`,
						});
					}
				},
				onError: async ({ error }) => {
					const errorMsg = error instanceof Error ? error.message : String(error);
					log.error('AI 流式响应错误', undefined, { error: errorMsg });
					await reportAssignmentFailure(config.assignmentId, errorMsg);
				},
			});

			return result;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			log.error('AI 流式请求失败', error instanceof Error ? error : new Error(errorMsg));
			await reportAssignmentFailure(config.assignmentId, errorMsg);
			throw error;
		}
	}

	/**
	 * 非流式 AI 请求
	 *
	 * 完整流程：计费预检 → generateText → 扣费 + 健康上报
	 */
	async executeGenerate(opts: GenerateCallOptions) {
		const config = this.getProxyConfig();
		const model = this.createModel();
		const maxOutputTokens = opts.maxOutputTokens ?? 4096;
		const billingDesc = opts.billingDescription || 'AI 请求';

		// 计费预检
		if (this.billingService) {
			await this.billingService.autoPreCheck(config, {
				maxOutputTokens,
				description: billingDesc,
			});
		}

		try {
			const result = await generateText({
				model,
				messages: opts.messages,
				maxOutputTokens,
				temperature: opts.temperature,
				topP: opts.topP,
			});

			await reportAssignmentSuccess(config.assignmentId);

			if (this.billingService) {
				await this.billingService.autoCharge(config, {
					usage: {
						promptTokens: result.usage.inputTokens || 0,
						completionTokens: result.usage.outputTokens || 0,
					},
					description: `${billingDesc}扣费 - 输入${result.usage.inputTokens || 0}tokens/输出${result.usage.outputTokens || 0}tokens`,
				});
			}

			return result;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			log.error('AI 请求失败', error instanceof Error ? error : new Error(errorMsg));
			await reportAssignmentFailure(config.assignmentId, errorMsg);
			throw error;
		}
	}
}
