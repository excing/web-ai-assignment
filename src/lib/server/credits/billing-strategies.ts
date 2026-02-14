import type { BillingStrategy, CostEstimate, ActualCost } from './billing-types';
import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

// ─── 文件上传：固定计费策略 ───

/** 每次上传的积分费用，可通过环境变量配置 */
function getUploadCreditCost(): number {
	return parseInt(env.CREDITS_UPLOAD_COST ?? '5', 10);
}

export const uploadBillingStrategy: BillingStrategy = {
	name: 'upload-fixed',
	mode: 'fixed',

	async estimateCost(_event: RequestEvent): Promise<CostEstimate> {
		const cost = getUploadCreditCost();
		return {
			estimatedCost: cost,
			description: `文件上传 - ${cost} 积分`,
		};
	},

	async calculateActualCost(_event: RequestEvent, _usageData: unknown): Promise<ActualCost> {
		const cost = getUploadCreditCost();
		return {
			amount: cost,
			description: '文件上传扣费',
			metadata: {
				type: 'upload',
				fixedCost: cost,
			},
		};
	},
};

// ─── AI 对话：动态计费策略（基于 token 用量） ───

/** Token 计价配置，积分/千tokens */
function getChatPricing() {
	return {
		inputPer1k: parseFloat(env.CREDITS_CHAT_INPUT_PER_1K ?? '1'),
		outputPer1k: parseFloat(env.CREDITS_CHAT_OUTPUT_PER_1K ?? '2'),
		minimumCharge: parseInt(env.CREDITS_CHAT_MINIMUM ?? '1', 10),
	};
}

/** 预检阈值：发起对话请求所需的最低余额 */
function getChatPreCheckThreshold(): number {
	return parseInt(env.CREDITS_CHAT_PRECHECK_THRESHOLD ?? '10', 10);
}

/**
 * Vercel AI SDK 的 LanguageModelUsage 结构。
 * 在计费模块中定义以避免直接依赖 'ai' 包。
 */
interface TokenUsageData {
	promptTokens?: number;
	completionTokens?: number;
	totalTokens?: number;
}

export const chatBillingStrategy: BillingStrategy = {
	name: 'chat-token',
	mode: 'dynamic',

	async estimateCost(_event: RequestEvent): Promise<CostEstimate> {
		const threshold = getChatPreCheckThreshold();
		return {
			estimatedCost: threshold,
			description: `AI 对话 - 预估最低 ${threshold} 积分`,
			context: { threshold },
		};
	},

	async calculateActualCost(
		_event: RequestEvent,
		usageData: unknown
	): Promise<ActualCost> {
		const pricing = getChatPricing();
		const usage = usageData as TokenUsageData | undefined;

		const promptTokens = usage?.promptTokens ?? 0;
		const completionTokens = usage?.completionTokens ?? 0;
		const totalTokens = usage?.totalTokens ?? (promptTokens + completionTokens);

		const inputCost = Math.ceil((promptTokens / 1000) * pricing.inputPer1k);
		const outputCost = Math.ceil((completionTokens / 1000) * pricing.outputPer1k);
		const totalCost = Math.max(inputCost + outputCost, pricing.minimumCharge);

		return {
			amount: totalCost,
			description: `AI 对话扣费 - 输入${promptTokens}tokens/输出${completionTokens}tokens`,
			metadata: {
				type: 'chat',
				promptTokens,
				completionTokens,
				totalTokens,
				inputCost,
				outputCost,
				totalCost,
				pricing: {
					inputPer1k: pricing.inputPer1k,
					outputPer1k: pricing.outputPer1k,
				},
			},
		};
	},
};
