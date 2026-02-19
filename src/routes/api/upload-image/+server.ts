import { uploadImageAssets } from '$lib/server/upload-image';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { getBalance } from '$lib/server/credits/credit-service';
import { deductCredits } from '$lib/server/credits/deduction-service';
import { CREDITS } from '$lib/config/constants';

// MIME 类型到合法扩展名的映射
const mimeToExtensions: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/gif': ['gif'],
    'image/webp': ['webp'],
};
const allowedMimeTypes = Object.keys(mimeToExtensions);

export const POST: RequestHandler = async ({ request, locals }) => {
    const userId = locals.session?.user?.id;

    try {
        // 计费预检
        if (userId) {
            const cost = CREDITS.UPLOAD_COST;
            const balance = await getBalance(userId);
            if (balance < cost) {
                return json({
                    error: '积分余额不足',
                    required: cost,
                    current: balance,
                    description: `文件上传 - ${cost} 积分`,
                }, { status: 402 });
            }
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

        // 计费扣款
        if (userId) {
            const cost = CREDITS.UPLOAD_COST;
            await deductCredits({
                userId,
                amount: cost,
                description: '文件上传扣费',
                metadata: { type: 'upload', fixedCost: cost },
                endpoint: '/api/upload-image',
            });
        }

        return json({ url });
    } catch (error) {
        console.error('Upload error:', error);
        return json({ error: 'Failed to process upload' }, { status: 500 });
    }
};
