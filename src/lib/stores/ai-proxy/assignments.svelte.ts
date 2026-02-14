/**
 * AI Proxy Assignment 管理 Store
 */

import { toast } from 'svelte-sonner';
import { PaginatedState } from '../pagination.svelte';
import { aiProxyProxiesStore } from './proxies.svelte';
import type { AiProxyAssignment, AssignmentFormData } from '$lib/types/admin';

class AiProxyAssignmentsStore {
	// Assignment 分页状态
	assignments = new PaginatedState<AiProxyAssignment>();

	// 对话框状态
	createAssignmentDialogOpen = $state(false);
	editAssignmentDialogOpen = $state(false);

	// Assignment 表单
	assignmentForm = $state<AssignmentFormData>({
		id: '',
		name: '',
		description: '',
		featureKey: '',
		proxyId: '',
		models: '',
		defaultModel: '',
		isActive: true
	});
	savingAssignment = $state(false);

	// ============ 辅助方法 ============

	private parseModelList(input: string): string[] {
		if (!input.trim()) return [];
		return input
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
	}

	patchAssignmentItem(id: string, patch: Partial<AiProxyAssignment>) {
		this.assignments.items = this.assignments.items.map((a) =>
			a.id === id ? { ...a, ...patch } : a
		);
	}

	/**
	 * 静默刷新：不显示 loading skeleton，在后台重新加载数据
	 */
	async silentReloadAssignments() {
		try {
			const params = new URLSearchParams({
				limit: this.assignments.limit.toString(),
				offset: this.assignments.offset.toString()
			});
			const res = await fetch(`/api/admin/ai-proxy/assignments?${params}`);
			if (res.ok) {
				const data = await res.json();
				this.assignments.items = data.assignments;
				this.assignments.total = data.total;
			}
		} catch {
			// 静默失败，不打断用户
		}
	}

	/**
	 * 更新 assignments 中特定 proxy 的健康状态
	 */
	patchAssignmentHealthStatus(proxyId: string, status: string) {
		this.assignments.items = this.assignments.items.map((a) =>
			a.proxyId === proxyId ? { ...a, proxyHealthStatus: status } : a
		);
	}

	// ============ Assignment API ============

	async loadAssignments() {
		this.assignments.loading = true;
		try {
			const params = new URLSearchParams({
				limit: this.assignments.limit.toString(),
				offset: this.assignments.offset.toString()
			});
			const res = await fetch(`/api/admin/ai-proxy/assignments?${params}`);
			if (res.ok) {
				const data = await res.json();
				this.assignments.items = data.assignments;
				this.assignments.total = data.total;
			} else {
				toast.error('加载绑定列表失败');
			}
		} catch (error) {
			console.error('加载绑定列表失败:', error);
			toast.error('加载失败');
		} finally {
			this.assignments.loading = false;
		}
	}

