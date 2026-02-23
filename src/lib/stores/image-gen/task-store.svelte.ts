/**
 * Image Gen Task Store — 响应式状态 + 持久化编排
 *
 * 架构分层：
 * - task-store (本文件): 响应式状态、持久化、生命周期编排
 * - task-queue: 并发调度
 * - task-api: 纯 API 调用
 */

import { toast } from 'svelte-sonner';
import { refreshCurrentUser, getCurrentUser } from '$lib/stores/auth.svelte';
import { fetchCreditBalance } from '$lib/stores/credits.svelte';
import { generateUUID } from '$lib/utils/uuid';
import { IMAGE_GEN, type AspectRatio } from '$lib/config/constants';
import type { MediaResource } from '$lib/types/media';
import {
	putImageGenTask,
	getImageGenTask,
	getImageGenTasksByUser,
	updateImageGenTask,
	deleteImageGenTask as dbDeleteTask,
	deleteImageGenTasksByUser,
	putBlob,
	getBlob,
	getBlobsByOwner,
	deleteBlobsByOwner,
	IDB_PREFIX,
	type ImageGenTaskRecord,
	type BlobRecord,
} from '$lib/stores/db';
import { callImageGenApi } from './task-api';
import { createTaskQueue } from './task-queue.svelte';
import {
	createTrackedObjectUrl,
	revokeObjectUrlsByScope,
	URL_SCOPE,
} from '$lib/composables/use-object-urls.svelte';
import { urlToBlob } from '$lib/utils/blob';
import { openGallery } from '$lib/stores/gallery.svelte';

// ── Types ──

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

/** MediaResource 附带已持久化的 idb:// 引用，供 taskToRecord 直接使用 */
type PersistedMediaResource = MediaResource & { _idbRef?: string };

// ── Blob 持久化/恢复工具 ──

/** 将 Blob 保存到 IndexedDB，返回 idb:// 引用 */
async function saveBlobToIdb(
	data: Blob,
	ownerId: string,
	mediaType?: string,
	filename?: string | null,
): Promise<string> {
	const blobId = generateUUID();
	const record: BlobRecord = {
		id: blobId,
		ownerId,
		ownerType: 'image-gen-task',
		data,
		mediaType: mediaType || data.type,
		filename: filename ?? null,
	};
	await putBlob(record);
	return IDB_PREFIX + blobId;
}

/** 从 idb:// 引用恢复 Blob 记录 */
async function loadBlobFromIdb(idbRef: string): Promise<BlobRecord | null> {
	const blobId = idbRef.slice(IDB_PREFIX.length);
	try {
		return await getBlob(blobId);
	} catch {
		return null;
	}
}

/** 将 idb:// 引用恢复为 object URL（用于显示） */
async function idbRefToObjectUrl(idbRef: string): Promise<string | null> {
	const stored = await loadBlobFromIdb(idbRef);
	if (!stored) return null;
	return createTrackedObjectUrl(stored.data, URL_SCOPE.IMAGE_GEN);
}

/** 下载远程/本地 URL → 持久化到 IndexedDB → 返回显示 URL + idb 引用 */
async function downloadAndPersistMedia(
	taskId: string,
	rawMedia: MediaResource[],
): Promise<PersistedMediaResource[]> {
	return Promise.all(
		rawMedia.map(async (res): Promise<PersistedMediaResource> => {
			const isRemoteOrData =
				res.data.startsWith('http://') ||
				res.data.startsWith('https://') ||
				res.data.startsWith('data:');
			if (!isRemoteOrData) return res;

			try {
				const blob = await urlToBlob(res.data);
				const mimeType = res.mimeType || blob.type;
				const idbRef = await saveBlobToIdb(blob, taskId, mimeType, res.filename);
				const displayUrl = createTrackedObjectUrl(blob, URL_SCOPE.IMAGE_GEN);
				return { ...res, data: displayUrl, mimeType, _idbRef: idbRef };
			} catch (err) {
				console.warn('Failed to download/persist media:', err);
				return res;
			}
		}),
	);
}

