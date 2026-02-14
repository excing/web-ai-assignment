/**
 * AI Proxy 服务
 *
 * 负责根据功能标识获取对应的 AI Proxy 配置，
 * 创建 AI SDK provider 实例，以及被动健康检查。
 */

import { db } from '$lib/server/db';
import { aiProxy, aiProxyAssignment } from '$lib/server/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { decrypt } from '$lib/server/crypto';
import { env } from '$env/dynamic/private';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createLogger } from '$lib/server/logger';
import { AI_PROVIDER, HEALTH_STATUS } from '$lib/config/constants';

const log = createLogger('ai-proxy');
import type { LanguageModelV3 } from '@ai-sdk/provider';

// ============================================================================
// 类型定义
// ============================================================================

export interface ProxyConfig {
    proxyId: string;
    proxyName: string;
    provider: string;
    baseUrl: string;
    apiKey: string; // 已解密
    model: string;
    assignmentId: string;
}

interface InternalProxyConfig extends ProxyConfig {
    _healthStatus: string;
}

interface CacheEntry {
    configs: ProxyConfig[];
    timestamp: number;
}

// ============================================================================
// 缓存
// ============================================================================

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟
const proxyCache = new Map<string, CacheEntry>();

/**
 * 清除指定功能的缓存（Admin 修改配置后调用）
 */
export function invalidateProxyCache(featureKey?: string) {
    if (featureKey) {
        proxyCache.delete(featureKey);
    } else {
        proxyCache.clear();
    }
}

// ============================================================================
// 核心功能
// ============================================================================

/**
 * 获取指定功能的 Proxy 配置
 */
export async function getProxyForFeature(featureKey: string): Promise<ProxyConfig | null> {
    // 检查缓存
    const cached = proxyCache.get(featureKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return selectHealthyProxy(cached.configs);
    }

    // 查询数据库
    const assignments = await db
        .select({
            assignmentId: aiProxyAssignment.id,
            featureKey: aiProxyAssignment.featureKey,
            assignmentModels: aiProxyAssignment.models,
            defaultModel: aiProxyAssignment.defaultModel,
            proxyId: aiProxy.id,
            proxyName: aiProxy.name,
            provider: aiProxy.provider,
            baseUrl: aiProxy.baseUrl,
            apiKey: aiProxy.apiKey,
            proxyModels: aiProxy.models,
            priority: aiProxy.priority,
            healthStatus: aiProxy.healthStatus,
        })
        .from(aiProxyAssignment)
        .innerJoin(aiProxy, eq(aiProxyAssignment.proxyId, aiProxy.id))
        .where(
            and(
                eq(aiProxyAssignment.featureKey, featureKey),
                eq(aiProxyAssignment.isActive, true),
                eq(aiProxy.isActive, true)
            )
        )
        .orderBy(desc(aiProxy.priority));

    if (assignments.length === 0) {
        return null;
    }

    // 构建 ProxyConfig 列表
    const configs: ProxyConfig[] = assignments.map(a => {
        const model = a.defaultModel || '';

        return {
            proxyId: a.proxyId,
            proxyName: a.proxyName,
            provider: a.provider,
            baseUrl: a.baseUrl,
            apiKey: a.apiKey,
            model,
            assignmentId: a.assignmentId,
            _healthStatus: a.healthStatus,
        } as InternalProxyConfig;
    });

    // 写入缓存
    proxyCache.set(featureKey, { configs, timestamp: Date.now() });

    return selectHealthyProxy(configs);
}

/**
 * 从配置列表中选择健康的 Proxy
 */
function selectHealthyProxy(configs: ProxyConfig[]): ProxyConfig | null {
    if (configs.length === 0) return null;

    const healthy = configs.filter(c => (c as InternalProxyConfig)._healthStatus !== 'unhealthy');
    const selected = healthy.length > 0 ? healthy[0] : configs[0];

    try {
        return {
            ...selected,
            apiKey: decrypt(selected.apiKey),
        };
    } catch (error) {
        log.error('解密 Proxy API Key 失败', error instanceof Error ? error : new Error(String(error)), { proxyName: selected.proxyName });
        return null;
    }
}

