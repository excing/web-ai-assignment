/**
 * Page Header Slot Store
 *
 * 允许页面通过 Svelte 5 snippet 向 AppTopBar 注入自定义内容。
 * 页面在 $effect 中调用 setHeaderSlots() 注入，cleanup 时 clearHeaderSlots()。
 * AppTopBar 从 getter 读取并 {@render} 渲染。
 */

import type { Snippet } from 'svelte';

let _left: Snippet | null = $state(null);
let _center: Snippet | null = $state(null);
let _right: Snippet | null = $state(null);

export function getHeaderLeft(): Snippet | null {
	return _left;
}
export function getHeaderCenter(): Snippet | null {
	return _center;
}
export function getHeaderRight(): Snippet | null {
	return _right;
}

export function setHeaderSlots(slots: {
	left?: Snippet | null;
	center?: Snippet | null;
	right?: Snippet | null;
}): void {
	_left = slots.left ?? null;
	_center = slots.center ?? null;
	_right = slots.right ?? null;
}

export function clearHeaderSlots(): void {
	_left = null;
	_center = null;
	_right = null;
}
