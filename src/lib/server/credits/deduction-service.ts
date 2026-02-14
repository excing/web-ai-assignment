import { db } from '$lib/server/db';
import { user, creditTransaction } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { DeductionInput, DeductionResult } from './billing-types';

/**
 * 无条件扣除用户积分并记录交易，允许余额为负。
 *
 * 设计原则：预检是软拦截（billingPreCheck 返回 402），扣费是硬执行。
 * 后付费场景中响应已发送，必须记录消费，否则用户白嫖且无审计痕迹。
 * 负余额在下次预检时自然拦截。
 *
 * 事务流程：
 * 1. UPDATE user SET credit_balance = credit_balance - amount WHERE id = userId
 * 2. 若 0 行受影响 → 用户不存在
 * 3. INSERT credit_transaction (type='usage', amount=-N)
 */
export async function deductCredits(input: DeductionInput): Promise<DeductionResult> {
	const { userId, amount, description, metadata, endpoint } = input;

	if (amount <= 0) {
		return { success: false, error: '扣费金额必须大于零' };
	}

	const txnId = randomUUID();

	try {
		const newBalance = await db.transaction(async (tx) => {
			// 无条件扣除，允许余额为负
			const [updated] = await tx
				.update(user)
				.set({
					creditBalance: sql`${user.creditBalance} - ${amount}`,
				})
				.where(eq(user.id, userId))
				.returning({ newBalance: user.creditBalance });

			if (!updated) {
				throw new Error('USER_NOT_FOUND');
			}

			// 记录交易（amount 为负数，遵循已有 refund 约定）
			await tx.insert(creditTransaction).values({
				id: txnId,
				userId,
				amount: -amount,
				type: 'usage',
				referenceId: null,
				description,
				metadata: {
					...metadata,
					endpoint,
					deductedAt: new Date().toISOString(),
				},
			});

			return updated.newBalance;
		});

		return {
			success: true,
			transactionId: txnId,
			newBalance,
		};
	} catch (error) {
		if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
			return { success: false, error: '用户不存在' };
		}
		console.error('[billing] 扣费异常:', error);
		return {
			success: false,
			error: '扣费失败，请稍后重试',
		};
	}
}