// ── TaskManager ──

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

	// ── Load ──

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
				this.tasks = await Promise.all(records.map(recordToTask));
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

		// 异步生成预览（不阻塞创建流程）
		if (validFiles.length > 0) {
			Promise.all(validFiles.map(fileToDataUrl)).then((previews) => {
				this.updateTask(id, { attachedPreviews: previews });
				if (userId) this.persistTask(id);
			});
		}

		this.tasks = [task, ...this.tasks];

		if (userId) {
			taskToRecord(task, userId).then((record) => putImageGenTask(record).catch(console.warn));
		}

		this.queue.kick();
		return id;
	}

	// ── Execute ──

	private async executeTask(id: string) {
		this.updateTask(id, { status: 'loading' });
		this.persistTask(id);

		const task = this.tasks.find((t) => t.id === id);
		if (!task) {
			this.queue.taskFinished(id);
			return;
		}

		try {
			const rawMedia = await callImageGenApi(task.prompt, task.attachedFiles, task.aspectRatio, task.featureKey);
			const mediaResources = await downloadAndPersistMedia(id, rawMedia);

			this.updateTask(id, { status: 'success', mediaResources, completedAt: Date.now() });
			this.persistTask(id);
			this.showCompletionToast(task, mediaResources);

			refreshCurrentUser().catch(console.warn);
			fetchCreditBalance().catch(console.warn);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : '生成失败';
			this.updateTask(id, { status: 'error', error: errorMsg, completedAt: Date.now() });
			this.persistTask(id);
			toast.error('图片生成失败', { description: errorMsg });
		} finally {
			this.queue.taskFinished(id);
		}
	}

	private showCompletionToast(task: GenerationTask, mediaResources: MediaResource[]) {
		const previews: MediaResource[] = (task.attachedPreviews || []).map((p, i) => ({
			type: 'image' as const,
			data: p,
			filename: `参考图 ${i + 1}`,
		}));
		const allMedia = [...previews, ...mediaResources];

		toast.success('图片生成完成', {
			description: `生成了 ${mediaResources.length} 个媒体资源`,
			action: allMedia.length > 0
				? { label: '查看', onClick: () => openGallery(allMedia, previews.length) }
				: undefined,
		});
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
		if (!task || task.status === 'pending' || task.status === 'loading') return;
		this.updateTask(id, { status: 'pending', mediaResources: [], error: undefined, createdAt: Date.now(), completedAt: undefined });
		this.persistTask(id);
		this.queue.kick();
	}

	cloneTask(id: string) {
		const source = this.tasks.find((t) => t.id === id);
		if (!source) return;
		this.createTask(source.prompt, source.attachedFiles, source.aspectRatio, source.featureKey);
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

	// ── Internal ──

	private updateTask(id: string, patch: Partial<GenerationTask>) {
		this.tasks = this.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
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

export function revokeImageGenObjectUrls(): void {
	revokeObjectUrlsByScope(URL_SCOPE.IMAGE_GEN);
}

export const taskManager = new TaskManager();

// ── Serialization: Task ↔ Record ──

function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

/**
 * 将 URL 序列化为 idb:// 引用。
 * 若 res 上已有 _idbRef（executeTask 预持久化），直接使用；
 * 否则将 blob:/data:/http(s): URL 转换为 IndexedDB blob。
 */
async function serializeUrl(url: string, ownerId: string, idbRef?: string, mimeType?: string, filename?: string): Promise<string> {
	if (idbRef) return idbRef;
	if (!url || url.startsWith(IDB_PREFIX)) return url;
	if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) {
		const blob = await urlToBlob(url);
		return saveBlobToIdb(blob, ownerId, mimeType || blob.type, filename);
	}
	return url;
}

async function taskToRecord(task: GenerationTask, userId: string): Promise<ImageGenTaskRecord> {
	// 查询已有记录，复用已持久化的 blob 引用，避免重复写入
	const existing = await getImageGenTask(task.id).catch(() => null);
	const existingFileRefs: string[] = existing ? JSON.parse(existing.attachedFileRefs || '[]') : [];

	// 序列化 mediaResources
	const serializedMedia = await Promise.all(
		task.mediaResources.map(async (res) => {
			const idbRef = (res as PersistedMediaResource)._idbRef;
			try {
				const data = await serializeUrl(res.data, task.id, idbRef, res.mimeType, res.filename);
				return { type: res.type, data, mimeType: res.mimeType, filename: res.filename } as MediaResource;
			} catch {
				return res;
			}
		}),
	);

	// 序列化 attachedFiles（已有 idb 引用则复用）
	let fileRefs: string[] = [];
	if (existingFileRefs.length > 0 && existingFileRefs.every((r) => r.startsWith(IDB_PREFIX))) {
		fileRefs = existingFileRefs;
	} else if (task.attachedFiles) {
		fileRefs = await Promise.all(
			task.attachedFiles.map((f) => saveBlobToIdb(f, task.id, f.type, f.name)),
		);
	}

	return {
		id: task.id,
		userId,
		prompt: task.prompt,
		status: task.status,
		mediaResources: JSON.stringify(serializedMedia),
		attachedFileRefs: JSON.stringify(fileRefs),
		attachedPreviewRefs: '[]', // 预览从 attachedFiles 派生，不再单独存储
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

	// 恢复 mediaResources
	const rawMedia: MediaResource[] = JSON.parse(record.mediaResources || '[]');

	// 检查是否有远程 URL 残留（本地下载失败回退的 https:// 链接）
	const hasRemoteUrls = rawMedia.some(
		(r) => r.data?.startsWith('http://') || r.data?.startsWith('https://'),
	);
	// 预加载该 task 已有的全部 blob，用于匹配修复
	let ownerBlobs: BlobRecord[] = [];
	if (hasRemoteUrls) {
		ownerBlobs = await getBlobsByOwner(record.id).catch(() => []);
	}

	let needsRepersist = false;
	task.mediaResources = await Promise.all(
		rawMedia.map(async (res) => {
			// 正常路径：已经是 idb:// 引用
			if (res.data?.startsWith(IDB_PREFIX)) {
				const stored = await loadBlobFromIdb(res.data);
				if (!stored) return res;
				return {
					...res,
					data: createTrackedObjectUrl(stored.data, URL_SCOPE.IMAGE_GEN),
					mimeType: stored.mediaType || res.mimeType,
					filename: stored.filename || res.filename,
				};
			}

			// 修复路径：远程 URL 残留
			if (res.data?.startsWith('http://') || res.data?.startsWith('https://')) {
				// 1. 尝试从该 task 已有的 blob 中匹配
				if (ownerBlobs.length > 0) {
					const match = ownerBlobs.find((b) => {
						if (res.mimeType && b.mediaType) return b.mediaType === res.mimeType;
						return true;
					});
					if (match) {
						ownerBlobs = ownerBlobs.filter((b) => b !== match);
						needsRepersist = true;
						return {
							...res,
							data: createTrackedObjectUrl(match.data, URL_SCOPE.IMAGE_GEN),
							_idbRef: IDB_PREFIX + match.id,
							mimeType: match.mediaType || res.mimeType,
							filename: match.filename || res.filename,
						} as PersistedMediaResource;
					}
				}
				// 2. 无匹配 blob，尝试从远程重新下载并持久化
				try {
					const blob = await urlToBlob(res.data);
					const mimeType = res.mimeType || blob.type;
					const idbRef = await saveBlobToIdb(blob, record.id, mimeType, res.filename);
					needsRepersist = true;
					return {
						...res,
						data: createTrackedObjectUrl(blob, URL_SCOPE.IMAGE_GEN),
						_idbRef: idbRef,
						mimeType,
					} as PersistedMediaResource;
				} catch {
					// 远程链接也已失效，保留原 URL
					return res;
				}
			}

			return res;
		}),
	);

	// 回写修复后的记录，避免下次加载时重复修复
	if (needsRepersist) {
		const serializedMedia = task.mediaResources.map((res) => {
			const idbRef = (res as PersistedMediaResource)._idbRef;
			return {
				type: res.type,
				data: idbRef || res.data,
				mimeType: res.mimeType,
				filename: res.filename,
			} as MediaResource;
		});
		updateImageGenTask(record.id, { mediaResources: JSON.stringify(serializedMedia) }).catch(
			console.warn,
		);
	}

	// 恢复 attachedFiles → File 对象（用于重试/克隆）
	const fileRefs: string[] = JSON.parse(record.attachedFileRefs || '[]');
	const files: File[] = [];
	for (const ref of fileRefs) {
		if (!ref.startsWith(IDB_PREFIX)) continue;
		const stored = await loadBlobFromIdb(ref);
		if (stored) files.push(new File([stored.data], stored.filename || 'file', { type: stored.mediaType }));
	}
	if (files.length > 0) {
		task.attachedFiles = files;
		// 预览直接从 File 派生（File extends Blob），无需单独存储
		task.attachedPreviews = files.map((f) => createTrackedObjectUrl(f, URL_SCOPE.IMAGE_GEN));
	}

	// 向后兼容：旧数据可能只有 previewRefs 没有 fileRefs
	if (!task.attachedPreviews) {
		const previewRefs: string[] = JSON.parse(record.attachedPreviewRefs || '[]');
		if (previewRefs.length > 0) {
			const previews: string[] = [];
			for (const ref of previewRefs) {
				const url = ref.startsWith(IDB_PREFIX) ? await idbRefToObjectUrl(ref) : ref;
				if (url) previews.push(url);
			}
			if (previews.length > 0) task.attachedPreviews = previews;
		}
	}

	return task;
}
