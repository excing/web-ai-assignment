import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { imageGenTemplate, aiProxyAssignment, user } from '$lib/server/db/schema';
import { eq, desc, and, lte } from 'drizzle-orm';
import { errorResponse } from '$lib/server/errors';

// 获取所有启用的模板（按分类分组，根据用户等级过滤）
export const GET: RequestHandler = async ({ locals }) => {
    try {
        // 获取当前用户等级
        let userLevel = 0;
        const userId = locals.session?.user?.id;
        if (userId) {
            const [u] = await db
                .select({ level: user.level })
                .from(user)
                .where(eq(user.id, userId));
            if (u) userLevel = u.level;
        }

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
            .where(and(
                eq(imageGenTemplate.isActive, true),
                lte(imageGenTemplate.requiredLevel, userLevel)
            ))
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
