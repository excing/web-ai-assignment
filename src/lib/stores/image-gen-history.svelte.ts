/**
 * 图片生成任务持久化层
 *
 * 基于 chat-db 的通用存储，处理 GenerationTask 中的多媒体资源。
 * 保存时将 File 对象、Base64 图片等提取为 Blob 存入 IndexedDB，
 * 加载时从 IndexedDB 恢复 File 对象（供重试）和 object URL（供显示）。
 *
 * 按用户隔离：每个用户使用独立的 session ID。
 */

import type { GenerationTask, MediaResource } from './task-manager.svelte';
import { generateUUID } from '$lib/utils/uuid';
import {
	putSession,
	getSession,
	deleteSession,
	putBlob,
	getBlob,
	deleteBlobsBySession,
} from './chat-db.svelte';

const SESSION_TYPE = 'image-gen';
const IDB_PREFIX = 'idb://';

function getSessionId(userId: string): string {
	return `image-gen-tasks:${userId}`;
}

let activeObjectUrls: string[] = [];

/** 序列化中间类型：attachedFiles 替换为 idb:// 引用 */
interface SerializedTask extends Omit<GenerationTask, 'attachedFiles'> {
	attachedFileRefs?: string[];
}

// ── Public API ──

export async function saveImageGenTasks(userId: string, tasks: GenerationTask[]): Promise<void> {
	const sessionId = getSessionId(userId);

	if (tasks.length === 0) {
		await deleteBlobsBySession(sessionId);
		await deleteSession(sessionId);
		return;
	}

	const serialized = await serializeTasks(sessionId, tasks);
	const now = Date.now();
	const existing = await getSession(sessionId);

	await putSession({
		id: sessionId,
		type: SESSION_TYPE,
		userId,
		title: `${tasks.length} 个图片生成任务`,
		data: JSON.stringify(serialized),
		createdAt: existing?.createdAt ?? now,
		updatedAt: now,
	});
}

export async function loadImageGenTasks(userId: string): Promise<GenerationTask[]> {
	const sessionId = getSessionId(userId);
	const session = await getSession(sessionId);
	if (!session) return [];

	try {
		const serialized: SerializedTask[] = JSON.parse(session.data);
		return deserializeTasks(serialized);
	} catch (err) {
		console.warn('Failed to parse image-gen tasks:', err);
		return [];
	}
}

export async function clearImageGenHistory(userId: string): Promise<void> {
	const sessionId = getSessionId(userId);
	await deleteBlobsBySession(sessionId);
	await deleteSession(sessionId);
}

export function revokeImageGenObjectUrls(): void {
	for (const url of activeObjectUrls) {
		URL.revokeObjectURL(url);
	}
	activeObjectUrls = [];
}

// ── Serialization (save) ──

