/**
 * AI Proxy 管理 Store
 */

import { toast } from 'svelte-sonner';
import { PaginatedState } from '../pagination.svelte';
import { fetchModelList, testModelChat } from './model-testing';
import { aiProxyAssignmentsStore } from './assignments.svelte';
import { aiProxyKeyManagementStore } from './key-management.svelte';
import type { AiProxyItem, ProxyFormData } from '$lib/types/admin';
import { AI_PROVIDER, HEALTH_STATUS } from '$lib/config/constants';

class AiProxyProxiesStore {
	// Proxy 分页状态
	proxies = new PaginatedState<AiProxyItem>();

	// 操作状态
	operatingItems = $state<Set<string>>(new Set());

	// 对话框状态
	createProxyDialogOpen = $state(false);
	editProxyDialogOpen = $state(false);

	// Proxy 表单
	proxyForm = $state<ProxyFormData>({
		id: '',
		name: '',
		provider: AI_PROVIDER.OPENAI,
		baseUrl: '',
		apiKey: '',
		models: '',
		priority: 0,
		isActive: true
	});
	savingProxy = $state(false);

	// 模型列表状态（供对话框中快捷选择使用）
	availableModels = $state<string[]>([]);
	loadingModels = $state(false);

	// 模型测试状态
	modelTestStatus = $state<Map<string, 'testing' | 'success' | 'failed'>>(new Map());

	// ============ 操作状态管理 ============

	isOperating(id: string): boolean {
		return this.operatingItems.has(id);
	}

	startOperation(id: string) {
		this.operatingItems = new Set([...this.operatingItems, id]);
	}

	endOperation(id: string) {
		const newSet = new Set(this.operatingItems);
		newSet.delete(id);
		this.operatingItems = newSet;
	}

	// ============ 辅助方法 ============

	parseModelList(input: string): string[] {
		if (!input.trim()) return [];
		return input
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
	}

	patchProxyItem(id: string, patch: Partial<AiProxyItem>) {
		this.proxies.items = this.proxies.items.map((p) =>
			p.id === id ? { ...p, ...patch } : p
		);
	}

	// ============ Proxy API ============

	async loadProxies() {
		this.proxies.loading = true;
		try {
			const params = new URLSearchParams({
				limit: this.proxies.limit.toString(),
				offset: this.proxies.offset.toString()
			});
			const res = await fetch(`/api/admin/ai-proxy?${params}`);
			if (res.ok) {
				const data = await res.json();
				this.proxies.items = data.proxies;
				this.proxies.total = data.total;
			} else {
				toast.error('加载 Proxy 列表失败');
			}
		} catch (error) {
			console.error('加载 Proxy 列表失败:', error);
			toast.error('加载失败');
		} finally {
			this.proxies.loading = false;
		}
	}

