import { json, type RequestHandler } from '@sveltejs/kit';
import { getTransactionHistory } from '$lib/server/credits/credit-service';

export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.session?.user) return json({ error: '请先登录' }, { status: 401 });

    const transactions = await getTransactionHistory(locals.session.user.id);
    return json({ transactions });
};
