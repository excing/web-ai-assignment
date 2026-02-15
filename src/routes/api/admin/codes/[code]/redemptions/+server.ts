import { json, type RequestHandler } from '@sveltejs/kit';
import { getRedemptionsByCode } from '$lib/server/credits/credit-service';
import { getCodeByString } from '$lib/server/credits/code-service';

export const GET: RequestHandler = async ({ params, locals }) => {
    const codeStr = params.code;
    if (!codeStr) return json({ error: '兑换码不能为空' }, { status: 400 });

    const code = await getCodeByString(codeStr);
    if (!code) return json({ error: '兑换码不存在' }, { status: 404 });

    const redemptions = await getRedemptionsByCode(code.id);
    return json({ redemptions });
};
