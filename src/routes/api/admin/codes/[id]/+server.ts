import { json, type RequestHandler } from '@sveltejs/kit';
import { updateCodeActive } from '$lib/server/credits/code-service';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return json({ error: '无效的请求格式' }, { status: 400 });
    }

    const { isActive } = body as { isActive?: boolean };
    if (typeof isActive !== 'boolean') {
        return json({ error: '参数 isActive 必须为布尔值' }, { status: 400 });
    }

    const code = await updateCodeActive(params.id!, isActive);
    if (!code) return json({ error: '兑换码不存在' }, { status: 404 });

    return json({ code });
};
