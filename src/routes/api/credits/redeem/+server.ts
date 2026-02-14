import { json, type RequestHandler } from '@sveltejs/kit';
import { redeemCode } from '$lib/server/credits/credit-service';

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.session?.user) return json({ error: '请先登录' }, { status: 401 });

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return json({ error: '无效的请求格式' }, { status: 400 });
    }

    const { code } = body as { code?: string };
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
        return json({ error: '请输入兑换码' }, { status: 400 });
    }

    const result = await redeemCode(locals.session.user.id, code.trim());
    if (!result.success) {
        return json({ error: result.error }, { status: 400 });
    }

    return json({
        message: '兑换成功',
        creditsAdded: result.creditsAdded,
        newBalance: result.newBalance,
    });
};
