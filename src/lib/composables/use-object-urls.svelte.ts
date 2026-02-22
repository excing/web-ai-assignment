/**
 * Object URL 生命周期管理
 *
 * 按 scope 隔离的 object URL 池，避免不同模块之间互相 revoke。
 */

/** 各模块使用的 scope 常量 */
export const URL_SCOPE = {
	CHAT: 'chat',
	IMAGE_GEN: 'image-gen',
} as const;

const pools: Record<string, string[]> = {};

function getPool(scope: string): string[] {
	if (!pools[scope]) pools[scope] = [];
	return pools[scope];
}

/** 创建并跟踪一个 object URL（归属指定 scope） */
export function createTrackedObjectUrl(blob: Blob, scope: string): string {
	const url = URL.createObjectURL(blob);
	getPool(scope).push(url);
	return url;
}

/** 释放指定 scope 的所有 object URL */
export function revokeObjectUrlsByScope(scope: string): void {
	const pool = pools[scope];
	if (!pool) return;
	for (const url of pool) {
		URL.revokeObjectURL(url);
	}
	pools[scope] = [];
}

/** 释放所有 scope 的 object URL（用于登出/用户切换） */
export function revokeAllObjectUrls(): void {
	for (const scope of Object.keys(pools)) {
		revokeObjectUrlsByScope(scope);
	}
}
