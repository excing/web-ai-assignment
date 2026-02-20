/**
 * IndexedDB Schema — 类型定义与常量
 *
 * 数据库: bingwu-ai-v2 (与旧 bingwu-ai 隔离)
 * 4 个 Object Store: chatSessions, chatMessages, imageGenTasks, blobs
 */

// ── 数据库常量 ──

export const DB_NAME = 'bingwu-ai-v2';
export const DB_VERSION = 1;

export const STORE = {
	CHAT_SESSIONS: 'chatSessions',
	CHAT_MESSAGES: 'chatMessages',
	IMAGE_GEN_TASKS: 'imageGenTasks',
	BLOBS: 'blobs',
} as const;

/** idb:// 前缀：标识 blob 数据存储在 IndexedDB 中 */
export const IDB_PREFIX = 'idb://';

// ── Record 类型 ──

export interface ChatSessionRecord {
	id: string;
	userId: string;
	title: string;
	createdAt: number;
	updatedAt: number;
}

export interface ChatMessageRecord {
	id: string;
	sessionId: string;
	role: string;
	/** JSON string — UIMessage.parts 序列化（内含 idb:// 引用） */
	parts: string;
	createdAt: number;
}

export interface ImageGenTaskRecord {
	id: string;
	userId: string;
	prompt: string;
	status: string;
	/** JSON string — MediaResource[]（data 字段含 idb:// 引用） */
	mediaResources: string;
	/** JSON string — string[]（idb:// blob 引用，用于恢复 File 对象） */
	attachedFileRefs: string;
	/** JSON string — string[]（idb:// blob 引用，用于恢复预览 URL） */
	attachedPreviewRefs: string;
	aspectRatio: string | null;
	featureKey: string | null;
	error: string | null;
	createdAt: number;
	completedAt: number | null;
}

export interface BlobRecord {
	id: string;
	ownerId: string;
	ownerType: 'chat-message' | 'image-gen-task';
	data: Blob;
	mediaType: string;
	filename: string | null;
}
