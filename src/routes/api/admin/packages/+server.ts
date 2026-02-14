import { json, type RequestHandler } from '@sveltejs/kit';
import { guardAdmin } from '$lib/server/credits/admin';
import { createPackage, listPackages } from '$lib/server/credits/package-service';
import { parsePagination } from '$lib/config/constants';

export const GET: RequestHandler = async ({ url, locals }) => {
    if (!locals.session?.user) return json({ error: '请先登录' }, { status: 401 });
    const denied = guardAdmin(locals.session.user.email);
    if (denied) return denied;

    const { limit, offset } = parsePagination(url);
    const { items, total } = await listPackages(true, { limit, offset });
    return json({ packages: items, total, limit, offset });
};

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

    const { name, credits, price, description } = body as {
        name?: string; credits?: number; price?: number; description?: string;
    };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return json({ error: '套餐名称不能为空' }, { status: 400 });
    }
    if (!credits || typeof credits !== 'number' || credits <= 0 || !Number.isInteger(credits)) {
        return json({ error: '积分数量必须为正整数' }, { status: 400 });
    }
    if (price === undefined || price === null || typeof price !== 'number' || price < 0 || !Number.isInteger(price)) {
        return json({ error: '价格必须为非负整数（单位：分）' }, { status: 400 });
    }

    const pkg = await createPackage({
        name: name.trim(),
        credits,
        price,
        description: description?.trim(),
    });
    return json({ package: pkg }, { status: 201 });
};
