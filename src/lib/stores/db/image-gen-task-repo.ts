/**
 * Image Gen Task Repository — 图片生成任务 CRUD
 */

import { STORE, type ImageGenTaskRecord } from './schema';
import { getStore, requestToPromise, txDone } from './connection';

export async function putImageGenTask(task: ImageGenTaskRecord): Promise<void> {
	const store = await getStore(STORE.IMAGE_GEN_TASKS, 'readwrite');
	store.put(task);
	await txDone(store.transaction);
}

export async function getImageGenTask(id: string): Promise<ImageGenTaskRecord | null> {
	const store = await getStore(STORE.IMAGE_GEN_TASKS);
	const result = await requestToPromise(store.get(id));
	return result ?? null;
}

export async function deleteImageGenTask(id: string): Promise<void> {
	const store = await getStore(STORE.IMAGE_GEN_TASKS, 'readwrite');
	store.delete(id);
	await txDone(store.transaction);
}

/** 按用户获取所有任务（按 createdAt 降序） */
export async function getImageGenTasksByUser(userId: string): Promise<ImageGenTaskRecord[]> {
	const store = await getStore(STORE.IMAGE_GEN_TASKS);
	const index = store.index('userId');
	const all: ImageGenTaskRecord[] = await requestToPromise(index.getAll(userId));
	all.sort((a, b) => b.createdAt - a.createdAt);
	return all;
}

/** 更新任务状态及可选的附加字段 */
export async function updateImageGenTask(
	id: string,
	patch: Partial<Omit<ImageGenTaskRecord, 'id'>>,
): Promise<void> {
	const store = await getStore(STORE.IMAGE_GEN_TASKS, 'readwrite');
	const existing = await requestToPromise(store.get(id));
	if (!existing) return;
	store.put({ ...existing, ...patch });
	await txDone(store.transaction);
}

/** 删除指定用户的所有任务（返回被删除的任务 ID 列表，用于级联删 blob） */
export async function deleteImageGenTasksByUser(userId: string): Promise<string[]> {
	const store = await getStore(STORE.IMAGE_GEN_TASKS, 'readwrite');
	const index = store.index('userId');
	const deletedIds: string[] = [];

	const request = index.openCursor(userId);
	await new Promise<void>((resolve, reject) => {
		request.onsuccess = () => {
			const cursor = request.result;
			if (cursor) {
				deletedIds.push((cursor.value as ImageGenTaskRecord).id);
				cursor.delete();
				cursor.continue();
			}
		};
		store.transaction.oncomplete = () => resolve();
		store.transaction.onerror = () => reject(store.transaction.error);
	});

	return deletedIds;
}
