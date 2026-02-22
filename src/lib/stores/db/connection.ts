/**
 * IndexedDB 连接管理
 *
 * 提供 openDB() 单例连接与事务辅助函数。
 * 全新 schema（version 1）：chatSessions, chatMessages, imageGenTasks, blobs。
 */

import { dev } from '$app/environment';
import { DB_NAME, DB_VERSION, STORE } from './schema';

let dbInstance: IDBDatabase | null = null;

export function openDB(): Promise<IDBDatabase> {
	if (dbInstance) return Promise.resolve(dbInstance);

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = () => {
			const db = request.result;

			// chatSessions
			const sessions = db.createObjectStore(STORE.CHAT_SESSIONS, { keyPath: 'id' });
			sessions.createIndex('userId', 'userId', { unique: false });

			// chatMessages
			const messages = db.createObjectStore(STORE.CHAT_MESSAGES, { keyPath: 'id' });
			messages.createIndex('sessionId', 'sessionId', { unique: false });

			// imageGenTasks
			const tasks = db.createObjectStore(STORE.IMAGE_GEN_TASKS, { keyPath: 'id' });
			tasks.createIndex('userId', 'userId', { unique: false });
			tasks.createIndex('userId_createdAt', ['userId', 'createdAt'], { unique: false });

			// blobs
			const blobs = db.createObjectStore(STORE.BLOBS, { keyPath: 'id' });
			blobs.createIndex('ownerId', 'ownerId', { unique: false });
		};

		request.onsuccess = () => {
			dbInstance = request.result;
			dbInstance.onclose = () => {
				dbInstance = null;
			};
			resolve(dbInstance);

			// 生产环境请求持久化存储，防止浏览器在存储压力下回收 IndexedDB 数据
			if (!dev && navigator.storage?.persist) {
				navigator.storage.persist().catch(() => {});
			}
		};

		request.onerror = () => reject(request.error);
	});
}

// ── 事务辅助 ──

type StoreNames = string | string[];
type TxMode = IDBTransactionMode;

/**
 * 打开事务并获取 object store
 */
export async function getStore(
	storeName: string,
	mode: TxMode = 'readonly',
): Promise<IDBObjectStore> {
	const db = await openDB();
	const tx = db.transaction(storeName, mode);
	return tx.objectStore(storeName);
}

/**
 * 打开多 store 事务
 */
export async function getStores(
	storeNames: StoreNames,
	mode: TxMode = 'readonly',
): Promise<{ tx: IDBTransaction; store: (name: string) => IDBObjectStore }> {
	const db = await openDB();
	const tx = db.transaction(storeNames, mode);
	return {
		tx,
		store: (name: string) => tx.objectStore(name),
	};
}

/**
 * 包装 IDBRequest 为 Promise
 */
export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

/**
 * 等待事务完成
 */
export function txDone(tx: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}
