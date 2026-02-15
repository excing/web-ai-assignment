/**
 * HTTP 代理支持模块
 *
 * 为 AI SDK 提供者提供可选的 HTTP 代理支持。
 * 通过 HTTP_PROXY 和 PROXY_SITES 环境变量控制代理行为。
 *
 * 规则：
 * - 未设置 HTTP_PROXY → 所有请求直连（不走代理）
 * - 设置 HTTP_PROXY + 未设置 PROXY_SITES 或 PROXY_SITES=* → 全部走代理
 * - 设置 HTTP_PROXY + PROXY_SITES 含模式列表 → 仅匹配的 URL 走代理
 */

import { env } from '$env/dynamic/private';
import { ProxyAgent, fetch as undiciFetch } from 'undici';
import type { Dispatcher } from 'undici';
import { createLogger } from '$lib/server/logger';

const log = createLogger('http-proxy');

// ============================================================================
// PROXY_SITES 模式匹配
// ============================================================================

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 将 PROXY_SITES 的 glob 模式转为正则表达式
 *
 * - *.google.com → 匹配 google.com 及所有子域名
 * - api.openai.com → 精确匹配
 * - * → 匹配所有
 */
function globToRegex(pattern: string): RegExp {
	const trimmed = pattern.trim();

	if (trimmed === '*') {
		return /^.*$/;
	}

	// *.domain.com → 匹配 domain.com 本身和所有子域名
	if (trimmed.startsWith('*.')) {
		const domain = trimmed.slice(2);
		const escaped = escapeRegex(domain);
		return new RegExp(`^([a-zA-Z0-9-]+\\.)*${escaped}$`, 'i');
	}

	// 精确匹配
	return new RegExp(`^${escapeRegex(trimmed)}$`, 'i');
}

/**
 * 解析 PROXY_SITES 环境变量
 *
 * @returns 正则数组，或 null 表示"全部匹配"
 */
function parseProxySites(proxySites: string | undefined): RegExp[] | null {
	if (!proxySites || proxySites.trim() === '' || proxySites.trim() === '*') {
		return null; // 全部匹配
	}

	const patterns = proxySites
		.split(',')
		.map((p) => p.trim())
		.filter((p) => p.length > 0);

	if (patterns.length === 0) {
		return null;
	}

	return patterns.map(globToRegex);
}

// ============================================================================
// 懒初始化缓存
// ============================================================================

let _compiledPatterns: RegExp[] | null | undefined;
let _patternsInitialized = false;

function getCompiledPatterns(): RegExp[] | null {
	if (!_patternsInitialized) {
		_compiledPatterns = parseProxySites(env.PROXY_SITES);
		_patternsInitialized = true;

		if (_compiledPatterns) {
			log.info('PROXY_SITES 模式已编译', {
				patterns: env.PROXY_SITES,
				count: _compiledPatterns.length
			});
		} else {
			log.info('PROXY_SITES 未设置或为通配符，代理将应用于所有请求');
		}
	}
	return _compiledPatterns ?? null;
}

let _proxyAgent: Dispatcher | null = null;

function getProxyAgent(): Dispatcher | null {
	const proxyUrl = env.HTTP_PROXY;
	if (!proxyUrl) return null;

	if (!_proxyAgent) {
		_proxyAgent = new ProxyAgent(proxyUrl);
		log.info('HTTP 代理已初始化', { proxy: proxyUrl });
	}

	return _proxyAgent;
}

// ============================================================================
// 公开接口
// ============================================================================

/**
 * 判断给定 URL 是否应该走代理
 */
export function shouldProxy(url: string): boolean {
	const proxyUrl = env.HTTP_PROXY;
	if (!proxyUrl) {
		return false;
	}

	let hostname: string;
	try {
		hostname = new URL(url).hostname;
	} catch {
		log.warn('无法解析 URL，跳过代理', { url });
		return false;
	}

	const patterns = getCompiledPatterns();

	// patterns 为 null → 全部走代理
	if (patterns === null) {
		return true;
	}

	return patterns.some((regex) => regex.test(hostname));
}

/**
 * 为 AI SDK 提供者创建带代理的 fetch 函数
 *
 * @param targetBaseUrl AI 提供者的 baseURL（如 https://api.openai.com/v1）
 * @returns 自定义 fetch（走代理），或 undefined（直连，SDK 用默认 fetch）
 */
export function createProxiedFetch(
	targetBaseUrl: string
): typeof globalThis.fetch | undefined {
	if (!shouldProxy(targetBaseUrl)) {
		return undefined;
	}

	const agent = getProxyAgent();
	if (!agent) {
		return undefined;
	}

	log.debug('已为目标创建代理 fetch', { targetBaseUrl });

	const proxiedFetch: typeof globalThis.fetch = (input, init) => {
		return undiciFetch(input as Parameters<typeof undiciFetch>[0], {
			...init,
			dispatcher: agent
		} as Parameters<typeof undiciFetch>[1]) as unknown as Promise<Response>;
	};

	return proxiedFetch;
}
