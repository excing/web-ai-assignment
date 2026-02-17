/**
 * 聊天历史业务层
 *
 * 基于 chat-db 的聊天专用逻辑，处理 UIMessage 中的多媒体资源。
 * 保存时将图片等 file parts 提取为 Blob 存入 IndexedDB，
 * 加载时从 IndexedDB 恢复为 object URL 供显示。
 */

import type { UIMessage } from '@ai-sdk/svelte';
import {
	putSession,
	getSession,
	deleteSession,
	getSessionMetasByType,
	putBlob,
	getBlob,
	deleteBlobsBySession,
	type SessionMeta,
	type StoredBlob,
} from './chat-db.svelte';

export type { SessionMeta };

const SESSION_TYPE = 'chat';
const IDB_PREFIX = 'idb://';

// 跟踪当前会话已创建的 object URLs，以便在切换时 revoke
let activeObjectUrls: string[] = [];

// ── Public API ──

export async function saveChatSession(id: string, messages: UIMessage[]): Promise<void> {
	if (messages.length === 0) return;

	const processedMessages = await processMediaInMessages(id, messages);
	const title = extractTitle(messages);
	const now = Date.now();

	const existing = await getSession(id);

	await putSession({
		id,
		type: SESSION_TYPE,
		title,
		data: JSON.stringify(processedMessages),
		createdAt: existing?.createdAt ?? now,
		updatedAt: now,
	});
}

export async function loadChatSession(id: string): Promise<UIMessage[] | null> {
	const session = await getSession(id);
	if (!session) return null;

	const messages: UIMessage[] = JSON.parse(session.data);
	return restoreMediaInMessages(messages);
}

export async function deleteChatSession(id: string): Promise<void> {
	await deleteBlobsBySession(id);
	await deleteSession(id);
}

export async function getChatSessionList(): Promise<SessionMeta[]> {
	return getSessionMetasByType(SESSION_TYPE);
}

export function revokeActiveObjectUrls(): void {
	for (const url of activeObjectUrls) {
		URL.revokeObjectURL(url);
	}
	activeObjectUrls = [];
}

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

// ── Media processing (save) ──

async function processMediaInMessages(
	sessionId: string,
	messages: UIMessage[],
): Promise<UIMessage[]> {
	const cloned: UIMessage[] = JSON.parse(JSON.stringify(messages));

	for (const message of cloned) {
		if (!message.parts) continue;
		for (let i = 0; i < message.parts.length; i++) {
			const part = message.parts[i];
			if (part.type !== 'file') continue;

			const url = part.url;
			// Already stored in IndexedDB
			if (url.startsWith(IDB_PREFIX)) continue;

			try {
				const { blob, mediaType, filename } = await urlToBlob(url, part.mediaType, part.filename);
				const blobId = crypto.randomUUID();

				const storedBlob: StoredBlob = {
					id: blobId,
					sessionId,
					data: blob,
					mediaType: mediaType || part.mediaType,
					filename: filename || part.filename,
				};
				await putBlob(storedBlob);

				// Replace URL with IndexedDB reference
				(part as { url: string }).url = IDB_PREFIX + blobId;
			} catch (err) {
				console.warn('Failed to process media for storage:', url, err);
				// Keep original URL as fallback
			}
		}
	}

	return cloned;
}

async function urlToBlob(
	url: string,
	_mediaType?: string,
	_filename?: string,
): Promise<{ blob: Blob; mediaType?: string; filename?: string }> {
	// Data URL: data:image/png;base64,...
	if (url.startsWith('data:')) {
		const blob = await fetch(url).then((r) => r.blob());
		return { blob, mediaType: blob.type };
	}

	// Remote URL: https://...
	if (url.startsWith('http://') || url.startsWith('https://')) {
		const response = await fetch(url);
		const blob = await response.blob();
		return { blob, mediaType: blob.type };
	}

	// Browser object URL: blob:http://...
	if (url.startsWith('blob:')) {
		try {
			const response = await fetch(url);
			const blob = await response.blob();
			return { blob, mediaType: blob.type };
		} catch {
			throw new Error('Object URL no longer accessible');
		}
	}

	throw new Error(`Unsupported URL scheme: ${url.slice(0, 20)}`);
}

// ── Media restoration (load) ──

async function restoreMediaInMessages(messages: UIMessage[]): Promise<UIMessage[]> {
	// Revoke previous object URLs before creating new ones
	revokeActiveObjectUrls();

	for (const message of messages) {
		if (!message.parts) continue;
		for (const part of message.parts) {
			if (part.type !== 'file') continue;

			const url = part.url;
			if (!url.startsWith(IDB_PREFIX)) continue;

			const blobId = url.slice(IDB_PREFIX.length);
			try {
				const stored = await getBlob(blobId);
				if (stored) {
					const objectUrl = URL.createObjectURL(stored.data);
					activeObjectUrls.push(objectUrl);
					(part as { url: string }).url = objectUrl;
					if (stored.mediaType) (part as { mediaType: string }).mediaType = stored.mediaType;
					if (stored.filename) (part as { filename?: string }).filename = stored.filename;
				}
			} catch (err) {
				console.warn('Failed to restore blob:', blobId, err);
			}
		}
	}

	return messages;
}
