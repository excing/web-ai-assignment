/**
 * 通用媒体上传 — Cloudflare R2
 *
 * 提供共享的 R2 S3Client 和通用上传函数，供图片上传、AI 生成媒体上传等场景复用。
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';
import { randomUUID } from 'crypto';

// ── 共享 R2 Client ──

let _r2: S3Client | null = null;

function getR2Client(): S3Client {
	if (!_r2) {
		_r2 = new S3Client({
			region: 'auto',
			endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: env.R2_UPLOAD_IMAGE_ACCESS_KEY_ID!,
				secretAccessKey: env.R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY!,
			},
		});
	}
	return _r2;
}

// ── MIME → 扩展名映射 ──

const MIME_EXT: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/svg+xml': 'svg',
	'video/mp4': 'mp4',
	'video/webm': 'webm',
	'video/quicktime': 'mov',
	'audio/mpeg': 'mp3',
	'audio/wav': 'wav',
	'audio/ogg': 'ogg',
	'application/pdf': 'pdf',
};

function mimeToExt(mimeType: string): string {
	return MIME_EXT[mimeType] || mimeType.split('/').pop()?.replace(/[^a-z0-9]/g, '') || 'bin';
}

// ── 通用上传 ──

/**
 * 将 Buffer 上传到 R2，返回 public URL。
 *
 * @param buffer  - 文件二进制数据
 * @param mimeType - MIME 类型，如 'image/png', 'video/mp4'
 * @param filename - 可选的原始文件名（仅用于日志，不影响 key）
 * @returns public URL (https://r2.blendiv.com/media/xxx.png)
 */
export async function uploadMediaToR2(
	buffer: Buffer,
	mimeType: string,
	filename?: string,
): Promise<string> {
	const ext = mimeToExt(mimeType);
	const key = `media/${randomUUID()}.${ext}`;

	const r2 = getR2Client();
	await r2.send(
		new PutObjectCommand({
			Bucket: env.R2_UPLOAD_IMAGE_BUCKET_NAME!,
			Key: key,
			Body: buffer,
			ContentType: mimeType,
			ACL: 'public-read',
		}),
	);

	return `${env.R2_PUBLIC_URL}/${key}`;
}

// ── 兼容旧接口 ──

/**
 * 上传图片资源（旧接口保持兼容）。
 * 与 uploadMediaToR2 的区别：调用方自行指定 key。
 */
export async function uploadImageAssets(
	buffer: Buffer,
	key: string,
	contentType: string = 'image/png',
): Promise<string> {
	const r2 = getR2Client();
	await r2.send(
		new PutObjectCommand({
			Bucket: env.R2_UPLOAD_IMAGE_BUCKET_NAME!,
			Key: key,
			Body: buffer,
			ContentType: contentType,
			ACL: 'public-read',
		}),
	);

	return `${env.R2_PUBLIC_URL}/${key}`;
}
