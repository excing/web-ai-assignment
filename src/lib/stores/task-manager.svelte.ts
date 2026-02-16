import { toast } from 'svelte-sonner';
import { refreshCurrentUser } from './auth.svelte';
import { fetchCreditBalance } from './credits.svelte';


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
	/** 用户上传的参考图片（图生图） */
	attachedFiles?: File[];
	/** 附件预览 URL（base64 data URL，用于任务卡展示） */
	attachedPreviews?: string[];
	error?: string;
	createdAt: number;
	completedAt?: number;
}

class TaskManager {
	tasks = $state<GenerationTask[]>([]);
	maxConcurrentTasks = 3;

	private runningTasks = 0;

	/**
	 * 将 File 转换为 base64 data URL
	 */
	private fileToDataUrl(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	/**
	 * 创建新任务
	 */
	createTask(prompt: string, files?: File[]): string {
		console.log('TaskManager.createTask called with prompt:', prompt, 'files:', files?.length);

		// 生成唯一 ID（兼容不支持 crypto.randomUUID 的环境）
		const id = typeof crypto !== 'undefined' && crypto.randomUUID
			? crypto.randomUUID()
			: `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

		const validFiles = files?.filter((f) => f.size > 0) || [];

		const task: GenerationTask = {
			id,
			prompt: prompt || (validFiles.length > 0 ? '基于参考图片生成' : ''),
			status: 'pending',
			mediaResources: [],
			attachedFiles: validFiles.length > 0 ? validFiles : undefined,
			createdAt: Date.now()
		};

		// 异步生成附件预览（不阻塞任务创建）
		if (validFiles.length > 0) {
			Promise.all(validFiles.map((f) => this.fileToDataUrl(f))).then((previews) => {
				this.tasks = this.tasks.map((t) =>
					t.id === id ? { ...t, attachedPreviews: previews } : t
				);
			});
		}

		console.log('Created task:', task);
		this.tasks = [task, ...this.tasks];
		console.log('Tasks after adding:', this.tasks.length);

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
			// 执行任务（传递附件文件）
			const result = await this.executeTask(task.prompt, task.attachedFiles);

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
	 * 执行任务（支持附件图片的图生图）
	 */
	private async executeTask(
		prompt: string,
		files?: File[]
	): Promise<{ mediaResources: MediaResource[] }> {
		// 构建消息 parts
		const parts: Array<Record<string, unknown>> = [];

		// 添加文本 part
		if (prompt) {
			parts.push({ type: 'text', text: prompt });
		}

		// 将附件文件转为 base64 data URL 并作为 file parts 发送
		if (files && files.length > 0) {
			const fileParts = await Promise.all(
				files.map(async (file) => {
					const dataUrl = await this.fileToDataUrl(file);
					return {
						type: 'file',
						mediaType: file.type,
						filename: file.name,
						url: dataUrl
					};
				})
			);
			parts.push(...fileParts);
		}

		// 确保至少有一个 part
		if (parts.length === 0) {
			parts.push({ type: 'text', text: '生成一张图片' });
		}

		const res = await fetch('/api/generate-text', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				messages: [
					{
						role: 'user',
						parts
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
		// 任务成功后刷新用户信息和积分余额
		Promise.all([
			refreshCurrentUser().catch((err) => {
				console.error('Failed to refresh user info after task completion:', err);
			}),
			fetchCreditBalance().catch((err) => {
				console.error('Failed to fetch credit balance after task completion:', err);
			})
		]);
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
