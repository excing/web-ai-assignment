/**
 * Image Gen Task Store — 响应式状态 + 持久化编排
 *
 * 替代旧 TaskManager 单例，拆分为：
 * - task-store (本文件): 响应式状态、持久化、生命周期编排
 * - task-queue: 并发调度
 * - task-api: 纯 API 调用
 *
 * 关键改进：每个 task 独立存为一行 (putImageGenTask)，不再整体 JSON 序列化。
 */

import { toast } from 'svelte-sonner';
import { refreshCurrentUser, getCurrentUser } from '$lib/stores/auth.svelte';
import { fetchCreditBalance } from '$lib/stores/credits.svelte';
import { generateUUID } from '$lib/utils/uuid';
import { IMAGE_GEN, type AspectRatio } from '$lib/config/constants';
import type { MediaResource } from '$lib/types/media';
import {
	putImageGenTask,
	getImageGenTasksByUser,
	updateImageGenTask,
	deleteImageGenTask as dbDeleteTask,
	deleteImageGenTasksByUser,
	putBlob,
	getBlob,
	deleteBlobsByOwner,
	IDB_PREFIX,
	type ImageGenTaskRecord,
	type BlobRecord,
} from '$lib/stores/db';
import { callImageGenApi } from './task-api';
import { createTaskQueue } from './task-queue.svelte';
import { createTrackedObjectUrl, revokeAllObjectUrls } from '$lib/composables/use-object-urls.svelte';
import { urlToBlob } from '$lib/utils/blob';
import { openGallery } from '$lib/stores/gallery.svelte';

// ── In-memory task representation ──

export interface GenerationTask {
	id: string;
	prompt: string;
	status: 'pending' | 'loading' | 'success' | 'error';
	mediaResources: MediaResource[];
	attachedFiles?: File[];
	attachedPreviews?: string[];
	aspectRatio?: AspectRatio;
	featureKey?: string;
	error?: string;
	createdAt: number;
	completedAt?: number;
}

// ── TaskManager (singleton) ──

class TaskManager {
	tasks = $state<GenerationTask[]>([]);

	private historyLoaded = false;
	private currentUserId: string | null = null;
	private queue = createTaskQueue(3);

	constructor() {
		this.queue.bind({
			getPendingTaskIds: () => this.tasks.filter((t) => t.status === 'pending').map((t) => t.id),
			onTaskStart: (id) => this.executeTask(id),
			onTaskComplete: () => {},
		});
	}

	private getUserId(): string | null {
		return getCurrentUser()?.id ?? null;
	}

	// ── Load from DB ──

	async loadFromHistory(): Promise<void> {
		const userId = this.getUserId();
		if (!userId) return;

		if (this.currentUserId !== userId) {
			this.historyLoaded = false;
			this.tasks = [];
		}

		if (this.historyLoaded) return;
		this.historyLoaded = true;
		this.currentUserId = userId;

		try {
			const records = await getImageGenTasksByUser(userId);
			if (records.length > 0) {
				this.tasks = await Promise.all(records.map((r) => recordToTask(r)));
				this.queue.kick();
			}
		} catch (err) {
			console.warn('Failed to load image-gen history:', err);
		}
	}

	// ── Create ──

	createTask(prompt: string, files?: File[], aspectRatio?: AspectRatio, featureKey?: string): string {
		const userId = this.getUserId();
		const id = generateUUID();
		const validFiles = files?.filter((f) => f.size > 0) || [];

		const task: GenerationTask = {
			id,
			prompt: prompt || (validFiles.length > 0 ? '基于参考图片生成' : ''),
			status: 'pending',
			mediaResources: [],
			attachedFiles: validFiles.length > 0 ? validFiles : undefined,
			aspectRatio: validFiles.length > 1 ? (aspectRatio ?? IMAGE_GEN.DEFAULT_ASPECT_RATIO) : undefined,
			featureKey,
			createdAt: Date.now(),
		};

		// Async preview generation (non-blocking)
		if (validFiles.length > 0) {
			Promise.all(validFiles.map((f) => fileToDataUrl(f))).then((previews) => {
				this.tasks = this.tasks.map((t) => (t.id === id ? { ...t, attachedPreviews: previews } : t));
				// Persist previews
				if (userId) this.persistTask(id);
			});
		}

		this.tasks = [task, ...this.tasks];

		// Persist immediately (individual row)
		if (userId) {
			taskToRecord(task, userId).then((record) => putImageGenTask(record).catch(console.warn));
		}

		this.queue.kick();
		return id;
	}

	// ── Execute ──

