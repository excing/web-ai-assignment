import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { aiProxyAssignment, aiProxy } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { invalidateProxyCache } from '$lib/server/ai-proxy';
import { parsePagination } from '$lib/config/constants';
import { errorResponse, ValidationError } from '$lib/server/errors';

// 获取所有 Assignment 列表（分页）
export const GET: RequestHandler = async ({ url }) => {
    try {
        const { limit, offset } = parsePagination(url);
        const featureKey = url.searchParams.get('featureKey');

        const backupProxy = alias(aiProxy, 'backup_proxy');

        let query = db
            .select({
                id: aiProxyAssignment.id,
                name: aiProxyAssignment.name,
                description: aiProxyAssignment.description,
                featureKey: aiProxyAssignment.featureKey,
                proxyId: aiProxyAssignment.proxyId,
                defaultModel: aiProxyAssignment.defaultModel,
                isActive: aiProxyAssignment.isActive,
                backupProxyId: aiProxyAssignment.backupProxyId,
                backupModel: aiProxyAssignment.backupModel,
                billingMode: aiProxyAssignment.billingMode,
                inputPer1k: aiProxyAssignment.inputPer1k,
                outputPer1k: aiProxyAssignment.outputPer1k,
                minimum: aiProxyAssignment.minimum,
                healthStatus: aiProxyAssignment.healthStatus,
                unhealthyCount: aiProxyAssignment.unhealthyCount,
                lastError: aiProxyAssignment.lastError,
                lastErrorAt: aiProxyAssignment.lastErrorAt,
                createdAt: aiProxyAssignment.createdAt,
                updatedAt: aiProxyAssignment.updatedAt,
                // 关联的 Proxy 信息
                proxyName: aiProxy.name,
                proxyProvider: aiProxy.provider,
                // 备份 Proxy 名称
                backupProxyName: backupProxy.name,
            })
            .from(aiProxyAssignment)
            .innerJoin(aiProxy, eq(aiProxyAssignment.proxyId, aiProxy.id))
            .leftJoin(backupProxy, eq(aiProxyAssignment.backupProxyId, backupProxy.id));

        if (featureKey) {
            query = query.where(eq(aiProxyAssignment.featureKey, featureKey)) as typeof query;
        }

        const assignments = await query
            .orderBy(desc(aiProxyAssignment.createdAt))
            .limit(limit)
            .offset(offset);

        // 总数查询
        const allRows = await db
            .select({ id: aiProxyAssignment.id })
            .from(aiProxyAssignment);
        const total = allRows.length;

        return json({ assignments, total, limit, offset });
    } catch (error) {
        return errorResponse(error, '获取失败');
    }
};

// 创建 Assignment
export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const { name, description, featureKey, proxyId, defaultModel, isActive, backupProxyId, backupModel, billingMode, inputPer1k, outputPer1k, minimum } = body;

        if (!name || !featureKey || !proxyId) {
            return errorResponse(new ValidationError('请填写名称、功能标识和 Proxy'));
        }

        // 验证 Proxy 存在
        const [proxy] = await db
            .select({ id: aiProxy.id })
            .from(aiProxy)
            .where(eq(aiProxy.id, proxyId));

        if (!proxy) {
            return errorResponse(new ValidationError('指定的 Proxy 不存在'));
        }

        // 验证备份 Proxy 存在（如有）
        if (backupProxyId) {
            const [backupProxy] = await db
                .select({ id: aiProxy.id })
                .from(aiProxy)
                .where(eq(aiProxy.id, backupProxyId));
            if (!backupProxy) {
                return errorResponse(new ValidationError('指定的备份 Proxy 不存在'));
            }
        }

        const assignmentId = `asgn-${Date.now()}`;

        const [newAssignment] = await db
            .insert(aiProxyAssignment)
            .values({
                id: assignmentId,
                name,
                description: description || null,
                featureKey,
                proxyId,
                defaultModel: defaultModel || null,
                isActive: isActive !== undefined ? Boolean(isActive) : true,
                backupProxyId: backupProxyId || null,
                backupModel: backupModel || null,
                billingMode: billingMode || null,
                inputPer1k: inputPer1k != null ? Number(inputPer1k) : null,
                outputPer1k: outputPer1k != null ? Number(outputPer1k) : null,
                minimum: minimum != null ? Number(minimum) : null,
            })
            .returning();

        // 清除缓存
        invalidateProxyCache(featureKey);

        return json({ success: true, assignment: newAssignment });
    } catch (error) {
        return errorResponse(error, '创建 Assignment 失败');
    }
};
