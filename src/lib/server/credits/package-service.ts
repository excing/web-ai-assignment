import { db } from '$lib/server/db';
import { creditPackage } from '$lib/server/db/schema';
import { eq, desc, count as countFn } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export interface CreatePackageInput {
    name: string;
    credits: number;
    price: number;
    description?: string;
}

export interface UpdatePackageInput {
    name?: string;
    credits?: number;
    price?: number;
    description?: string | null;
    isActive?: boolean;
    isVisible?: boolean;
}

export async function createPackage(input: CreatePackageInput) {
    const id = randomUUID();
    const [pkg] = await db.insert(creditPackage).values({
        id,
        name: input.name,
        credits: input.credits,
        price: input.price,
        description: input.description ?? null,
    }).returning();
    return pkg;
}

export async function listPackages(
    includeInactive = false,
    pagination?: { limit: number; offset: number },
) {
    const condition = includeInactive ? undefined : eq(creditPackage.isActive, true);

    if (pagination) {
        const { limit, offset } = pagination;
        const [{ total }] = await db
            .select({ total: countFn() })
            .from(creditPackage)
            .where(condition);
        const items = await db.select().from(creditPackage)
            .where(condition)
            .orderBy(desc(creditPackage.createdAt))
            .limit(limit)
            .offset(offset);
        return { items, total };
    }

    const items = await db.select().from(creditPackage)
        .where(condition)
        .orderBy(desc(creditPackage.createdAt));
    return { items, total: items.length };
}

export async function getPackageById(id: string) {
    const [pkg] = await db.select().from(creditPackage).where(eq(creditPackage.id, id));
    return pkg ?? null;
}

export async function updatePackage(id: string, input: UpdatePackageInput) {
    const [pkg] = await db.update(creditPackage)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(creditPackage.id, id))
        .returning();
    return pkg ?? null;
}
