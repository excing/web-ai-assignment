import { json, type RequestHandler } from '@sveltejs/kit';
import { getBalance } from '$lib/server/credits/credit-service';

export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.session?.user) return json({ error: '请先登录' }, { status: 401 });

    const balance = await getBalance(locals.session.user.id);
    return json({ balance });
};
