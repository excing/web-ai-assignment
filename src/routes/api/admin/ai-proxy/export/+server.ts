import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { aiProxy, account } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '$lib/server/crypto';
import { verifyPassword } from 'better-auth/crypto';
import { errorResponse, ValidationError, AppError } from '$lib/server/errors';

export const POST: RequestHandler = async ({ request, locals }) => {
    const session = locals.session;
    if (!session?.user) {
        return json({ error: '未登录' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { password } = body;

        if (!password) {
            return errorResponse(new ValidationError('请输入密码'));
        }

        // 验证密码
        const [credentialAccount] = await db
            .select({ password: account.password })
            .from(account)
            .where(
                and(
                    eq(account.userId, session.user.id),
                    eq(account.providerId, 'credential')
                )
            );

        if (!credentialAccount?.password) {
            return errorResponse(
                new AppError('当前账户未设置密码，无法验证身份', 'NO_PASSWORD', 400)
            );
        }

        const valid = await verifyPassword({
            hash: credentialAccount.password,
            password,
        });

        if (!valid) {
            return json({ error: '密码错误' }, { status: 401 });
        }

        // 查询全部 proxy 并解密 API Key
        const proxies = await db
            .select({
                name: aiProxy.name,
                provider: aiProxy.provider,
                baseUrl: aiProxy.baseUrl,
                apiKey: aiProxy.apiKey,
                models: aiProxy.models,
                priority: aiProxy.priority,
                isActive: aiProxy.isActive,
            })
            .from(aiProxy);

        const exportData = {
            version: 1,
            exportedAt: new Date().toISOString(),
            proxies: proxies.map((p) => ({
                name: p.name,
                provider: p.provider,
                baseUrl: p.baseUrl,
                apiKey: decrypt(p.apiKey),
                models: p.models,
                priority: p.priority,
                isActive: p.isActive,
            })),
        };

        return json(exportData);
    } catch (error) {
        return errorResponse(error, '导出配置失败');
    }
};
