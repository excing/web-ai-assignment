import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resetProxyHealth } from '$lib/server/ai-proxy';
import { errorResponse, ValidationError } from '$lib/server/errors';

// 重置 Proxy 健康状态
export const POST: RequestHandler = async ({ params }) => {
    const proxyId = params.id;
    if (!proxyId) {
        return errorResponse(new ValidationError('Proxy ID 不能为空'));
    }

    try {
        await resetProxyHealth(proxyId);
        return json({ success: true, message: '健康状态已重置' });
    } catch (error) {
        return errorResponse(error, '重置失败');
    }
};
