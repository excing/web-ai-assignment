/**
 * AI Proxy 服务
 *
 * 负责根据功能标识获取对应的 AI Proxy 配置，
 * 创建 AI SDK provider 实例，被动健康检查，以及故障转移。
 *
 * 故障转移逻辑（对用户完全透明）：
 * - unhealthyCount 0~4：使用默认渠道
 * - unhealthyCount ≥5 且冷却中：使用备份渠道（如有）
 * - unhealthyCount ≥5 且冷却结束：重试默认渠道
 * - unhealthyCount ≥10（或无备份时 ≥5）：触发应急流程
 */

import { db } from '$lib/server/db';
import { aiProxy, aiProxyAssignment, imageGenTemplate } from '$lib/server/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { decrypt } from '$lib/server/crypto';
import { env } from '$env/dynamic/private';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createLogger } from '$lib/server/logger';
import { createProxiedFetch } from '$lib/server/http-proxy';
import { AI_PROVIDER, HEALTH_STATUS, FAILOVER } from '$lib/config/constants';
import { sendAdminAlert } from '$lib/server/admin-notify';

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
    /** 当前使用的是备份渠道 */
    isBackup: boolean;
    // 计费配置（按功能，与渠道无关）
    billingMode?: string | null;   // 'fixed' | 'dynamic' | null
    inputPer1k?: number | null;
    outputPer1k?: number | null;
    minimum?: number | null;
}

/** 数据库查询到的原始 assignment 行（含 LEFT JOIN 备份渠道） */
interface AssignmentRow {
    assignmentId: string;
    featureKey: string;
    defaultModel: string | null;
    healthStatus: string;
    unhealthyCount: number;
    lastErrorAt: Date | null;
    billingMode: string | null;
    inputPer1k: number | null;
    outputPer1k: number | null;
    minimum: number | null;
    // 默认渠道
    proxyId: string;
    proxyName: string;
    provider: string;
    baseUrl: string;
    apiKey: string;
    proxyIsActive: boolean;
    // 备份渠道（LEFT JOIN，可能为 null）
    backupProxyId: string | null;
    backupModel: string | null;
    backupProxyName: string | null;
    backupProvider: string | null;
    backupBaseUrl: string | null;
    backupApiKey: string | null;
    backupProxyIsActive: boolean | null;
}

