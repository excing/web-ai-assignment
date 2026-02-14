import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { BillingContext } from './billing-types';
import { findBilledRoute } from './billing-registry';
import { getBalance } from './credit-service';
import { deductCredits } from './deduction-service';

/** 等待用量数据就绪的超时时间（ms），防止 Promise 永远挂起 */
const USAGE_DATA_TIMEOUT_MS = 30_000;

/**
 * 计费预检。在 hooks.server.ts 中于 resolve() 之前调用。
 *
 * - 返回 null：放行（非计费路由 或 预检通过）
 * - 返回 Response：拦截（余额不足，402）
 *
 * 注意：estimateCost 不得消费 event.request body，否则端点将无法读取。
 * 若需根据请求内容动态估算，应先 clone request。
 */
export async function billingPreCheck(
	event: RequestEvent
): Promise<Response | null> {
	const { pathname } = event.url;
	const method = event.request.method;

	// 1. 查找计费路由配置
	const routeConfig = findBilledRoute(pathname, method);
	if (!routeConfig) return null;

	// 2. 需要认证（未登录交由端点自行返回 401）
	const userId = event.locals.session?.user?.id;
	if (!userId) return null;

	// 3. 估算费用
	const estimate = await routeConfig.strategy.estimateCost(event);

	// 4. 查询余额
	const balance = await getBalance(userId);
	if (balance < estimate.estimatedCost) {
		return json(
			{
				error: '积分余额不足',
				required: estimate.estimatedCost,
				current: balance,
				description: estimate.description,
			},
			{ status: 402 }
		);
	}

	// 5. 创建计费上下文（含 Promise + resolver 供端点异步通知用量）
	let resolveUsageData!: () => void;
	const usageDataReady = new Promise<void>((resolve) => {
		resolveUsageData = resolve;
	});

	const billingContext: BillingContext = {
		isBilled: true,
		userId,
		routeConfig,
		estimate,
		balanceAtPreCheck: balance,
		usageDataReady,
		resolveUsageData,
	};

	event.locals.billingContext = billingContext;
	return null;
}

/**
 * 计费后付费。响应发送完成后调用。
 *
 * - 标准响应：resolve() 后立即调用（hooks 中已 resolveUsageData）
 * - 流式响应：流结束（TransformStream flush）后调用
 */
export async function billingPostPayment(
	event: RequestEvent
): Promise<void> {
	const ctx = event.locals.billingContext;
	if (!ctx) return;

	try {
		// 等待用量数据就绪，带超时保护防止 Promise 永远挂起
		const timeout = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error('usageDataReady 超时')), USAGE_DATA_TIMEOUT_MS);
		});
		await Promise.race([ctx.usageDataReady, timeout]);

		// 计算实际费用
		const actualCost = await ctx.routeConfig.strategy.calculateActualCost(
			event,
			ctx.usageData
		);

		// 原子扣费 + 记录交易
		const result = await deductCredits({
			userId: ctx.userId,
			amount: actualCost.amount,
			description: actualCost.description,
			metadata: actualCost.metadata,
			endpoint: ctx.routeConfig.pathPattern,
		});

		if (!result.success) {
			console.error(
				`[billing] 扣费失败 userId=${ctx.userId}: ${result.error}`
			);
		}
	} catch (error) {
		console.error('[billing] 后付费异常:', error);
	}
}

/**
 * 包装流式响应，在流结束后触发后付费。
 *
 * 使用 TransformStream 透传所有字节（不修改内容），
 * 在 flush() 回调中触发 billingPostPayment()。
 *
 * 若流中断（pipeTo 异常）→ flush 不触发 → 不扣费。
 */
export function wrapStreamingResponse(
	originalResponse: Response,
	event: RequestEvent
): Response {
	const originalBody = originalResponse.body;
	if (!originalBody) {
		// 无 body 的流式响应（极端情况）→ 不扣费
		return originalResponse;
	}

	const { readable, writable } = new TransformStream({
		flush() {
			// 流完成，触发后付费（fire-and-forget）
			billingPostPayment(event).catch((err) => {
				console.error('[billing] 流式后付费异常:', err);
			});
		},
	});

	// 透传原始流
	originalBody.pipeTo(writable).catch((err) => {
		// 流中断或客户端断连 → 不扣费（flush 不会触发）
		console.error('[billing] 流管道异常:', err);
	});

	return new Response(readable, {
		status: originalResponse.status,
		statusText: originalResponse.statusText,
		headers: originalResponse.headers,
	});
}