	async createAssignment() {
		if (!this.assignmentForm.name || !this.assignmentForm.featureKey || !this.assignmentForm.proxyId) {
			toast.error('请填写名称、功能标识并选择 Proxy');
			return false;
		}

		this.savingAssignment = true;
		try {
			const res = await fetch('/api/admin/ai-proxy/assignments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: this.assignmentForm.name,
					description: this.assignmentForm.description || null,
					featureKey: this.assignmentForm.featureKey,
					proxyId: this.assignmentForm.proxyId,
					models: this.parseModelList(this.assignmentForm.models),
					defaultModel: this.assignmentForm.defaultModel || null,
					isActive: this.assignmentForm.isActive
				})
			});

			if (res.ok) {
				toast.success('绑定创建成功');
				this.createAssignmentDialogOpen = false;
				this.resetAssignmentForm();
				await this.silentReloadAssignments();
				return true;
			} else {
				const data = await res.json();
				toast.error(data.error || '创建失败');
				return false;
			}
		} catch (error) {
			console.error('创建绑定失败:', error);
			toast.error('创建失败，请重试');
			return false;
		} finally {
			this.savingAssignment = false;
		}
	}

	async updateAssignment() {
		if (!this.assignmentForm.name || !this.assignmentForm.featureKey || !this.assignmentForm.proxyId) {
			toast.error('请填写名称、功能标识并选择 Proxy');
			return false;
		}

		this.savingAssignment = true;
		try {
			const res = await fetch(`/api/admin/ai-proxy/assignments/${this.assignmentForm.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: this.assignmentForm.name,
					description: this.assignmentForm.description || null,
					featureKey: this.assignmentForm.featureKey,
					proxyId: this.assignmentForm.proxyId,
					models: this.parseModelList(this.assignmentForm.models),
					defaultModel: this.assignmentForm.defaultModel || null,
					isActive: this.assignmentForm.isActive
				})
			});

			if (res.ok) {
				const data = await res.json();
				const updated = data.assignment;
				const proxy = aiProxyProxiesStore.proxies.items.find((p) => p.id === updated.proxyId);
				this.patchAssignmentItem(this.assignmentForm.id, {
					name: updated.name,
					description: updated.description,
					featureKey: updated.featureKey,
					proxyId: updated.proxyId,
					models: updated.models,
					defaultModel: updated.defaultModel,
					isActive: updated.isActive,
					updatedAt: updated.updatedAt,
					...(proxy ? {
						proxyName: proxy.name,
						proxyProvider: proxy.provider,
						proxyHealthStatus: proxy.healthStatus,
					} : {})
				});
				toast.success('绑定更新成功');
				this.editAssignmentDialogOpen = false;
				this.resetAssignmentForm();
				return true;
			} else {
				const data = await res.json();
				toast.error(data.error || '更新失败');
				return false;
			}
		} catch (error) {
			console.error('更新绑定失败:', error);
			toast.error('更新失败，请重试');
			return false;
		} finally {
			this.savingAssignment = false;
		}
	}

	async deleteAssignment(assignmentId: string) {
		if (!confirm('确定要删除这个绑定吗？')) {
			return false;
		}

		aiProxyProxiesStore.startOperation(assignmentId);

		const index = this.assignments.items.findIndex((a) => a.id === assignmentId);
		if (index === -1) {
			aiProxyProxiesStore.endOperation(assignmentId);
			return false;
		}

		const deletedItem = this.assignments.items[index];
		this.assignments.items = this.assignments.items.filter((a) => a.id !== assignmentId);
		this.assignments.total--;

		try {
			const res = await fetch(`/api/admin/ai-proxy/assignments/${assignmentId}`, {
				method: 'DELETE'
			});

			if (res.ok) {
				toast.success('绑定删除成功');
				return true;
			} else {
				this.assignments.items = [
					...this.assignments.items.slice(0, index),
					deletedItem,
					...this.assignments.items.slice(index)
				];
				this.assignments.total++;
				const data = await res.json();
				toast.error(data.error || '删除失败');
				return false;
			}
		} catch (error) {
			this.assignments.items = [
				...this.assignments.items.slice(0, index),
				deletedItem,
				...this.assignments.items.slice(index)
			];
			this.assignments.total++;
			console.error('删除绑定失败:', error);
			toast.error('删除失败，请重试');
			return false;
		} finally {
			aiProxyProxiesStore.endOperation(assignmentId);
		}
	}

	openEditAssignmentDialog(assignment: AiProxyAssignment) {
		this.assignmentForm = {
			id: assignment.id,
			name: assignment.name,
			description: assignment.description || '',
			featureKey: assignment.featureKey,
			proxyId: assignment.proxyId,
			models: assignment.models?.join(', ') || '',
			defaultModel: assignment.defaultModel || '',
			isActive: assignment.isActive
		};
		this.editAssignmentDialogOpen = true;
	}

	resetAssignmentForm() {
		this.assignmentForm = {
			id: '',
			name: '',
			description: '',
			featureKey: '',
			proxyId: '',
			models: '',
			defaultModel: '',
			isActive: true
		};
		aiProxyProxiesStore.availableModels = [];
		aiProxyProxiesStore.modelTestStatus = new Map();
	}
}

export const aiProxyAssignmentsStore = new AiProxyAssignmentsStore();
