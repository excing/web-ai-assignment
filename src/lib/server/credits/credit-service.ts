import { db } from '$lib/server/db';
import {
    user,
    creditTransaction,
    redemptionCode,
} from '$lib/server/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { getCodeByString, getCodeById } from './code-service';

export async function getBalance(userId: string): Promise<number> {
    const [row] = await db.select({ creditBalance: user.creditBalance })
        .from(user)
        .where(eq(user.id, userId));
    return row?.creditBalance ?? 0;
}

export async function getTransactionHistory(userId: string, limit = 50) {
    return db.select()
        .from(creditTransaction)
        .where(eq(creditTransaction.userId, userId))
        .orderBy(desc(creditTransaction.createdAt))
        .limit(limit);
}

export async function getRedemptionsByCode(codeId: string) {
    const redemptions = await db.select({
        id: creditTransaction.id,
        userId: creditTransaction.userId,
        userEmail: user.email,
        userName: user.name,
        amount: creditTransaction.amount,
        description: creditTransaction.description,
        createdAt: creditTransaction.createdAt,
    })
    .from(creditTransaction)
    .leftJoin(user, eq(creditTransaction.userId, user.id))
    .where(and(
        eq(creditTransaction.referenceId, codeId),
        eq(creditTransaction.type, 'redemption'),
    ))
    .orderBy(desc(creditTransaction.createdAt));

    const refunds = await db.select({ referenceId: creditTransaction.referenceId })
        .from(creditTransaction)
        .where(eq(creditTransaction.type, 'refund'));
    const refundedTxIds = new Set(refunds.map(r => r.referenceId));

    return redemptions.map(r => ({
        ...r,
        refunded: refundedTxIds.has(r.id),
    }));
}

export interface RedeemResult {
    success: boolean;
    error?: string;
    creditsAdded?: number;
    newBalance?: number;
}

export async function redeemCode(userId: string, codeStr: string): Promise<RedeemResult> {
    const code = await getCodeByString(codeStr);
    if (!code) {
        return { success: false, error: '兑换码不存在' };
    }
    if (!code.isActive) {
        return { success: false, error: '该兑换码已停用' };
    }
    if (code.expiresAt && code.expiresAt < new Date()) {
        return { success: false, error: '该兑换码已过期' };
    }
    if (code.maxRedemptions !== null && code.currentRedemptions >= code.maxRedemptions) {
        return { success: false, error: '该兑换码已达到最大使用次数' };
    }

    const [existing] = await db.select({ id: creditTransaction.id })
        .from(creditTransaction)
        .where(and(
            eq(creditTransaction.userId, userId),
            eq(creditTransaction.referenceId, code.id),
            eq(creditTransaction.type, 'redemption'),
        ));
    if (existing) {
        return { success: false, error: '您已经使用过该兑换码' };
    }

    const creditsToAdd = code.packageCredits;
    const txnId = randomUUID();

    await db.transaction(async (tx) => {
        await tx.insert(creditTransaction).values({
            id: txnId,
            userId,
            amount: creditsToAdd,
            type: 'redemption',
            referenceId: code.id,
            description: `兑换码 ${code.code} 兑换 - ${code.packageName}`,
            metadata: {
                codeId: code.id,
                codeString: code.code,
                packageId: code.packageId,
                packageName: code.packageName,
                packageCredits: code.packageCredits,
            },
        });

        await tx.update(user)
            .set({ creditBalance: sql`${user.creditBalance} + ${creditsToAdd}` })
            .where(eq(user.id, userId));

        await tx.update(redemptionCode)
            .set({ currentRedemptions: sql`${redemptionCode.currentRedemptions} + 1` })
            .where(eq(redemptionCode.id, code.id));
    });

    const newBalance = await getBalance(userId);
    return { success: true, creditsAdded: creditsToAdd, newBalance };
}

export interface RefundResult {
    success: boolean;
    error?: string;
    creditsDeducted?: number;
    newBalance?: number;
}

export async function refundRedemption(transactionId: string): Promise<RefundResult> {
    const [originalTx] = await db.select()
        .from(creditTransaction)
        .where(eq(creditTransaction.id, transactionId));

    if (!originalTx) {
        return { success: false, error: '交易记录不存在' };
    }
    if (originalTx.type !== 'redemption') {
        return { success: false, error: '只能退款兑换类型的交易' };
    }
    if (!originalTx.userId) {
        return { success: false, error: '关联用户已删除，无法退款' };
    }

    const [existingRefund] = await db.select({ id: creditTransaction.id })
        .from(creditTransaction)
        .where(and(
            eq(creditTransaction.referenceId, transactionId),
            eq(creditTransaction.type, 'refund'),
        ));
    if (existingRefund) {
        return { success: false, error: '该交易已退款' };
    }

    const creditsToDeduct = originalTx.amount;
    const refundId = randomUUID();
    const metadata = originalTx.metadata as Record<string, unknown> | null;

    await db.transaction(async (tx) => {
        await tx.insert(creditTransaction).values({
            id: refundId,
            userId: originalTx.userId,
            amount: -creditsToDeduct,
            type: 'refund',
            referenceId: transactionId,
            description: `退款 - ${originalTx.description ?? '兑换退款'}`,
            metadata: {
                originalTransactionId: transactionId,
                codeId: metadata?.codeId ?? null,
                codeString: metadata?.codeString ?? null,
            },
        });

        await tx.update(user)
            .set({ creditBalance: sql`${user.creditBalance} - ${creditsToDeduct}` })
            .where(eq(user.id, originalTx.userId!));

        if (originalTx.referenceId) {
            await tx.update(redemptionCode)
                .set({ currentRedemptions: sql`GREATEST(${redemptionCode.currentRedemptions} - 1, 0)` })
                .where(eq(redemptionCode.id, originalTx.referenceId));
        }
    });

    const newBalance = await getBalance(originalTx.userId);
    return { success: true, creditsDeducted: creditsToDeduct, newBalance };
}