interface CacheEntry {
    row: AssignmentRow;
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
 * 获取指定功能的 Proxy 配置（含故障转移逻辑）
 *
 * 渠道选择策略：
 * 1. unhealthyCount < PRIMARY_THRESHOLD → 使用默认渠道
 * 2. unhealthyCount ≥ PRIMARY_THRESHOLD 且 lastErrorAt + 冷却 > 当前时间 → 使用备份渠道
 * 3. unhealthyCount ≥ PRIMARY_THRESHOLD 且冷却结束 → 重试默认渠道
 */
export async function getProxyForFeature(featureKey: string): Promise<ProxyConfig | null> {
    const entry = await getCachedOrFetch(featureKey);
    if (!entry) return null;

    return resolveChannel(entry.row);
}

/**
 * 获取缓存或从数据库查询（单次 LEFT JOIN 同时获取默认+备份渠道）
 */
async function getCachedOrFetch(featureKey: string): Promise<CacheEntry | null> {
    const cached = proxyCache.get(featureKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached;
    }

    const backupProxy = alias(aiProxy, 'backup_proxy');

    // 单次查询：assignment INNER JOIN primary proxy LEFT JOIN backup proxy
    const rows = await db
        .select({
            assignmentId: aiProxyAssignment.id,
            featureKey: aiProxyAssignment.featureKey,
            defaultModel: aiProxyAssignment.defaultModel,
            healthStatus: aiProxyAssignment.healthStatus,
            unhealthyCount: aiProxyAssignment.unhealthyCount,
            lastErrorAt: aiProxyAssignment.lastErrorAt,
            billingMode: aiProxyAssignment.billingMode,
            inputPer1k: aiProxyAssignment.inputPer1k,
            outputPer1k: aiProxyAssignment.outputPer1k,
            minimum: aiProxyAssignment.minimum,
            // 默认渠道
            proxyId: aiProxy.id,
            proxyName: aiProxy.name,
            provider: aiProxy.provider,
            baseUrl: aiProxy.baseUrl,
            apiKey: aiProxy.apiKey,
            proxyIsActive: aiProxy.isActive,
            // 备份渠道（LEFT JOIN，可能为 null）
            backupProxyId: aiProxyAssignment.backupProxyId,
            backupModel: aiProxyAssignment.backupModel,
            backupProxyName: backupProxy.name,
            backupProvider: backupProxy.provider,
            backupBaseUrl: backupProxy.baseUrl,
            backupApiKey: backupProxy.apiKey,
            backupProxyIsActive: backupProxy.isActive,
        })
        .from(aiProxyAssignment)
        .innerJoin(aiProxy, eq(aiProxyAssignment.proxyId, aiProxy.id))
        .leftJoin(backupProxy, eq(aiProxyAssignment.backupProxyId, backupProxy.id))
        .where(
            and(
                eq(aiProxyAssignment.featureKey, featureKey),
                eq(aiProxyAssignment.isActive, true),
                eq(aiProxy.isActive, true),
            )
        )
        .orderBy(desc(aiProxy.priority))
        .limit(1);

    if (rows.length === 0) return null;

    const entry: CacheEntry = { row: rows[0], timestamp: Date.now() };
    proxyCache.set(featureKey, entry);
    return entry;
}

/**
 * 根据健康状态决定使用默认还是备份渠道
 */
function resolveChannel(row: AssignmentRow): ProxyConfig | null {
    const { unhealthyCount, lastErrorAt } = row;
    const now = Date.now();
    const isCoolingDown = lastErrorAt && (now - lastErrorAt.getTime()) < FAILOVER.COOLDOWN_MS;
    const hasActiveBackup = !!(row.backupProxyId && row.backupProxyName && row.backupProxyIsActive);

    // 情况 1：默认渠道健康（或失败次数不足阈值）
    if (unhealthyCount < FAILOVER.PRIMARY_THRESHOLD) {
        return buildConfig(row, false);
    }

    // 情况 2：默认渠道失败达到阈值
    if (isCoolingDown) {
        // 冷却中 → 使用备份渠道（如有且可用）
        if (hasActiveBackup) {
            return buildBackupConfig(row);
        }
        // 无备份渠道但还在冷却 → 仍使用默认渠道（虽然不健康）
        return buildConfig(row, false);
    }

    // 情况 3：冷却结束 → 重试默认渠道
    return buildConfig(row, false);
}

/**
 * 构建默认渠道 ProxyConfig
 */
function buildConfig(row: AssignmentRow, isBackup: boolean): ProxyConfig | null {
    try {
        return {
            proxyId: row.proxyId,
            proxyName: row.proxyName,
            provider: row.provider,
            baseUrl: row.baseUrl,
            apiKey: decrypt(row.apiKey),
            model: row.defaultModel || '',
            assignmentId: row.assignmentId,
            isBackup,
            billingMode: row.billingMode,
            inputPer1k: row.inputPer1k,
            outputPer1k: row.outputPer1k,
            minimum: row.minimum,
        };
    } catch (error) {
        log.error('解密默认渠道 API Key 失败', error instanceof Error ? error : new Error(String(error)), { proxyName: row.proxyName });
        return null;
    }
}

/**
 * 构建备份渠道 ProxyConfig（计费配置来自 assignment，与渠道无关）
 */
function buildBackupConfig(row: AssignmentRow): ProxyConfig | null {
    try {
        return {
            proxyId: row.backupProxyId!,
            proxyName: row.backupProxyName!,
            provider: row.backupProvider!,
            baseUrl: row.backupBaseUrl!,
            apiKey: decrypt(row.backupApiKey!),
            model: row.backupModel || '',
            assignmentId: row.assignmentId,
            isBackup: true,
            // 计费配置始终来自 assignment（按功能计费）
            billingMode: row.billingMode,
            inputPer1k: row.inputPer1k,
            outputPer1k: row.outputPer1k,
            minimum: row.minimum,
        };
    } catch (error) {
        log.error('解密备份渠道 API Key 失败', error instanceof Error ? error : new Error(String(error)), { proxyName: row.backupProxyName });
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
        isBackup: false,
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
    const fetch = createProxiedFetch(baseUrl);

    switch (provider) {
        case 'openai': {
            const openai = createOpenAI({ baseURL: baseUrl, apiKey, fetch });
            return openai.chat(model);
        }
        case 'anthropic': {
            const anthropic = createAnthropic({ baseURL: baseUrl, apiKey, fetch });
            return anthropic(model);
        }
        case 'google': {
            const google = createGoogleGenerativeAI({ baseURL: baseUrl, apiKey, fetch });
            return google(model);
        }
        default: {
            // 未知 provider 按 OpenAI 兼容接口处理
            const fallback = createOpenAI({ baseURL: baseUrl, apiKey, fetch });
            return fallback.chat(model);
        }
    }
}

// ============================================================================
// 被动健康检查（含故障转移 & 应急流程）
// ============================================================================

/**
 * 记录 Assignment 请求成功
 *
 * - 使用备份渠道成功：将 unhealthyCount 重置回 PRIMARY_THRESHOLD（单次条件 UPDATE）
 * - 默认渠道成功（冷却结束后重试）：全部重置为 0
 */
export async function reportAssignmentSuccess(assignmentId: string, isBackup: boolean): Promise<void> {
    if (assignmentId === '__env_fallback__') return;

    try {
        if (isBackup) {
            // 备份渠道成功：单次条件 UPDATE，仅在 unhealthyCount > PRIMARY_THRESHOLD 时重置
            // 无需先 SELECT 再判断，WHERE 条件保证幂等
            await db
                .update(aiProxyAssignment)
                .set({
                    unhealthyCount: FAILOVER.PRIMARY_THRESHOLD,
                    updatedAt: new Date()
                })
                .where(
                    and(
                        eq(aiProxyAssignment.id, assignmentId),
                        sql`${aiProxyAssignment.unhealthyCount} > ${FAILOVER.PRIMARY_THRESHOLD}`
                    )
                );
        } else {
            // 默认渠道成功：仅在不健康时才重置（避免对健康渠道的无效写入）
            await db
                .update(aiProxyAssignment)
                .set({
                    healthStatus: HEALTH_STATUS.HEALTHY,
                    unhealthyCount: 0,
                    lastError: '',
                    lastErrorAt: null,
                    updatedAt: new Date()
                })
                .where(
                    and(
                        eq(aiProxyAssignment.id, assignmentId),
                        sql`${aiProxyAssignment.unhealthyCount} > 0`
                    )
                );
        }

        invalidateProxyCache();
    } catch (error) {
        log.error('更新 Assignment 健康状态失败', error instanceof Error ? error : new Error(String(error)), { assignmentId });
    }
}

/**
 * 记录 Assignment 请求失败
 *
 * 根据 unhealthyCount 触发不同行为：
 * - < PRIMARY_THRESHOLD: 累积默认渠道失败
 * - = PRIMARY_THRESHOLD（首次达到）: 切换到备份或触发应急
 * - PRIMARY_THRESHOLD ~ EMERGENCY_THRESHOLD: 累积备份渠道失败
 * - = EMERGENCY_THRESHOLD: 触发应急流程
 */
export async function reportAssignmentFailure(assignmentId: string, errorMessage: string, isBackup: boolean): Promise<void> {
    if (assignmentId === '__env_fallback__') return;

    try {
        const [updated] = await db
            .update(aiProxyAssignment)
            .set({
                unhealthyCount: sql`${aiProxyAssignment.unhealthyCount} + 1`,
                healthStatus: sql`CASE WHEN ${aiProxyAssignment.unhealthyCount} + 1 >= ${FAILOVER.PRIMARY_THRESHOLD} THEN ${HEALTH_STATUS.UNHEALTHY} ELSE ${HEALTH_STATUS.HEALTHY} END`,
                lastError: errorMessage.slice(0, 500),
                lastErrorAt: new Date(),
                updatedAt: new Date()
            })
            .where(eq(aiProxyAssignment.id, assignmentId))
            .returning({
                unhealthyCount: aiProxyAssignment.unhealthyCount,
                backupProxyId: aiProxyAssignment.backupProxyId,
                name: aiProxyAssignment.name,
                featureKey: aiProxyAssignment.featureKey,
            });

        if (!updated) return;

        const { unhealthyCount, backupProxyId } = updated;

        // 检查是否需要触发应急（仅在首次到达阈值时触发，避免重复告警）
        const hasBackup = !!backupProxyId;
        const shouldEmergency =
            (!hasBackup && unhealthyCount === FAILOVER.PRIMARY_THRESHOLD) ||
            (hasBackup && unhealthyCount === FAILOVER.EMERGENCY_THRESHOLD);

        if (shouldEmergency) {
            log.error('触发应急流程', {
                assignmentId,
                assignmentName: updated.name,
                unhealthyCount,
                hasBackup,
                isBackup,
            });
            // 异步触发应急，不阻塞当前请求
            triggerEmergency(assignmentId, updated.name, updated.featureKey, errorMessage, hasBackup).catch(err => {
                log.error('应急流程执行失败', err instanceof Error ? err : new Error(String(err)));
            });
        } else if (unhealthyCount >= FAILOVER.PRIMARY_THRESHOLD) {
            log.warn('默认渠道不健康，切换到备份渠道', {
                assignmentId,
                unhealthyCount,
                hasBackup,
            });
        }

        invalidateProxyCache();
    } catch (error) {
        log.error('更新 Assignment 失败状态失败', error instanceof Error ? error : new Error(String(error)), { assignmentId });
    }
}

/**
 * 重置 Assignment 健康状态（Admin 手动恢复）
 */
export async function resetAssignmentHealth(assignmentId: string): Promise<void> {
    await db
        .update(aiProxyAssignment)
        .set({
            healthStatus: HEALTH_STATUS.HEALTHY,
            unhealthyCount: 0,
            lastError: null,
            lastErrorAt: null,
            updatedAt: new Date()
        })
        .where(eq(aiProxyAssignment.id, assignmentId));

    proxyCache.clear();
}

// ============================================================================
// 应急流程
// ============================================================================

/**
 * 触发应急流程：
 * 1. 下线该 Assignment 绑定的所有 image_gen_template
 * 2. 发送管理员邮件告警
 */
async function triggerEmergency(
    assignmentId: string,
    assignmentName: string,
    featureKey: string,
    lastError: string,
    hasBackup: boolean,
): Promise<void> {
    // 1. 下线关联的图片生成模板
    const deactivated = await db
        .update(imageGenTemplate)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(imageGenTemplate.assignmentId, assignmentId))
        .returning({ id: imageGenTemplate.id, name: imageGenTemplate.name });

    log.warn('已下线关联图片生成模板', {
        assignmentId,
        deactivatedCount: deactivated.length,
        templates: deactivated.map(t => t.name),
    });

    // 2. 发送管理员邮件
    const templateList = deactivated.length > 0
        ? deactivated.map(t => `• ${t.name}`).join('\n')
        : '（无关联模板）';

    const backupInfo = hasBackup
        ? '默认渠道和备份渠道均连续失败，已自动下线相关模板。'
        : '该功能未配置备份渠道，默认渠道连续失败后直接触发应急。';

    await sendAdminAlert({
        subject: `[应急] AI 渠道故障 - ${assignmentName}`,
        html: `
            <h2>AI 渠道应急告警</h2>
            <p><strong>功能绑定：</strong>${escapeHtml(assignmentName)}</p>
            <p><strong>功能标识：</strong>${escapeHtml(featureKey)}</p>
            <p><strong>最近错误：</strong>${escapeHtml(lastError)}</p>
            <p>${escapeHtml(backupInfo)}</p>
            <h3>已下线模板（${deactivated.length} 个）：</h3>
            <pre>${escapeHtml(templateList)}</pre>
            <p>请尽快检查 AI 渠道状态并手动恢复。</p>
        `,
    });
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