/**
 * 获取指定功能的 Proxy 配置，无数据库配置时 fallback 到环境变量
 */
export async function getProxyForFeatureWithFallback(featureKey: string): Promise<ProxyConfig> {
    const config = await getProxyForFeature(featureKey);

    if (config) {
        return config;
    }

    // Fallback 到环境变量
    return {
        proxyId: '__env_fallback__',
        proxyName: 'Environment Variables',
        provider: AI_PROVIDER.OPENAI,
        baseUrl: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        apiKey: env.OPENAI_API_KEY || '',
        model: env.OPENAI_MODEL || '',
        assignmentId: '__env_fallback__',
    };
}

// ============================================================================
// Provider 工厂
// ============================================================================

/**
 * 根据 ProxyConfig 创建 AI SDK 的 LanguageModel 实例
 */
export function createModelFromProxy(config: ProxyConfig): LanguageModelV3 {
    const { provider, baseUrl, apiKey, model } = config;

    switch (provider) {
        case 'openai': {
            const openai = createOpenAI({ baseURL: baseUrl, apiKey });
            return openai.chat(model);
        }
        case 'anthropic': {
            const anthropic = createAnthropic({ baseURL: baseUrl, apiKey });
            return anthropic(model);
        }
        case 'google': {
            const google = createGoogleGenerativeAI({ baseURL: baseUrl, apiKey });
            return google(model);
        }
        default: {
            // 未知 provider 按 OpenAI 兼容接口处理
            const fallback = createOpenAI({ baseURL: baseUrl, apiKey });
            return fallback.chat(model);
        }
    }
}

// ============================================================================
// 被动健康检查
// ============================================================================

const UNHEALTHY_THRESHOLD = 3;

/**
 * 记录 Proxy 请求成功
 */
export async function reportProxySuccess(proxyId: string): Promise<void> {
    if (proxyId === '__env_fallback__') return;

    try {
        await db
            .update(aiProxy)
            .set({
                healthStatus: HEALTH_STATUS.HEALTHY,
                unhealthyCount: 0,
                updatedAt: new Date()
            })
            .where(eq(aiProxy.id, proxyId));
    } catch (error) {
        log.error('更新 Proxy 健康状态失败', error instanceof Error ? error : new Error(String(error)), { proxyId });
    }
}

/**
 * 记录 Proxy 请求失败
 */
export async function reportProxyFailure(proxyId: string, errorMessage: string): Promise<void> {
    if (proxyId === '__env_fallback__') return;

    try {
        const [updated] = await db
            .update(aiProxy)
            .set({
                unhealthyCount: sql`${aiProxy.unhealthyCount} + 1`,
                healthStatus: sql`CASE WHEN ${aiProxy.unhealthyCount} + 1 >= ${UNHEALTHY_THRESHOLD} THEN ${HEALTH_STATUS.UNHEALTHY} ELSE ${HEALTH_STATUS.HEALTHY} END`,
                lastError: errorMessage.slice(0, 500),
                lastErrorAt: new Date(),
                updatedAt: new Date()
            })
            .where(eq(aiProxy.id, proxyId))
            .returning({ unhealthyCount: aiProxy.unhealthyCount });

        if (updated && updated.unhealthyCount >= UNHEALTHY_THRESHOLD) {
            log.warn('Proxy 已标记为 unhealthy', { proxyId, unhealthyCount: updated.unhealthyCount });
            proxyCache.clear();
        }
    } catch (error) {
        log.error('更新 Proxy 失败状态失败', error instanceof Error ? error : new Error(String(error)), { proxyId });
    }
}

/**
 * 重置 Proxy 健康状态（Admin 手动恢复）
 */
export async function resetProxyHealth(proxyId: string): Promise<void> {
    await db
        .update(aiProxy)
        .set({
            healthStatus: HEALTH_STATUS.HEALTHY,
            unhealthyCount: 0,
            lastError: null,
            lastErrorAt: null,
            updatedAt: new Date()
        })
        .where(eq(aiProxy.id, proxyId));

    proxyCache.clear();
}
