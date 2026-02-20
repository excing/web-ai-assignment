/**
 * Chat Session Repository — 聊天会话 CRUD
 */

import { STORE, type ChatSessionRecord } from './schema';
import { getStore, requestToPromise, txDone } from './connection';

export async function putChatSession(session: ChatSessionRecord): Promise<void> {
	const store = await getStore(STORE.CHAT_SESSIONS, 'readwrite');
	store.put(session);
	await txDone(store.transaction);
}

export async function getChatSession(id: string): Promise<ChatSessionRecord | null> {
	const store = await getStore(STORE.CHAT_SESSIONS);
	const result = await requestToPromise(store.get(id));
	return result ?? null;
}

export async function deleteChatSession(id: string): Promise<void> {
	const store = await getStore(STORE.CHAT_SESSIONS, 'readwrite');
	store.delete(id);
	await txDone(store.transaction);
}

/** 按用户获取会话列表（按 updatedAt 降序） */
export async function getChatSessionsByUser(userId: string): Promise<ChatSessionRecord[]> {
	const store = await getStore(STORE.CHAT_SESSIONS);
	const index = store.index('userId');
	const all: ChatSessionRecord[] = await requestToPromise(index.getAll(userId));
	all.sort((a, b) => b.updatedAt - a.updatedAt);
	return all;
}