	private async executeTask(id: string) {
		this.updateStatus(id, 'loading');

		const task = this.tasks.find((t) => t.id === id);
		if (!task) {
			this.queue.taskFinished(id);
			return;
		}

		try {
			const mediaResources = await callImageGenApi(
				task.prompt,
				task.attachedFiles,
				task.aspectRatio,
				task.featureKey,
			);

			this.tasks = this.tasks.map((t) =>
				t.id === id
					? { ...t, status: 'success' as const, mediaResources, completedAt: Date.now() }
					: t,
			);
			this.persistTask(id);

			const previews: MediaResource[] = (task.attachedPreviews || []).map((p, i) => ({
				type: 'image' as const,
				data: p,
				filename: `参考图 ${i + 1}`,
			}));
			const allMedia = [...previews, ...mediaResources];

			toast.success('图片生成完成', {
				description: `生成了 ${mediaResources.length} 个媒体资源`,
				action: allMedia.length > 0
					? {
							label: '查看',
							onClick: () => openGallery(allMedia, previews.length),
						}
					: undefined,
			});

			Promise.all([
				refreshCurrentUser().catch(console.warn),
				fetchCreditBalance().catch(console.warn),
			]);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : '生成失败';
			this.tasks = this.tasks.map((t) =>
				t.id === id
					? { ...t, status: 'error' as const, error: errorMsg, completedAt: Date.now() }
					: t,
			);
			this.persistTask(id);
			toast.error('图片生成失败', { description: errorMsg });
		} finally {
			this.queue.taskFinished(id);
		}
	}

	// ── Mutations ──

	deleteTask(id: string) {
		this.tasks = this.tasks.filter((t) => t.id !== id);
		dbDeleteTask(id)
			.then(() => deleteBlobsByOwner(id))
			.catch(console.warn);
	}

	clearCompleted() {
		const toRemove = this.tasks.filter((t) => t.status === 'success' || t.status === 'error');
		this.tasks = this.tasks.filter((t) => t.status === 'pending' || t.status === 'loading');

		for (const task of toRemove) {
			dbDeleteTask(task.id)
				.then(() => deleteBlobsByOwner(task.id))
				.catch(console.warn);
		}

		if (this.tasks.length === 0) {
			const userId = this.getUserId();
			if (userId) {
				deleteImageGenTasksByUser(userId)
					.then((ids) => Promise.all(ids.map((id) => deleteBlobsByOwner(id))))
					.catch(console.warn);
			}
		}
	}

	retryTask(id: string) {
		const task = this.tasks.find((t) => t.id === id);
		if (task && task.status === 'error') {
			this.updateStatus(id, 'pending');
			this.queue.kick();
		}
	}

	get stats() {
		return {
			total: this.tasks.length,
			pending: this.tasks.filter((t) => t.status === 'pending').length,
			loading: this.tasks.filter((t) => t.status === 'loading').length,
			success: this.tasks.filter((t) => t.status === 'success').length,
			error: this.tasks.filter((t) => t.status === 'error').length,
		};
	}

	// ── Internal helpers ──

	private updateStatus(id: string, status: GenerationTask['status']) {
		this.tasks = this.tasks.map((t) => (t.id === id ? { ...t, status } : t));
		this.persistTask(id);
	}

	private persistTask(id: string) {
		const userId = this.getUserId();
		if (!userId) return;
		const task = this.tasks.find((t) => t.id === id);
		if (!task) return;
		taskToRecord(task, userId)
			.then((record) => updateImageGenTask(id, record))
			.catch(console.warn);
	}
}

export { revokeAllObjectUrls as revokeImageGenObjectUrls };

export const taskManager = new TaskManager();

// ── Serialization helpers ──

function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

