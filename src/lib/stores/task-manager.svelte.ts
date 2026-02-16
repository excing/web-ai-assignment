import { toast } from 'svelte-sonner';

export interface MediaResource {
	type: 'image' | 'video' | 'audio' | 'file' | 'url';
	data: string;
	mimeType?: string;
	filename?: string;
	isBase64?: boolean;
}

export interface GenerationTask {
	id: string;
	prompt: string;
	status: 'pending' | 'loading' | 'success' | 'error';
	mediaResources: MediaResource[];
	error?: string;
	createdAt: number;
	completedAt?: number;
}

class TaskManager {
	tasks = $state<GenerationTask[]>([]);
	maxConcurrentTasks = 3;

	private runningTasks = 0;

	/**
	 * 创建新任务
	 */
	createTask(prompt: string): string {
		const task: GenerationTask = {
			id: crypto.randomUUID(),
			prompt,
			status: 'pending',
			mediaResources: [],
			createdAt: Date.now()
		};

		this.tasks = [task, ...this.tasks];
		this.processQueue();
		return task.id;
	}

	/**
	 * 处理任务队列
	 */
	private async processQueue() {
		// 找到待处理的任务
		const pendingTasks = this.tasks.filter((t) => t.status === 'pending');

		// 如果没有待处理任务或已达到并发上限，则返回
		if (pendingTasks.length === 0 || this.runningTasks >= this.maxConcurrentTasks) {
			return;
		}

		// 获取下一个任务
		const task = pendingTasks[0];
		this.runningTasks++;

		// 更新任务状态
		this.updateTaskStatus(task.id, 'loading');

		try {
			// 执行任务
			const result = await this.executeTask(task.prompt);

			// 更新任务结果
			this.updateTaskResult(task.id, result.mediaResources);

			// 通知用户
			toast.success(`图片生成完成`, {
				description: `生成了 ${result.mediaResources.length} 个媒体资源`,
				action: {
					label: '查看',
					onClick: () => {
						// 滚动到任务位置
						const element = document.getElementById(`task-${task.id}`);
						element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
					}
				}
			});
		} catch (error) {
			// 更新任务错误
			const errorMsg = error instanceof Error ? error.message : '生成失败';
			this.updateTaskError(task.id, errorMsg);

			// 通知用户
			toast.error('图片生成失败', {
				description: errorMsg
			});
		} finally {
			this.runningTasks--;
			// 继续处理队列
			this.processQueue();
		}
	}

	/**
	 * 执行任务
	 */
	private async executeTask(prompt: string): Promise<{ mediaResources: MediaResource[] }> {
		const res = await fetch('/api/generate-text', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				messages: [
					{
						role: 'user',
						parts: [
							{
								type: 'text',
								text: prompt
							}
						]
					}
				]
			})
		});

		if (!res.ok) {
			const error = await res.json();
			throw new Error(error.error || '请求失败');
		}

		const result = await res.json();
		return { mediaResources: result.mediaResources || [] };
	}

	/**
	 * 更新任务状态
	 */
	private updateTaskStatus(id: string, status: GenerationTask['status']) {
		this.tasks = this.tasks.map((t) => (t.id === id ? { ...t, status } : t));
	}

	/**
	 * 更新任务结果
	 */
	private updateTaskResult(id: string, mediaResources: MediaResource[]) {
		this.tasks = this.tasks.map((t) =>
			t.id === id
				? { ...t, status: 'success' as const, mediaResources, completedAt: Date.now() }
				: t
		);
	}

	/**
	 * 更新任务错误
	 */
	private updateTaskError(id: string, error: string) {
		this.tasks = this.tasks.map((t) =>
			t.id === id ? { ...t, status: 'error' as const, error, completedAt: Date.now() } : t
		);
	}

	/**
	 * 删除任务
	 */
	deleteTask(id: string) {
		this.tasks = this.tasks.filter((t) => t.id !== id);
	}

	/**
	 * 清空所有已完成的任务
	 */
	clearCompleted() {
		this.tasks = this.tasks.filter((t) => t.status === 'pending' || t.status === 'loading');
	}

	/**
	 * 重试任务
	 */
	retryTask(id: string) {
		const task = this.tasks.find((t) => t.id === id);
		if (task && task.status === 'error') {
			this.updateTaskStatus(id, 'pending');
			this.processQueue();
		}
	}

	/**
	 * 获取统计信息
	 */
	get stats() {
		return {
			total: this.tasks.length,
			pending: this.tasks.filter((t) => t.status === 'pending').length,
			loading: this.tasks.filter((t) => t.status === 'loading').length,
			success: this.tasks.filter((t) => t.status === 'success').length,
			error: this.tasks.filter((t) => t.status === 'error').length
		};
	}
}

// 创建全局单例
export const taskManager = new TaskManager();
