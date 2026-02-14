import { json, type RequestHandler } from '@sveltejs/kit';
import { guardAdmin } from '$lib/server/credits/admin';
import { getRedemptionsByCode } from '$lib/server/credits/credit-service';
import { getCodeByString } from '$lib/server/credits/code-service';

export const GET: RequestHandler = async ({ params, locals }) => {
    if (!locals.session?.user) return json({ error: '请先登录' }, { status: 401 });
    const denied = guardAdmin(locals.session.user.email);
    if (denied) return denied;

    const codeStr = params.code;
    if (!codeStr) return json({ error: '兑换码不能为空' }, { status: 400 });

    const code = await getCodeByString(codeStr);
    if (!code) return json({ error: '兑换码不存在' }, { status: 404 });

    const redemptions = await getRedemptionsByCode(code.id);
    return json({ redemptions });
};
