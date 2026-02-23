import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { imageGenTemplate, aiProxyAssignment } from '$lib/server/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { parsePagination } from '$lib/config/constants';
import { errorResponse, ValidationError } from '$lib/server/errors';

// 获取模板列表（分页，可按分类筛选）
export const GET: RequestHandler = async ({ url }) => {
    try {
        const { limit, offset } = parsePagination(url);
        const category = url.searchParams.get('category');

        let query = db
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
                isActive: imageGenTemplate.isActive,
                requiredLevel: imageGenTemplate.requiredLevel,
                createdAt: imageGenTemplate.createdAt,
                updatedAt: imageGenTemplate.updatedAt,
                // 关联的 Assignment 信息
                assignmentName: aiProxyAssignment.name,
                featureKey: aiProxyAssignment.featureKey,
            })
            .from(imageGenTemplate)
            .leftJoin(aiProxyAssignment, eq(imageGenTemplate.assignmentId, aiProxyAssignment.id));

        if (category) {
            query = query.where(eq(imageGenTemplate.category, category)) as typeof query;
        }

        const templates = await query
            .orderBy(
                desc(imageGenTemplate.isPinned),
                desc(imageGenTemplate.sortOrder),
                desc(imageGenTemplate.createdAt)
            )
            .limit(limit)
            .offset(offset);

        // 总数
        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(imageGenTemplate);
        const total = Number(countResult[0].count);

        // 获取所有已存在的分类（用于前端自动补全）
        const categoriesResult = await db
            .selectDistinct({ category: imageGenTemplate.category })
            .from(imageGenTemplate)
            .orderBy(imageGenTemplate.category);
        const categories = categoriesResult.map(r => r.category);

        return json({ templates, total, limit, offset, categories });
    } catch (error) {
        return errorResponse(error, '获取模板列表失败');
    }
};

// 创建模板
export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const { name, category, prompt, previewImageUrl, description, imageCountMin, imageCountMax, assignmentId, sortOrder, isPinned, isActive, requiredLevel } = body;

        if (!name || !category || !prompt) {
            return errorResponse(new ValidationError('请填写模板名称、分类和提示词'));
        }

        // 验证 Assignment 存在（如果指定了）
        if (assignmentId) {
            const [assignment] = await db
                .select({ id: aiProxyAssignment.id })
                .from(aiProxyAssignment)
                .where(eq(aiProxyAssignment.id, assignmentId));

            if (!assignment) {
                return errorResponse(new ValidationError('指定的 AI Proxy Assignment 不存在'));
            }
        }

        const templateId = `tpl-${Date.now()}`;

        const [newTemplate] = await db
            .insert(imageGenTemplate)
            .values({
                id: templateId,
                name,
                category,
                prompt,
                previewImageUrl: previewImageUrl || null,
                description: description || null,
                imageCountMin: imageCountMin != null ? Number(imageCountMin) : 0,
                imageCountMax: imageCountMax != null ? Number(imageCountMax) : 0,
                assignmentId: assignmentId || null,
                sortOrder: sortOrder != null ? Number(sortOrder) : 0,
                isPinned: isPinned === true,
                isActive: isActive !== false,
                requiredLevel: requiredLevel != null ? Number(requiredLevel) : 0,
            })
            .returning();

        return json({ success: true, template: newTemplate });
    } catch (error) {
        return errorResponse(error, '创建模板失败');
    }
};
