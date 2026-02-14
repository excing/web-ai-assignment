import type { RequestEvent } from '@sveltejs/kit';

// ─── 计费模式 ───

/** 计费模式：固定 / 动态 */
export type BillingMode = 'fixed' | 'dynamic';

/** 响应类型：流式 / 标准 */
export type ResponseType = 'streaming' | 'standard';

// ─── 费用估算与实际计算 ───

/** 预检阶段的费用估算结果 */
export interface CostEstimate {
	/** 处理请求所需的最低积分 */
	estimatedCost: number;
	/** 可读描述（用于交易记录） */
	description: string;
	/** 额外上下文信息 */
	context?: Record<string, unknown>;
}

/** 后付费阶段的实际费用计算结果 */
export interface ActualCost {
	/** 实际扣除积分数 */
	amount: number;
	/** 可读描述（用于交易记录） */
	description: string;
	/** 存入 credit_transaction.metadata 的 JSONB 数据 */
	metadata: Record<string, unknown>;
}

// ─── 计费策略接口 ───

/**
 * 计费策略定义了如何估算和计算某个端点的费用。
 *
 * 每个策略是一个对象字面量，遵循项目中纯函数的约定（非 class）。
 */
export interface BillingStrategy {
	/** 策略唯一标识 */
	readonly name: string;
	/** 计费模式 */
	readonly mode: BillingMode;

	/**
	 * 预检：估算费用。
	 * - fixed 模式：返回确切费用
	 * - dynamic 模式：返回最低阈值（如最低 1 积分）
	 *
	 * 可根据请求内容（如消息数量）动态调整阈值。
	 */
	estimateCost(event: RequestEvent): Promise<CostEstimate>;

	/**
	 * 后付费：根据实际用量计算费用。
	 * - fixed 模式：返回固定费用
	 * - dynamic 模式：根据 usageData（如 token 用量）计算
	 */
	calculateActualCost(event: RequestEvent, usageData: unknown): Promise<ActualCost>;
}

// ─── 路由配置 ───

/** 需要计费的路由配置 */
export interface BilledRouteConfig {
	/** 匹配的 URL 路径（如 '/api/chat'） */
	pathPattern: string;
	/** 匹配的 HTTP 方法 */
	method: 'POST' | 'GET' | 'PUT' | 'DELETE';
	/** 应用的计费策略 */
	strategy: BillingStrategy;
	/** 响应类型：流式需要 TransformStream 包装 */
	responseType: ResponseType;
}

// ─── 中间件上下文 ───

/**
 * 计费上下文，通过 event.locals.billingContext 在中间件与端点之间传递。
 *
 * 对于流式端点：端点通过 resolveUsageData() 通知中间件用量数据已就绪。
 * 对于标准端点：中间件自行 resolve（固定计费不需要用量数据）。
 */
export interface BillingContext {
	/** 标识此请求正在计费 */
	isBilled: true;
	/** 被计费的用户 ID */
	userId: string;
	/** 匹配的路由配置 */
	routeConfig: BilledRouteConfig;
	/** 预检阶段的费用估算 */
	estimate: CostEstimate;
	/** 预检时的用户余额快照 */
	balanceAtPreCheck: number;
	/** 端点处理完成后设置的用量数据（如 token 计数） */
	usageData?: unknown;
	/** 等待用量数据就绪的 Promise */
	usageDataReady: Promise<void>;
	/** 调用以通知用量数据已就绪 */
	resolveUsageData: () => void;
}

// ─── 扣费服务 ───

/** 扣费请求参数 */
export interface DeductionInput {
	userId: string;
	amount: number;
	description: string;
	metadata: Record<string, unknown>;
	/** 触发扣费的端点路径 */
	endpoint: string;
}

/** 扣费结果 */
export interface DeductionResult {
	success: boolean;
	transactionId?: string;
	newBalance?: number;
	error?: string;
}
