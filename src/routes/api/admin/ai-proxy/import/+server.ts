import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { aiProxy } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { encrypt } from '$lib/server/crypto';
import { errorResponse, ValidationError } from '$lib/server/errors';

const VALID_PROVIDERS = ['openai', 'anthropic', 'google'];

export const POST: RequestHandler = async ({ request, locals }) => {
    const session = locals.session;
    if (!session?.user) {
        return json({ error: '未登录' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { version, proxies } = body;

        if (!version || !Array.isArray(proxies)) {
            return errorResponse(new ValidationError('无效的导入文件格式'));
        }

        // 获取已有 proxy 名称用于去重
        const existing = await db.select({ name: aiProxy.name }).from(aiProxy);
        const existingNames = new Set(existing.map((p) => p.name));

        let imported = 0;
        let skipped = 0;

        for (const p of proxies) {
            if (!p.name || !p.provider || !p.baseUrl || !p.apiKey) {
                skipped++;
                continue;
            }

            if (!VALID_PROVIDERS.includes(p.provider)) {
                skipped++;
                continue;
            }

            if (existingNames.has(p.name)) {
                skipped++;
                continue;
            }

            const proxyId = `proxy-${Date.now()}-${imported}`;
            const encryptedApiKey = encrypt(p.apiKey);

            await db.insert(aiProxy).values({
                id: proxyId,
                name: p.name,
                provider: p.provider,
                baseUrl: p.baseUrl,
                apiKey: encryptedApiKey,
                models: Array.isArray(p.models) ? p.models : [],
                priority: p.priority !== undefined ? Number(p.priority) : 0,
                isActive: p.isActive !== undefined ? Boolean(p.isActive) : true,
            });

            existingNames.add(p.name);
            imported++;
        }

        return json({ success: true, imported, skipped });
    } catch (error) {
        return errorResponse(error, '导入配置失败');
    }
};
