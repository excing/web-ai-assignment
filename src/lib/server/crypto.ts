/**
 * AES-256-GCM 加密工具
 *
 * 用于加密存储敏感数据（如 API Key）。
 * 使用 BETTER_AUTH_SECRET 派生加密密钥。
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { env } from '$env/dynamic/private';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * 从 BETTER_AUTH_SECRET 派生 256 位密钥
 */
function deriveKey(): Buffer {
    const secret = env.BETTER_AUTH_SECRET;
    if (!secret) {
        throw new Error('BETTER_AUTH_SECRET 环境变量未配置');
    }
    return createHash('sha256').update(secret).digest();
}

/**
 * 加密明文
 *
 * 返回格式：base64(iv + authTag + ciphertext)
 */
export function encrypt(plaintext: string): string {
    const key = deriveKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
    ]);
    const authTag = cipher.getAuthTag();

    // iv(12) + authTag(16) + ciphertext
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
}

/**
 * 解密密文
 *
 * 输入格式：base64(iv + authTag + ciphertext)
 */
export function decrypt(ciphertext: string): string {
    const key = deriveKey();
    const combined = Buffer.from(ciphertext, 'base64');

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
    ]);

    return decrypted.toString('utf8');
}
