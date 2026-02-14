import { db } from '$lib/server/db';
import { redemptionCode } from '$lib/server/db/schema';
import { eq, desc, and, or, gt, lte, gte, lt, isNull, isNotNull, count as countFn } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCodeString(): string {
    let code = '';
    for (let i = 0; i < 12; i++) {
        if (i > 0 && i % 4 === 0) code += '-';
        code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return code;
}

export interface CreateCodesInput {
    packageId: string;
    packageName: string;
    packageCredits: number;
    packagePrice: number;
    expiresAt: Date | null;
    maxRedemptions: number | null;
    count?: number;
}

export async function createCodes(input: CreateCodesInput, createdBy: string) {
    const count = Math.min(Math.max(input.count ?? 1, 1), 100);
    const values = [];
    for (let i = 0; i < count; i++) {
        values.push({
            id: randomUUID(),
            code: generateCodeString(),
            packageId: input.packageId,
            packageName: input.packageName,
            packageCredits: input.packageCredits,
            packagePrice: input.packagePrice,
            expiresAt: input.expiresAt,
            maxRedemptions: input.maxRedemptions,
            currentRedemptions: 0,
            isActive: true,
            createdBy,
        });
    }
    return db.insert(redemptionCode).values(values).returning();
}

export type CodeStatus = 'valid' | 'expired' | 'used_up' | 'inactive';

export async function listCodes(
    filters?: { packageId?: string; status?: CodeStatus },
    pagination?: { limit: number; offset: number },
) {
    const conditions = [];
    if (filters?.packageId) {
        conditions.push(eq(redemptionCode.packageId, filters.packageId));
    }
    if (filters?.status) {
        const now = new Date();
        switch (filters.status) {
            case 'valid':
                conditions.push(eq(redemptionCode.isActive, true));
                conditions.push(or(isNull(redemptionCode.expiresAt), gt(redemptionCode.expiresAt, now))!);
                conditions.push(or(isNull(redemptionCode.maxRedemptions), lt(redemptionCode.currentRedemptions, redemptionCode.maxRedemptions))!);
                break;
            case 'expired':
                conditions.push(isNotNull(redemptionCode.expiresAt));
                conditions.push(lte(redemptionCode.expiresAt, now));
                break;
            case 'used_up':
                conditions.push(isNotNull(redemptionCode.maxRedemptions));
                conditions.push(gte(redemptionCode.currentRedemptions, redemptionCode.maxRedemptions));
                break;
            case 'inactive':
                conditions.push(eq(redemptionCode.isActive, false));
                break;
        }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    if (pagination) {
        const { limit, offset } = pagination;
        const [{ total }] = await db
            .select({ total: countFn() })
            .from(redemptionCode)
            .where(whereClause);
        const items = await db.select({
            id: redemptionCode.id,
            code: redemptionCode.code,
            packageId: redemptionCode.packageId,
            packageName: redemptionCode.packageName,
            packageCredits: redemptionCode.packageCredits,
            expiresAt: redemptionCode.expiresAt,
            maxRedemptions: redemptionCode.maxRedemptions,
            currentRedemptions: redemptionCode.currentRedemptions,
            isActive: redemptionCode.isActive,
            createdBy: redemptionCode.createdBy,
            createdAt: redemptionCode.createdAt,
        })
        .from(redemptionCode)
        .where(whereClause)
        .orderBy(desc(redemptionCode.createdAt))
        .limit(limit)
        .offset(offset);
        return { items, total };
    }

    const items = await db.select({
        id: redemptionCode.id,
        code: redemptionCode.code,
        packageId: redemptionCode.packageId,
        packageName: redemptionCode.packageName,
        packageCredits: redemptionCode.packageCredits,
        expiresAt: redemptionCode.expiresAt,
        maxRedemptions: redemptionCode.maxRedemptions,
        currentRedemptions: redemptionCode.currentRedemptions,
        isActive: redemptionCode.isActive,
        createdBy: redemptionCode.createdBy,
        createdAt: redemptionCode.createdAt,
    })
    .from(redemptionCode)
    .where(whereClause)
    .orderBy(desc(redemptionCode.createdAt));
    return { items, total: items.length };
}

export async function getCodeByString(codeStr: string) {
    const [row] = await db.select()
        .from(redemptionCode)
        .where(eq(redemptionCode.code, codeStr.toUpperCase().trim()));
    return row ?? null;
}

export async function getCodeById(id: string) {
    const [row] = await db.select()
        .from(redemptionCode)
        .where(eq(redemptionCode.id, id));
    return row ?? null;
}

export async function updateCodeActive(id: string, isActive: boolean) {
    const [row] = await db.update(redemptionCode)
        .set({ isActive })
        .where(eq(redemptionCode.id, id))
        .returning();
    return row ?? null;
}
