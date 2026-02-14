import { uploadImageAssets } from '$lib/server/upload-image';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { randomUUID } from 'crypto';

// MIME 类型到合法扩展名的映射
const mimeToExtensions: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/gif': ['gif'],
    'image/webp': ['webp'],
};
const allowedMimeTypes = Object.keys(mimeToExtensions);

export const POST: RequestHandler = async ({ request, locals }) => {
    try {
        // 认证检查：确保用户已登录
        if (!locals.session?.user) {
            return json({ error: 'Unauthorized. Please sign in to upload files.' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate MIME type - only allow safe image files (SVG excluded due to XSS risk)
        if (!allowedMimeTypes.includes(file.type)) {
            return json({ error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' }, { status: 400 });
        }

        // Validate file size - limit to 10MB
        const maxSizeInBytes = 10 * 1024 * 1024;
        if (file.size > maxSizeInBytes) {
            return json({ error: 'File too large. Maximum size allowed is 10MB.' }, { status: 400 });
        }

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 验证文件扩展名与 MIME 类型匹配
        const fileExt = (file.name.split('.').pop() || '').toLowerCase();
        const validExts = mimeToExtensions[file.type];
        const safeExt = validExts.includes(fileExt) ? fileExt : validExts[0];

        // 使用 UUID 生成唯一文件名，防止碰撞
        const filename = `upload-${Date.now()}-${randomUUID()}.${safeExt}`;

        // Upload the file
        const url = await uploadImageAssets(buffer, filename, file.type);

        return json({ url });
    } catch (error) {
        console.error('Upload error:', error);
        return json({ error: 'Failed to process upload' }, { status: 500 });
    }
};
