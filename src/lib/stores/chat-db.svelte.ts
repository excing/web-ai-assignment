/**
 * 通用 IndexedDB 存储层
 *
 * 提供 sessions + blobs 两个 object store，通过 type 字段区分不同功能。
 * 当前用于聊天历史（type: 'chat'），未来可扩展到图片生成等。
 */

const DB_NAME = 'bingwu-ai';
const DB_VERSION = 1;

// ── Types ──

export interface StoredSession {
	id: string;
	type: string;
	title: string;
	data: string; // JSON string
	createdAt: number;
	updatedAt: number;
}

export interface StoredBlob {
	id: string;
	sessionId: string;
	data: Blob;
	mediaType: string;
	filename?: string;
}

export interface SessionMeta {
	id: string;
	type: string;
	title: string;
	createdAt: number;
	updatedAt: number;
}

// ── DB Init ──

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
	if (dbInstance) return Promise.resolve(dbInstance);

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains('sessions')) {
				const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
				sessionStore.createIndex('type', 'type', { unique: false });
			}
			if (!db.objectStoreNames.contains('blobs')) {
				const blobStore = db.createObjectStore('blobs', { keyPath: 'id' });
				blobStore.createIndex('sessionId', 'sessionId', { unique: false });
			}
		};

		request.onsuccess = () => {
			dbInstance = request.result;
			dbInstance.onclose = () => { dbInstance = null; };
			resolve(dbInstance);
		};

		request.onerror = () => reject(request.error);
	});
}

// ── Session CRUD ──

export async function putSession(session: StoredSession): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('sessions', 'readwrite');
		tx.objectStore('sessions').put(session);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function getSession(id: string): Promise<StoredSession | null> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('sessions', 'readonly');
		const req = tx.objectStore('sessions').get(id);
		req.onsuccess = () => resolve(req.result ?? null);
		req.onerror = () => reject(req.error);
	});
}

export async function deleteSession(id: string): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('sessions', 'readwrite');
		tx.objectStore('sessions').delete(id);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function getSessionMetasByType(type: string): Promise<SessionMeta[]> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('sessions', 'readonly');
		const index = tx.objectStore('sessions').index('type');
		const req = index.getAll(type);
		req.onsuccess = () => {
			const sessions = (req.result as StoredSession[]).map(
				({ id, type, title, createdAt, updatedAt }) => ({ id, type, title, createdAt, updatedAt })
			);
			sessions.sort((a, b) => b.updatedAt - a.updatedAt);
			resolve(sessions);
		};
		req.onerror = () => reject(req.error);
	});
}

// ── Blob CRUD ──

export async function putBlob(blob: StoredBlob): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('blobs', 'readwrite');
		tx.objectStore('blobs').put(blob);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function getBlob(id: string): Promise<StoredBlob | null> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('blobs', 'readonly');
		const req = tx.objectStore('blobs').get(id);
		req.onsuccess = () => resolve(req.result ?? null);
		req.onerror = () => reject(req.error);
	});
}

export async function deleteBlobsBySession(sessionId: string): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('blobs', 'readwrite');
		const store = tx.objectStore('blobs');
		const index = store.index('sessionId');
		const req = index.openCursor(sessionId);
		req.onsuccess = () => {
			const cursor = req.result;
			if (cursor) {
				cursor.delete();
				cursor.continue();
			}
		};
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}
