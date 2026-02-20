/**
 * Chat Store — 聊天业务层
 *
 * 基于新 DB 层的聊天会话/消息持久化。
 * 保存时将 UIMessage 中的 file parts 提取为 Blob 存入 blobs store，
 * 加载时从 blobs 恢复为 object URL 供显示。
 */

import type { UIMessage } from '@ai-sdk/svelte';
import { generateUUID } from '$lib/utils/uuid';
import {
	putChatSession,
	getChatSession,
	deleteChatSession as dbDeleteSession,
	getChatSessionsByUser,
	putChatMessages,
	getChatMessagesBySession,
	deleteChatMessagesBySession,
	putBlob,
	getBlob,
	deleteBlobsByOwner,
	IDB_PREFIX,
	type ChatSessionRecord,
	type ChatMessageRecord,
	type BlobRecord,
} from '$lib/stores/db';
import { createTrackedObjectUrl, revokeAllObjectUrls } from '$lib/composables/use-object-urls.svelte';
import { urlToBlob } from '$lib/utils/blob';

export type SessionMeta = Pick<ChatSessionRecord, 'id' | 'title' | 'updatedAt'>;

// ── Public API ──

export async function saveChatSession(userId: string, id: string, messages: UIMessage[]): Promise<void> {
	if (messages.length === 0) return;

	const title = extractTitle(messages);
	const now = Date.now();
	const existing = await getChatSession(id);

	await putChatSession({
		id,
		userId,
		title,
		createdAt: existing?.createdAt ?? now,
		updatedAt: now,
	});

	const records = await messagesToRecords(id, messages);
	await putChatMessages(records);
}

export async function loadChatSession(id: string): Promise<UIMessage[] | null> {
	const session = await getChatSession(id);
	if (!session) return null;

	const records = await getChatMessagesBySession(id);
	return recordsToMessages(records);
}

export async function deleteChatSession(id: string): Promise<void> {
	const messageIds = await deleteChatMessagesBySession(id);
	for (const msgId of messageIds) {
		await deleteBlobsByOwner(msgId);
	}
	await dbDeleteSession(id);
}

export async function getChatSessionList(userId: string): Promise<SessionMeta[]> {
	const sessions = await getChatSessionsByUser(userId);
	return sessions.map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
}

export { revokeAllObjectUrls as revokeActiveObjectUrls };

// ── Title extraction ──

function extractTitle(messages: UIMessage[]): string {
	const firstUserMsg = messages.find((m) => m.role === 'user');
	if (!firstUserMsg?.parts) return '新对话';

	for (const part of firstUserMsg.parts) {
		if (part.type === 'text' && part.text.trim()) {
			const text = part.text.trim();
			return text.length > 30 ? text.slice(0, 30) + '…' : text;
		}
	}
	return '新对话';
}

// ── UIMessage → ChatMessageRecord + Blob extraction ──

async function messagesToRecords(sessionId: string, messages: UIMessage[]): Promise<ChatMessageRecord[]> {
	const records: ChatMessageRecord[] = [];

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i];
		const msgId = msg.id || generateUUID();
		const parts = msg.parts ? JSON.parse(JSON.stringify(msg.parts)) : [];

		// Extract file parts → blobs
		for (const part of parts) {
			if (part.type !== 'file') continue;
			const url: string = part.url;
			if (url.startsWith(IDB_PREFIX)) continue;

			try {
				const blob = await urlToBlob(url);
				const blobId = generateUUID();
				const record: BlobRecord = {
					id: blobId,
					ownerId: msgId,
					ownerType: 'chat-message',
					data: blob,
					mediaType: blob.type || part.mediaType || '',
					filename: part.filename || null,
				};
				await putBlob(record);
				part.url = IDB_PREFIX + blobId;
			} catch (err) {
				console.warn('Failed to extract blob from message part:', err);
			}
		}

		records.push({
			id: msgId,
			sessionId,
			role: msg.role,
			parts: JSON.stringify(parts),
			createdAt: (msg as unknown as { createdAt?: Date })?.createdAt?.getTime?.() ?? Date.now() - (messages.length - i),
		});
	}

	return records;
}

// ── ChatMessageRecord → UIMessage + Blob restoration ──

async function recordsToMessages(records: ChatMessageRecord[]): Promise<UIMessage[]> {
	revokeAllObjectUrls();

	const messages: UIMessage[] = [];

	for (const record of records) {
		const parts = JSON.parse(record.parts);

		// Restore idb:// refs → object URLs
		for (const part of parts) {
			if (part.type !== 'file') continue;
			const url: string = part.url;
			if (!url.startsWith(IDB_PREFIX)) continue;

			const blobId = url.slice(IDB_PREFIX.length);
			try {
				const stored = await getBlob(blobId);
				if (stored) {
					part.url = createTrackedObjectUrl(stored.data);
					if (stored.mediaType) part.mediaType = stored.mediaType;
					if (stored.filename) part.filename = stored.filename;
				}
			} catch (err) {
				console.warn('Failed to restore blob:', blobId, err);
			}
		}

		messages.push({
			id: record.id,
			role: record.role as UIMessage['role'],
			parts,
			createdAt: new Date(record.createdAt),
		} as UIMessage);
	}

	return messages;
}
