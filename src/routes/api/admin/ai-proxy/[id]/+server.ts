import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { aiProxy } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { encrypt } from '$lib/server/crypto';
import { invalidateProxyCache } from '$lib/server/ai-proxy';
import { errorResponse, ValidationError, NotFoundError } from '$lib/server/errors';

// 更新 Proxy
export const PUT: RequestHandler = async ({ params, request }) => {
    const proxyId = params.id;
    if (!proxyId) {
        return errorResponse(new ValidationError('Proxy ID 不能为空'));
    }

    try {
        const body = await request.json();
        const { name, provider, baseUrl, apiKey, models, priority, isActive } = body;

        if (!name || !provider || !baseUrl) {
            return errorResponse(new ValidationError('请填写所有必填字段（名称、Provider、Base URL）'));
        }

        const validProviders = ['openai', 'anthropic', 'google'];
        if (!validProviders.includes(provider)) {
            return errorResponse(new ValidationError(`Provider 必须是 ${validProviders.join(', ')} 之一`));
        }

        const updateData: Record<string, any> = {
            name,
            provider,
            baseUrl,
            models: Array.isArray(models) ? models : [],
            priority: priority !== undefined ? Number(priority) : 0,
            isActive: Boolean(isActive),
            updatedAt: new Date()
        };

        // 如果提供了新的 API Key，加密后更新
        if (apiKey) {
            updateData.apiKey = encrypt(apiKey);
        }

        const [updatedProxy] = await db
            .update(aiProxy)
            .set(updateData)
            .where(eq(aiProxy.id, proxyId))
            .returning();

        if (!updatedProxy) {
            return errorResponse(new NotFoundError('Proxy 不存在'));
        }

        // 清除缓存
        invalidateProxyCache();

        const { apiKey: _, ...proxyWithoutKey } = updatedProxy;
        return json({ success: true, proxy: proxyWithoutKey });
    } catch (error) {
        return errorResponse(error, '更新 Proxy 失败');
    }
};

// 删除 Proxy
export const DELETE: RequestHandler = async ({ params }) => {
    const proxyId = params.id;
    if (!proxyId) {
        return errorResponse(new ValidationError('Proxy ID 不能为空'));
    }

    try {
        const [deletedProxy] = await db
            .delete(aiProxy)
            .where(eq(aiProxy.id, proxyId))
            .returning();

        if (!deletedProxy) {
            return errorResponse(new NotFoundError('Proxy 不存在'));
        }

        // 清除缓存
        invalidateProxyCache();

        return json({ success: true, message: 'Proxy 删除成功' });
    } catch (error) {
        return errorResponse(error, '删除 Proxy 失败');
    }
};
