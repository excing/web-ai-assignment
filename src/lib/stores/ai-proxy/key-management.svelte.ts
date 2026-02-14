/**
 * AI Proxy Key 管理 Store — 密码验证、Key 查看、导入导出
 */

import { toast } from 'svelte-sonner';
import { aiProxyProxiesStore } from './proxies.svelte';

class AiProxyKeyManagementStore {
	// ============ 密码验证 ============

	verifiedPassword = $state<string | null>(null);
	passwordDialogOpen = $state(false);
	pendingAction = $state<'reveal' | 'export' | null>(null);

	// ============ Key 查看 ============

	revealedKeys = $state<Map<string, string>>(new Map());
	revealingKeyId = $state<string | null>(null);
	pendingRevealId = $state<string | null>(null);
	copiedKeyId = $state<string | null>(null);

	// ============ 导入导出 ============

	exporting = $state(false);
	importing = $state(false);

	// ============ Key 查看方法 ============

	getRevealedKey(proxyId: string): string | undefined {
		return this.revealedKeys.get(proxyId);
	}

	async revealApiKey(proxyId: string) {
		// 已缓存 → toggle 显示/隐藏
		if (this.revealedKeys.has(proxyId)) {
			this.revealedKeys.delete(proxyId);
			this.revealedKeys = new Map(this.revealedKeys);
			return;
		}
		// 无缓存密码 → 打开密码对话框
		if (!this.verifiedPassword) {
			this.pendingRevealId = proxyId;
			this.pendingAction = 'reveal';
			this.passwordDialogOpen = true;
			return;
		}
		// 有缓存密码 → 直接请求
		await this.fetchRevealKey(proxyId, this.verifiedPassword);
	}

	async fetchRevealKey(proxyId: string, password: string) {
		this.revealingKeyId = proxyId;
		try {
			const res = await fetch(`/api/admin/ai-proxy/${proxyId}/reveal-key`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password }),
			});
			if (!res.ok) {
				const data = await res.json();
				if (res.status === 401) {
					this.verifiedPassword = null;
					toast.error(data.error || '密码错误');
				} else {
					toast.error(data.error || data.message || '获取 API Key 失败');
				}
				return;
			}
			const data = await res.json();
			this.verifiedPassword = password;
			this.revealedKeys.set(proxyId, data.apiKey);
			this.revealedKeys = new Map(this.revealedKeys);
		} catch {
			toast.error('请求失败，请检查网络');
		} finally {
			this.revealingKeyId = null;
		}
	}

	async copyKey(proxyId: string) {
		const key = this.revealedKeys.get(proxyId);
		if (!key) return;
		try {
			await navigator.clipboard.writeText(key);
			this.copiedKeyId = proxyId;
			toast.success('已复制到剪贴板');
			setTimeout(() => { this.copiedKeyId = null; }, 2000);
		} catch {
			toast.error('复制失败');
		}
	}

	// ============ 密码回调分发 ============

	async handlePasswordConfirm(password: string) {
		const action = this.pendingAction;
		this.passwordDialogOpen = false;

		if (action === 'reveal' && this.pendingRevealId) {
			const proxyId = this.pendingRevealId;
			this.pendingRevealId = null;
			this.pendingAction = null;
			await this.fetchRevealKey(proxyId, password);
		} else if (action === 'export') {
			this.pendingAction = null;
			this.verifiedPassword = password;
			await this.doExport(password);
		}
	}

	// ============ 导出 ============

	async handleExport() {
		if (!this.verifiedPassword) {
			this.pendingAction = 'export';
			this.passwordDialogOpen = true;
			return;
		}
		await this.doExport(this.verifiedPassword);
	}

	async doExport(password: string) {
		this.exporting = true;
		try {
			const res = await fetch('/api/admin/ai-proxy/export', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password }),
			});
			if (!res.ok) {
				const data = await res.json();
				if (res.status === 401) {
					this.verifiedPassword = null;
					toast.error(data.error || '密码错误');
				} else {
					toast.error(data.error || data.message || '导出失败');
				}
				return;
			}
			const data = await res.json();
			this.verifiedPassword = password;

			// 触发下载
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			const date = new Date().toISOString().slice(0, 10);
			a.href = url;
			a.download = `ai-proxy-config-${date}.json`;
			a.click();
			URL.revokeObjectURL(url);
			toast.success(`已导出 ${data.proxies.length} 条配置`);
		} catch {
			toast.error('导出失败，请检查网络');
		} finally {
			this.exporting = false;
		}
	}

	// ============ 导入 ============

	async handleImport(file: File) {
		this.importing = true;
		try {
			const text = await file.text();
			let data: unknown;
			try {
				data = JSON.parse(text);
			} catch {
				toast.error('文件格式错误：无法解析 JSON');
				return;
			}

			const obj = data as Record<string, unknown>;
			if (!obj.version || !Array.isArray(obj.proxies)) {
				toast.error('文件格式错误：缺少 version 或 proxies 字段');
				return;
			}

			const res = await fetch('/api/admin/ai-proxy/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ version: obj.version, proxies: obj.proxies }),
			});
			if (!res.ok) {
				const err = await res.json();
				toast.error(err.error || err.message || '导入失败');
				return;
			}
			const result = await res.json();
			const parts: string[] = [];
			if (result.imported > 0) parts.push(`${result.imported} 条已导入`);
			if (result.skipped > 0) parts.push(`${result.skipped} 条已跳过`);
			toast.success(parts.join('，') || '导入完成');
			await aiProxyProxiesStore.loadProxies();
		} catch {
			toast.error('导入失败，请检查文件');
		} finally {
			this.importing = false;
		}
	}
}

export const aiProxyKeyManagementStore = new AiProxyKeyManagementStore();