	async createProxy() {
		if (!this.proxyForm.name || !this.proxyForm.baseUrl || !this.proxyForm.apiKey) {
			toast.error('请填写必填字段');
			return false;
		}

		this.savingProxy = true;
		try {
			const models = this.parseModelList(this.proxyForm.models);
			const res = await fetch('/api/admin/ai-proxy', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: this.proxyForm.name,
					provider: this.proxyForm.provider,
					baseUrl: this.proxyForm.baseUrl,
					apiKey: this.proxyForm.apiKey,
					models,
					priority: this.proxyForm.priority,
					isActive: this.proxyForm.isActive
				})
			});

			if (res.ok) {
				const data = await res.json();
				const newProxy: AiProxyItem = data.proxy;
				this.proxies.items = [newProxy, ...this.proxies.items];
				this.proxies.total++;
				toast.success('Proxy 创建成功');
				this.createProxyDialogOpen = false;
				this.resetProxyForm();
				return true;
			} else {
				const data = await res.json();
				toast.error(data.error || '创建失败');
				return false;
			}
		} catch (error) {
			console.error('创建 Proxy 失败:', error);
			toast.error('创建失败，请重试');
			return false;
		} finally {
			this.savingProxy = false;
		}
	}

	async updateProxy() {
		if (!this.proxyForm.name || !this.proxyForm.baseUrl) {
			toast.error('请填写必填字段');
			return false;
		}

		this.savingProxy = true;
		try {
			const body: Record<string, any> = {
				name: this.proxyForm.name,
				provider: this.proxyForm.provider,
				baseUrl: this.proxyForm.baseUrl,
				models: this.parseModelList(this.proxyForm.models),
				priority: this.proxyForm.priority,
				isActive: this.proxyForm.isActive
			};

			if (this.proxyForm.apiKey) {
				body.apiKey = this.proxyForm.apiKey;
			}

			const res = await fetch(`/api/admin/ai-proxy/${this.proxyForm.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (res.ok) {
				const data = await res.json();
				const updatedProxy: AiProxyItem = data.proxy;
				this.patchProxyItem(this.proxyForm.id, updatedProxy);
				aiProxyAssignmentsStore.silentReloadAssignments();
				toast.success('Proxy 更新成功');
				this.editProxyDialogOpen = false;
				this.resetProxyForm();
				return true;
			} else {
				const data = await res.json();
				toast.error(data.error || '更新失败');
				return false;
			}
		} catch (error) {
			console.error('更新 Proxy 失败:', error);
			toast.error('更新失败，请重试');
			return false;
		} finally {
			this.savingProxy = false;
		}
	}

	async deleteProxy(proxyId: string) {
		if (!confirm('确定要删除这个 Proxy 吗？关联的绑定也会被删除。')) {
			return false;
		}

		this.startOperation(proxyId);

		const index = this.proxies.items.findIndex((p) => p.id === proxyId);
		if (index === -1) {
			this.endOperation(proxyId);
			return false;
		}

		const deletedItem = this.proxies.items[index];
		this.proxies.items = this.proxies.items.filter((p) => p.id !== proxyId);
		this.proxies.total--;

		try {
			const res = await fetch(`/api/admin/ai-proxy/${proxyId}`, { method: 'DELETE' });

			if (res.ok) {
				toast.success('Proxy 删除成功');
				aiProxyAssignmentsStore.silentReloadAssignments();
				return true;
			} else {
				this.proxies.items = [
					...this.proxies.items.slice(0, index),
					deletedItem,
					...this.proxies.items.slice(index)
				];
				this.proxies.total++;
				const data = await res.json();
				toast.error(data.error || '删除失败');
				return false;
			}
		} catch (error) {
			this.proxies.items = [
				...this.proxies.items.slice(0, index),
				deletedItem,
				...this.proxies.items.slice(index)
			];
			this.proxies.total++;
			console.error('删除 Proxy 失败:', error);
			toast.error('删除失败，请重试');
			return false;
		} finally {
			this.endOperation(proxyId);
		}
	}

	async resetHealth(proxyId: string) {
		this.startOperation(proxyId);
		const oldProxy = this.proxies.items.find((p) => p.id === proxyId);
		if (oldProxy) {
			this.patchProxyItem(proxyId, {
				healthStatus: HEALTH_STATUS.HEALTHY,
				unhealthyCount: 0,
				lastError: null,
				lastErrorAt: null
			});
			aiProxyAssignmentsStore.patchAssignmentHealthStatus(proxyId, HEALTH_STATUS.HEALTHY);
		}
		try {
			const res = await fetch(`/api/admin/ai-proxy/${proxyId}/reset-health`, { method: 'POST' });

			if (res.ok) {
				toast.success('健康状态已重置');
				return true;
			} else {
				if (oldProxy) {
					this.patchProxyItem(proxyId, {
						healthStatus: oldProxy.healthStatus,
						unhealthyCount: oldProxy.unhealthyCount,
						lastError: oldProxy.lastError,
						lastErrorAt: oldProxy.lastErrorAt
					});
					aiProxyAssignmentsStore.patchAssignmentHealthStatus(proxyId, oldProxy.healthStatus);
				}
				const data = await res.json();
				toast.error(data.error || '重置失败');
				return false;
			}
		} catch (error) {
			if (oldProxy) {
				this.patchProxyItem(proxyId, {
					healthStatus: oldProxy.healthStatus,
					unhealthyCount: oldProxy.unhealthyCount,
					lastError: oldProxy.lastError,
					lastErrorAt: oldProxy.lastErrorAt
				});
				aiProxyAssignmentsStore.patchAssignmentHealthStatus(proxyId, oldProxy.healthStatus);
			}
			console.error('重置健康状态失败:', error);
			toast.error('重置失败，请重试');
			return false;
		} finally {
			this.endOperation(proxyId);
		}
	}

	openEditProxyDialog(proxy: AiProxyItem) {
		this.proxyForm = {
			id: proxy.id,
			name: proxy.name,
			provider: proxy.provider,
			baseUrl: proxy.baseUrl,
			apiKey: aiProxyKeyManagementStore.getRevealedKey(proxy.id) ?? '',
			models: proxy.models.join(', '),
			priority: proxy.priority,
			isActive: proxy.isActive
		};
		this.editProxyDialogOpen = true;
	}

	resetProxyForm() {
		this.proxyForm = {
			id: '',
			name: '',
			provider: AI_PROVIDER.OPENAI,
			baseUrl: '',
			apiKey: '',
			models: '',
			priority: 0,
			isActive: true
		};
		this.availableModels = [];
		this.modelTestStatus = new Map();
	}

	// ============ 模型列表（客户端直连 Provider API） ============

	async fetchModelsFromForm() {
		const { provider, baseUrl, apiKey } = this.proxyForm;
		if (!baseUrl || !apiKey) {
			toast.error('请先填写 Base URL 和 API Key');
			return;
		}

		this.loadingModels = true;
		this.availableModels = [];
		this.modelTestStatus = new Map();
		try {
			const models = await fetchModelList(provider, baseUrl, apiKey);
			this.availableModels = models;
			if (models.length === 0) {
				toast.info('该平台未返回任何模型');
			}
		} catch (error) {
			console.error('获取模型列表失败:', error);
			toast.error(error instanceof Error ? error.message : '获取模型列表失败');
		} finally {
			this.loadingModels = false;
		}
	}

	async testModel(model: string) {
		const { provider, baseUrl, apiKey } = this.proxyForm;
		if (!baseUrl || !apiKey) {
			toast.error('请先填写 Base URL 和 API Key');
			return;
		}

		const newMap = new Map(this.modelTestStatus);
		newMap.set(model, 'testing');
		this.modelTestStatus = newMap;

		try {
			const ok = await testModelChat(provider, baseUrl, apiKey, model);
			const resultMap = new Map(this.modelTestStatus);
			resultMap.set(model, ok ? 'success' : 'failed');
			this.modelTestStatus = resultMap;
		} catch {
			const resultMap = new Map(this.modelTestStatus);
			resultMap.set(model, 'failed');
			this.modelTestStatus = resultMap;
		}
	}

	getProxyModels(proxyId: string): string[] {
		const proxy = this.proxies.items.find((p) => p.id === proxyId);
		return proxy?.models || [];
	}
}

export const aiProxyProxiesStore = new AiProxyProxiesStore();
