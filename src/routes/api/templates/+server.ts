import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { imageGenTemplate, aiProxyAssignment } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { errorResponse } from '$lib/server/errors';

// 获取所有启用的模板（按分类分组）
export const GET: RequestHandler = async () => {
    try {
        const templates = await db
            .select({
                id: imageGenTemplate.id,
                name: imageGenTemplate.name,
                category: imageGenTemplate.category,
                prompt: imageGenTemplate.prompt,
                previewImageUrl: imageGenTemplate.previewImageUrl,
                description: imageGenTemplate.description,
                imageCountMin: imageGenTemplate.imageCountMin,
                imageCountMax: imageGenTemplate.imageCountMax,
                assignmentId: imageGenTemplate.assignmentId,
                sortOrder: imageGenTemplate.sortOrder,
                isPinned: imageGenTemplate.isPinned,
                // 关联的 feature key
                featureKey: aiProxyAssignment.featureKey,
            })
            .from(imageGenTemplate)
            .leftJoin(aiProxyAssignment, eq(imageGenTemplate.assignmentId, aiProxyAssignment.id))
            .where(eq(imageGenTemplate.isActive, true))
            .orderBy(
                desc(imageGenTemplate.isPinned),
                desc(imageGenTemplate.sortOrder),
                desc(imageGenTemplate.createdAt)
            );

        return json({ templates }, dev ? undefined : {
            headers: {
                'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
            },
        });
    } catch (error) {
        return errorResponse(error, '获取模板失败');
    }
};
