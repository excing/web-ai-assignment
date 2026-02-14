import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { aiProxy, account } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '$lib/server/crypto';
import { verifyPassword } from 'better-auth/crypto';
import { errorResponse, ValidationError, NotFoundError, AppError } from '$lib/server/errors';

export const POST: RequestHandler = async ({ params, request, locals }) => {
    const proxyId = params.id;
    if (!proxyId) {
        return errorResponse(new ValidationError('Proxy ID 不能为空'));
    }

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

        // 查找用户的密码账户（email/password 登录方式）
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

        // 验证密码
        const valid = await verifyPassword({
            hash: credentialAccount.password,
            password,
        });

        if (!valid) {
            return json({ error: '密码错误' }, { status: 401 });
        }

        // 获取并解密 API Key
        const [proxy] = await db
            .select({ apiKey: aiProxy.apiKey })
            .from(aiProxy)
            .where(eq(aiProxy.id, proxyId));

        if (!proxy) {
            return errorResponse(new NotFoundError('Proxy 不存在'));
        }

        const decryptedKey = decrypt(proxy.apiKey);

        return json({ apiKey: decryptedKey });
    } catch (error) {
        return errorResponse(error, '获取 API Key 失败');
    }
};
