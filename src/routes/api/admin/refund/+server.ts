import { json, type RequestHandler } from '@sveltejs/kit';
import { guardAdmin } from '$lib/server/credits/admin';
import { refundRedemption } from '$lib/server/credits/credit-service';

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.session?.user) return json({ error: '请先登录' }, { status: 401 });
    const denied = guardAdmin(locals.session.user.email);
    if (denied) return denied;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return json({ error: '无效的请求格式' }, { status: 400 });
    }

    const { transactionId } = body as { transactionId?: string };
    if (!transactionId) {
        return json({ error: '交易ID不能为空' }, { status: 400 });
    }

    const result = await refundRedemption(transactionId);
    if (!result.success) {
        return json({ error: result.error }, { status: 400 });
    }

    return json({
        message: '退款成功',
        creditsDeducted: result.creditsDeducted,
        newBalance: result.newBalance,
    });
};
