import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { aiProxy } from '$lib/server/db/schema';
import { encrypt } from '$lib/server/crypto';
import { desc } from 'drizzle-orm';
import { parsePagination } from '$lib/config/constants';
import { errorResponse, ValidationError } from '$lib/server/errors';

// 获取所有 Proxy 列表
export const GET: RequestHandler = async ({ url }) => {
    try {
        const { limit, offset } = parsePagination(url);

        const proxies = await db
            .select({
                id: aiProxy.id,
                name: aiProxy.name,
                provider: aiProxy.provider,
                baseUrl: aiProxy.baseUrl,
                // 不返回 apiKey 明文
                models: aiProxy.models,
                isActive: aiProxy.isActive,
                priority: aiProxy.priority,
                healthStatus: aiProxy.healthStatus,
                unhealthyCount: aiProxy.unhealthyCount,
                lastError: aiProxy.lastError,
                lastErrorAt: aiProxy.lastErrorAt,
                metadata: aiProxy.metadata,
                createdAt: aiProxy.createdAt,
                updatedAt: aiProxy.updatedAt,
            })
            .from(aiProxy)
            .orderBy(desc(aiProxy.priority))
            .limit(limit)
            .offset(offset);

        // 总数查询
        const allRows = await db
            .select({ id: aiProxy.id })
            .from(aiProxy);
        const total = allRows.length;

        return json({ proxies, total, limit, offset });
    } catch (error) {
        return errorResponse(error, '获取失败');
    }
};

// 创建 Proxy
export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const { name, provider, baseUrl, apiKey, models, priority, isActive } = body;

        if (!name || !provider || !baseUrl || !apiKey) {
            return errorResponse(new ValidationError('请填写所有必填字段（名称、Provider、Base URL、API Key）'));
        }

        const validProviders = ['openai', 'anthropic', 'google'];
        if (!validProviders.includes(provider)) {
            return errorResponse(new ValidationError(`Provider 必须是 ${validProviders.join(', ')} 之一`));
        }

        const proxyId = `proxy-${Date.now()}`;
        const encryptedApiKey = encrypt(apiKey);

        const [newProxy] = await db
            .insert(aiProxy)
            .values({
                id: proxyId,
                name,
                provider,
                baseUrl,
                apiKey: encryptedApiKey,
                models: Array.isArray(models) ? models : [],
                priority: priority !== undefined ? Number(priority) : 0,
                isActive: isActive !== undefined ? Boolean(isActive) : true,
            })
            .returning();

        // 返回时不包含加密后的 apiKey
        const { apiKey: _, ...proxyWithoutKey } = newProxy;

        return json({ success: true, proxy: proxyWithoutKey });
    } catch (error) {
        return errorResponse(error, '创建 Proxy 失败');
    }
};
