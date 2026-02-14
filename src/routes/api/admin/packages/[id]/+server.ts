import { json, type RequestHandler } from '@sveltejs/kit';
import { guardAdmin } from '$lib/server/credits/admin';
import { updatePackage } from '$lib/server/credits/package-service';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
    if (!locals.session?.user) return json({ error: '请先登录' }, { status: 401 });
    const denied = guardAdmin(locals.session.user.email);
    if (denied) return denied;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return json({ error: '无效的请求格式' }, { status: 400 });
    }

    const { name, credits, price, description, isActive, isVisible } = body as {
        name?: string; credits?: number; price?: number; description?: string; isActive?: boolean; isVisible?: boolean;
    };

    const update: Record<string, unknown> = {};
    if (name !== undefined) {
        if (typeof name !== 'string' || name.trim().length === 0) {
            return json({ error: '套餐名称不能为空' }, { status: 400 });
        }
        update.name = name.trim();
    }
    if (credits !== undefined) {
        if (typeof credits !== 'number' || credits <= 0 || !Number.isInteger(credits)) {
            return json({ error: '积分数量必须为正整数' }, { status: 400 });
        }
        update.credits = credits;
    }
    if (price !== undefined) {
        if (typeof price !== 'number' || price < 0 || !Number.isInteger(price)) {
            return json({ error: '价格必须为非负整数（单位：分）' }, { status: 400 });
        }
        update.price = price;
    }
    if (description !== undefined) update.description = description?.trim() ?? null;
    if (isActive !== undefined) update.isActive = isActive;
    if (isVisible !== undefined) update.isVisible = isVisible;

    const pkg = await updatePackage(params.id!, update);
    if (!pkg) return json({ error: '套餐不存在' }, { status: 404 });

    return json({ package: pkg });
};
