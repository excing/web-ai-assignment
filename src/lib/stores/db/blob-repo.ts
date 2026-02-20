/**
 * Blob Repository — 二进制数据 CRUD
 */

import { STORE, type BlobRecord } from './schema';
import { getStore, requestToPromise, txDone } from './connection';

export async function putBlob(blob: BlobRecord): Promise<void> {
	const store = await getStore(STORE.BLOBS, 'readwrite');
	store.put(blob);
	await txDone(store.transaction);
}

export async function getBlob(id: string): Promise<BlobRecord | null> {
	const store = await getStore(STORE.BLOBS);
	const result = await requestToPromise(store.get(id));
	return result ?? null;
}

export async function deleteBlob(id: string): Promise<void> {
	const store = await getStore(STORE.BLOBS, 'readwrite');
	store.delete(id);
	await txDone(store.transaction);
}

/** 删除指定 owner 的所有 blob */
export async function deleteBlobsByOwner(ownerId: string): Promise<void> {
	const store = await getStore(STORE.BLOBS, 'readwrite');
	const index = store.index('ownerId');
	const request = index.openCursor(ownerId);

	await new Promise<void>((resolve, reject) => {
		request.onsuccess = () => {
			const cursor = request.result;
			if (cursor) {
				cursor.delete();
				cursor.continue();
			}
		};
		store.transaction.oncomplete = () => resolve();
		store.transaction.onerror = () => reject(store.transaction.error);
	});
}