async function serializeTasks(sessionId: string, tasks: GenerationTask[]): Promise<SerializedTask[]> {
	const serialized: SerializedTask[] = [];

	for (const task of tasks) {
		const { attachedFiles, ...rest } = task;

		const st: SerializedTask = {
			...rest,
			mediaResources: [...rest.mediaResources],
			attachedPreviews: rest.attachedPreviews ? [...rest.attachedPreviews] : undefined,
		};

		// 1. attachedFiles → Blob 存储 + idb:// 引用
		if (attachedFiles && attachedFiles.length > 0) {
			const refs: string[] = [];
			for (const file of attachedFiles) {
				const blobId = generateUUID();
				await putBlob({
					id: blobId,
					sessionId,
					data: file,
					mediaType: file.type,
					filename: file.name,
				});
				refs.push(IDB_PREFIX + blobId);
			}
			st.attachedFileRefs = refs;
		}

		// 2. mediaResources[].data: data URL / blob URL → Blob 分离
		st.mediaResources = await Promise.all(
			st.mediaResources.map(async (res) => {
				if (!res.data || res.data.startsWith(IDB_PREFIX)) return res;
				if (res.data.startsWith('data:') || res.data.startsWith('blob:')) {
					try {
						const blob = await fetch(res.data).then((r) => r.blob());
						const blobId = generateUUID();
						await putBlob({
							id: blobId,
							sessionId,
							data: blob,
							mediaType: res.mimeType || blob.type,
							filename: res.filename,
						});
						return { ...res, data: IDB_PREFIX + blobId };
					} catch (err) {
						console.warn('Failed to serialize media resource:', err);
						return res;
					}
				}
				return res;
			}),
		);

		// 3. attachedPreviews[]: data URL / blob URL → Blob 分离
		if (st.attachedPreviews) {
			st.attachedPreviews = await Promise.all(
				st.attachedPreviews.map(async (preview) => {
					if (preview.startsWith(IDB_PREFIX)) return preview;
					if (preview.startsWith('data:') || preview.startsWith('blob:')) {
						try {
							const blob = await fetch(preview).then((r) => r.blob());
							const blobId = generateUUID();
							await putBlob({
								id: blobId,
								sessionId,
								data: blob,
								mediaType: blob.type,
							});
							return IDB_PREFIX + blobId;
						} catch (err) {
							console.warn('Failed to serialize preview:', err);
							return preview;
						}
					}
					return preview;
				}),
			);
		}

		serialized.push(st);
	}

	// 不再先删后写。每次保存都用新 UUID 写入新 blob，
	// 旧 blob 会在 session 数据更新后变成孤立数据。
	// 孤立 blob 在 clearImageGenHistory() 时统一清理。
	// 这样即使保存中途失败，旧数据仍然完好。

	return serialized;
}

// ── Deserialization (load) ──

async function deserializeTasks(serialized: SerializedTask[]): Promise<GenerationTask[]> {
	revokeImageGenObjectUrls();

	const tasks: GenerationTask[] = [];

	for (const st of serialized) {
		const { attachedFileRefs, ...rest } = st;

		const task: GenerationTask = {
			...rest,
			// loading → pending（没有 in-flight request）
			status: rest.status === 'loading' ? 'pending' : rest.status,
		};

		// 1. attachedFileRefs → 恢复 File 对象
		if (attachedFileRefs && attachedFileRefs.length > 0) {
			const files: File[] = [];
			for (const ref of attachedFileRefs) {
				if (!ref.startsWith(IDB_PREFIX)) continue;
				const blobId = ref.slice(IDB_PREFIX.length);
				try {
					const stored = await getBlob(blobId);
					if (stored) {
						const file = new File([stored.data], stored.filename || 'file', {
							type: stored.mediaType,
						});
						files.push(file);
					}
				} catch (err) {
					console.warn('Failed to restore attached file:', blobId, err);
				}
			}
			if (files.length > 0) {
				task.attachedFiles = files;
			}
		}

		// 2. mediaResources[].data: idb:// → object URL
		task.mediaResources = await Promise.all(
			task.mediaResources.map(async (res) => {
				if (!res.data.startsWith(IDB_PREFIX)) return res;
				const blobId = res.data.slice(IDB_PREFIX.length);
				try {
					const stored = await getBlob(blobId);
					if (stored) {
						const objectUrl = URL.createObjectURL(stored.data);
						activeObjectUrls.push(objectUrl);
						return {
							...res,
							data: objectUrl,
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

		// 3. attachedPreviews[]: idb:// → object URL
		if (task.attachedPreviews) {
			task.attachedPreviews = await Promise.all(
				task.attachedPreviews.map(async (preview) => {
					if (!preview.startsWith(IDB_PREFIX)) return preview;
					const blobId = preview.slice(IDB_PREFIX.length);
					try {
						const stored = await getBlob(blobId);
						if (stored) {
							const objectUrl = URL.createObjectURL(stored.data);
							activeObjectUrls.push(objectUrl);
							return objectUrl;
						}
					} catch (err) {
						console.warn('Failed to restore preview:', blobId, err);
					}
					return preview;
				}),
			);
		}

		tasks.push(task);
	}

	return tasks;
}
