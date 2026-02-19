/**
 * BillingService
 *
 * 封装计费逻辑，供各 Service 在内部调用。
 * 支持固定计费和动态（按 token）计费两种模式。
 *
 * 设计原则：
 * - preCheck 是软拦截：余额不足抛出 InsufficientBalanceError
 * - charge 是硬执行：响应已发送后必须扣费，允许负余额
 */

import { env } from '$env/dynamic/private';
import { getBalance } from './credit-service';
import { deductCredits } from './deduction-service';
import type { ProxyConfig } from '$lib/server/ai-proxy';
import type { DeductionResult } from './billing-types';

// ─── 错误类型 ───

export class InsufficientBalanceError extends Error {
	public readonly required: number;
	public readonly current: number;
	public readonly description: string;

	constructor(required: number, current: number, description: string) {
		super('积分余额不足');
		this.name = 'InsufficientBalanceError';
		this.required = required;
		this.current = current;
		this.description = description;
	}
}

// ─── 类型定义 ───

export interface TokenUsage {
	promptTokens: number;
	completionTokens: number;
}

export interface DynamicPricing {
	inputPer1k: number;
	outputPer1k: number;
	minimum: number;
}

// ─── BillingService ───

export class BillingService {
	constructor(private userId: string) {}

	/**
	 * 预检余额。余额不足时抛出 InsufficientBalanceError。
	 */
	async preCheck(estimatedCost: number, description: string): Promise<void> {
		const balance = await getBalance(this.userId);
		if (balance < estimatedCost) {
			throw new InsufficientBalanceError(estimatedCost, balance, description);
		}
	}

	/**
	 * 固定模式预检。
	 * 预检金额 = minimum（固定扣费积分）。
	 */
	async preCheckFixed(config: ProxyConfig, fallbackDescription?: string): Promise<number> {
		const cost = BillingService.getFixedCost(config);
		const desc = fallbackDescription || `固定计费 - ${cost} 积分`;
		await this.preCheck(cost, desc);
		return cost;
	}

	/**
	 * 动态模式预检。
	 * 预检金额 = 输入 token 费用 + maxOutputTokens 费用。
	 */
	async preCheckDynamic(
		config: ProxyConfig,
		inputTokens: number,
		maxOutputTokens: number,
		fallbackDescription?: string,
	): Promise<number> {
		const pricing = BillingService.getDynamicPricing(config);
		const inputCost = Math.ceil((inputTokens / 1000) * pricing.inputPer1k);
		const outputCost = Math.ceil((maxOutputTokens / 1000) * pricing.outputPer1k);
		const estimatedCost = Math.max(inputCost + outputCost, pricing.minimum);
		const desc =
			fallbackDescription ||
			`动态计费预估 - 输入${inputTokens}tokens + 最大输出${maxOutputTokens}tokens`;
		await this.preCheck(estimatedCost, desc);
		return estimatedCost;
	}

	/**
	 * 固定扣费。
	 */
	async chargeFixed(
		config: ProxyConfig,
		description: string,
		metadata: Record<string, unknown> = {},
	): Promise<DeductionResult> {
		const cost = BillingService.getFixedCost(config);
		return deductCredits({
			userId: this.userId,
			amount: cost,
			description,
			metadata: { ...metadata, billingMode: 'fixed', fixedCost: cost },
			endpoint: config.assignmentId,
		});
	}

	/**
	 * 动态扣费（按实际 token 用量）。
	 * 实际费用 = max(输入费用 + 输出费用, minimum)。
	 */
	async chargeDynamic(
		config: ProxyConfig,
		usage: TokenUsage,
		description: string,
		metadata: Record<string, unknown> = {},
	): Promise<DeductionResult> {
		const pricing = BillingService.getDynamicPricing(config);
		const inputCost = Math.ceil((usage.promptTokens / 1000) * pricing.inputPer1k);
		const outputCost = Math.ceil((usage.completionTokens / 1000) * pricing.outputPer1k);
		const totalCost = Math.max(inputCost + outputCost, pricing.minimum);

		return deductCredits({
			userId: this.userId,
			amount: totalCost,
			description,
			metadata: {
				...metadata,
				billingMode: 'dynamic',
				promptTokens: usage.promptTokens,
				completionTokens: usage.completionTokens,
				inputCost,
				outputCost,
				totalCost,
				pricing,
			},
			endpoint: config.assignmentId,
		});
	}

	/**
	 * 根据 ProxyConfig 的 billingMode 自动选择预检方式。
	 * - fixed: preCheckFixed
	 * - dynamic: preCheckDynamic
	 * - 未配置: 不预检
	 *
	 * @returns 是否需要计费
	 */
	async autoPreCheck(
		config: ProxyConfig,
		opts: { inputTokens?: number; maxOutputTokens?: number; description?: string } = {},
	): Promise<boolean> {
		const mode = BillingService.getBillingMode(config);
		if (!mode) return false;

		if (mode === 'fixed') {
			await this.preCheckFixed(config, opts.description);
		} else {
			await this.preCheckDynamic(
				config,
				opts.inputTokens ?? 0,
				opts.maxOutputTokens ?? 4096,
				opts.description,
			);
		}
		return true;
	}

	/**
	 * 根据 ProxyConfig 的 billingMode 自动选择扣费方式。
	 * - fixed: chargeFixed
	 * - dynamic: chargeDynamic
	 * - 未配置: 不扣费
	 */
	async autoCharge(
		config: ProxyConfig,
		opts: {
			usage?: TokenUsage;
			description: string;
			metadata?: Record<string, unknown>;
		},
	): Promise<DeductionResult | null> {
		const mode = BillingService.getBillingMode(config);
		if (!mode) return null;

		if (mode === 'fixed') {
			return this.chargeFixed(config, opts.description, opts.metadata);
		} else {
			if (!opts.usage) {
				throw new Error('动态计费模式需要 usage 数据');
			}
			return this.chargeDynamic(config, opts.usage, opts.description, opts.metadata);
		}
	}

	// ─── 静态工具方法 ───

	/**
	 * 获取有效的计费模式。
	 * ProxyConfig 有配置则用配置值，否则返回 null（不计费）。
	 */
	static getBillingMode(config: ProxyConfig): 'fixed' | 'dynamic' | null {
		if (config.billingMode === 'fixed' || config.billingMode === 'dynamic') {
			return config.billingMode;
		}
		return null;
	}

	/**
	 * 获取固定扣费积分。
	 * 优先用 ProxyConfig.minimum，fallback 到环境变量。
	 */
	static getFixedCost(config: ProxyConfig): number {
		if (config.minimum != null && config.minimum > 0) {
			return config.minimum;
		}
		return parseInt(env.CREDITS_IMAGE_GENERATION_COST ?? '5', 10);
	}

	/**
	 * 获取动态计费定价。
	 * 优先用 ProxyConfig 字段，fallback 到环境变量。
	 */
	static getDynamicPricing(config: ProxyConfig): DynamicPricing {
		return {
			inputPer1k: config.inputPer1k ?? parseFloat(env.CREDITS_CHAT_INPUT_PER_1K ?? '1'),
			outputPer1k: config.outputPer1k ?? parseFloat(env.CREDITS_CHAT_OUTPUT_PER_1K ?? '2'),
			minimum: config.minimum ?? parseInt(env.CREDITS_CHAT_MINIMUM ?? '1', 10),
		};
	}
}