async function taskToRecord(task: GenerationTask, userId: string): Promise<ImageGenTaskRecord> {
	// Serialize mediaResources — extract data/blob URLs to blobs store
	const serializedMedia: MediaResource[] = [];
	for (const res of task.mediaResources) {
		if (!res.data || res.data.startsWith(IDB_PREFIX)) {
			serializedMedia.push(res);
			continue;
		}
		if (res.data.startsWith('data:') || res.data.startsWith('blob:')) {
			try {
				const blob = await urlToBlob(res.data);
				const blobId = generateUUID();
				const record: BlobRecord = {
					id: blobId,
					ownerId: task.id,
					ownerType: 'image-gen-task',
					data: blob,
					mediaType: res.mimeType || blob.type,
					filename: res.filename || null,
				};
				await putBlob(record);
				serializedMedia.push({ ...res, data: IDB_PREFIX + blobId });
			} catch {
				serializedMedia.push(res);
			}
		} else {
			serializedMedia.push(res);
		}
	}

	// Serialize attachedFiles → blob refs
	const fileRefs: string[] = [];
	if (task.attachedFiles) {
		for (const file of task.attachedFiles) {
			const blobId = generateUUID();
			const record: BlobRecord = {
				id: blobId,
				ownerId: task.id,
				ownerType: 'image-gen-task',
				data: file,
				mediaType: file.type,
				filename: file.name,
			};
			await putBlob(record);
			fileRefs.push(IDB_PREFIX + blobId);
		}
	}

	// Serialize attachedPreviews → blob refs
	const previewRefs: string[] = [];
	if (task.attachedPreviews) {
		for (const preview of task.attachedPreviews) {
			if (preview.startsWith(IDB_PREFIX)) {
				previewRefs.push(preview);
				continue;
			}
			if (preview.startsWith('data:') || preview.startsWith('blob:')) {
				try {
					const blob = await urlToBlob(preview);
					const blobId = generateUUID();
					const record: BlobRecord = {
						id: blobId,
						ownerId: task.id,
						ownerType: 'image-gen-task',
						data: blob,
						mediaType: blob.type,
						filename: null,
					};
					await putBlob(record);
					previewRefs.push(IDB_PREFIX + blobId);
				} catch {
					previewRefs.push(preview);
				}
			} else {
				previewRefs.push(preview);
			}
		}
	}

	return {
		id: task.id,
		userId,
		prompt: task.prompt,
		status: task.status,
		mediaResources: JSON.stringify(serializedMedia),
		attachedFileRefs: JSON.stringify(fileRefs),
		attachedPreviewRefs: JSON.stringify(previewRefs),
		aspectRatio: task.aspectRatio ?? null,
		featureKey: task.featureKey ?? null,
		error: task.error ?? null,
		createdAt: task.createdAt,
		completedAt: task.completedAt ?? null,
	};
}

async function recordToTask(record: ImageGenTaskRecord): Promise<GenerationTask> {
	const task: GenerationTask = {
		id: record.id,
		prompt: record.prompt,
		status: record.status === 'loading' ? 'pending' : (record.status as GenerationTask['status']),
		mediaResources: [],
		aspectRatio: (record.aspectRatio as AspectRatio) ?? undefined,
		featureKey: record.featureKey ?? undefined,
		error: record.error ?? undefined,
		createdAt: record.createdAt,
		completedAt: record.completedAt ?? undefined,
	};

	// Restore mediaResources
	const rawMedia: MediaResource[] = JSON.parse(record.mediaResources || '[]');
	task.mediaResources = await Promise.all(
		rawMedia.map(async (res) => {
			if (!res.data.startsWith(IDB_PREFIX)) return res;
			const blobId = res.data.slice(IDB_PREFIX.length);
			try {
				const stored = await getBlob(blobId);
				if (stored) {
					return {
						...res,
						data: createTrackedObjectUrl(stored.data),
						mimeType: stored.mediaType || res.mimeType,
						filename: stored.filename || res.filename,
					};
				}
			} catch (err) {
				console.warn('Failed to restore media resource:', blobId, err);
			}
			return res;
		}),
	);

	// Restore attachedFiles
	const fileRefs: string[] = JSON.parse(record.attachedFileRefs || '[]');
	if (fileRefs.length > 0) {
		const files: File[] = [];
		for (const ref of fileRefs) {
			if (!ref.startsWith(IDB_PREFIX)) continue;
			const blobId = ref.slice(IDB_PREFIX.length);
			try {
				const stored = await getBlob(blobId);
				if (stored) {
					files.push(new File([stored.data], stored.filename || 'file', { type: stored.mediaType }));
				}
			} catch (err) {
				console.warn('Failed to restore attached file:', blobId, err);
			}
		}
		if (files.length > 0) task.attachedFiles = files;
	}

	// Restore attachedPreviews
	const previewRefs: string[] = JSON.parse(record.attachedPreviewRefs || '[]');
	if (previewRefs.length > 0) {
		const previews: string[] = [];
		for (const ref of previewRefs) {
			if (!ref.startsWith(IDB_PREFIX)) {
				previews.push(ref);
				continue;
			}
			const blobId = ref.slice(IDB_PREFIX.length);
			try {
				const stored = await getBlob(blobId);
				if (stored) {
					previews.push(createTrackedObjectUrl(stored.data));
				}
			} catch (err) {
				console.warn('Failed to restore preview:', blobId, err);
			}
		}
		if (previews.length > 0) task.attachedPreviews = previews;
	}

	return task;
}
