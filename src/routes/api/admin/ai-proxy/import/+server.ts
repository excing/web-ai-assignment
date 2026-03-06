import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { aiProxy } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { encrypt } from '$lib/server/crypto';
import { errorResponse, ValidationError } from '$lib/server/errors';
import { AI_PROVIDER } from '$lib/config/constants';

const VALID_PROVIDERS = Object.values(AI_PROVIDER);

function isValidHttpUrl(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    try {
        const u = new URL(value);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

export const POST: RequestHandler = async ({ request }) => {
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
            // 基础字段校验
            if (!p.name || typeof p.name !== 'string' ||
                !p.provider || !p.baseUrl || !p.apiKey ||
                typeof p.apiKey !== 'string') {
                skipped++;
                continue;
            }

            // Provider 白名单（与常量保持同步）
            if (!VALID_PROVIDERS.includes(p.provider)) {
                skipped++;
                continue;
            }

            // baseUrl 必须是合法的 http/https URL（防止 SSRF）
            if (!isValidHttpUrl(p.baseUrl)) {
                skipped++;
                continue;
            }

            // models 必须是字符串数组
            const models: string[] = Array.isArray(p.models)
                ? p.models.filter((m: unknown) => typeof m === 'string' && m.trim().length > 0)
                : [];

            // priority 限制在安全整数范围内
            const rawPriority = Number(p.priority);
            const priority = Number.isFinite(rawPriority)
                ? Math.max(-9999, Math.min(9999, Math.trunc(rawPriority)))
                : 0;

            // 名称去重
            if (existingNames.has(p.name)) {
                skipped++;
                continue;
            }

            const proxyId = crypto.randomUUID();
            const encryptedApiKey = encrypt(p.apiKey);

            await db.insert(aiProxy).values({
                id: proxyId,
                name: p.name,
                provider: p.provider,
                baseUrl: p.baseUrl,
                apiKey: encryptedApiKey,
                models,
                priority,
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
