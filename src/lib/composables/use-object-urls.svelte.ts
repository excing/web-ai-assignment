/**
 * Object URL 生命周期管理
 *
 * 跟踪创建的 object URL，提供统一 revoke 能力。
 * 避免内存泄漏，替代原来分散在各 store 中的手动管理。
 */

let urls: string[] = [];

/** 创建并跟踪一个 object URL */
export function createTrackedObjectUrl(blob: Blob): string {
	const url = URL.createObjectURL(blob);
	urls.push(url);
	return url;
}

/** 释放所有跟踪的 object URL */
export function revokeAllObjectUrls(): void {
	for (const url of urls) {
		URL.revokeObjectURL(url);
	}
	urls = [];
}

/** 当前跟踪的 URL 数量（调试用） */
export function trackedUrlCount(): number {
	return urls.length;
}
