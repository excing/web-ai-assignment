/**
 * Chat Message Repository — 聊天消息 CRUD
 */

import { STORE, type ChatMessageRecord } from './schema';
import { getStore, getStores, requestToPromise, txDone } from './connection';

export async function putChatMessage(message: ChatMessageRecord): Promise<void> {
	const store = await getStore(STORE.CHAT_MESSAGES, 'readwrite');
	store.put(message);
	await txDone(store.transaction);
}

/** 批量写入消息（单事务） */
export async function putChatMessages(messages: ChatMessageRecord[]): Promise<void> {
	const store = await getStore(STORE.CHAT_MESSAGES, 'readwrite');
	for (const msg of messages) {
		store.put(msg);
	}
	await txDone(store.transaction);
}

/** 按 sessionId 获取所有消息（按 createdAt 升序） */
export async function getChatMessagesBySession(sessionId: string): Promise<ChatMessageRecord[]> {
	const store = await getStore(STORE.CHAT_MESSAGES);
	const index = store.index('sessionId');
	const all: ChatMessageRecord[] = await requestToPromise(index.getAll(sessionId));
	all.sort((a, b) => a.createdAt - b.createdAt);
	return all;
}

/** 删除某会话的所有消息（返回被删除的消息 ID 列表，用于级联删 blob） */
export async function deleteChatMessagesBySession(sessionId: string): Promise<string[]> {
	const { tx, store } = await getStores(STORE.CHAT_MESSAGES, 'readwrite');
	const messagesStore = store(STORE.CHAT_MESSAGES);
	const index = messagesStore.index('sessionId');
	const deletedIds: string[] = [];

	const request = index.openCursor(sessionId);
	await new Promise<void>((resolve, reject) => {
		request.onsuccess = () => {
			const cursor = request.result;
			if (cursor) {
				deletedIds.push((cursor.value as ChatMessageRecord).id);
				cursor.delete();
				cursor.continue();
			}
		};
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});

	return deletedIds;
}
