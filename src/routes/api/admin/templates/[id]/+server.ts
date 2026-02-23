import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { imageGenTemplate, aiProxyAssignment } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { errorResponse, NotFoundError, ValidationError } from '$lib/server/errors';

// 获取单个模板
export const GET: RequestHandler = async ({ params }) => {
    try {
        const [template] = await db
            .select()
            .from(imageGenTemplate)
            .where(eq(imageGenTemplate.id, params.id));

        if (!template) {
            return errorResponse(new NotFoundError('模板不存在'));
        }

        return json({ template });
    } catch (error) {
        return errorResponse(error, '获取模板失败');
    }
};

// 更新模板
export const PUT: RequestHandler = async ({ params, request }) => {
    try {
        const body = await request.json();

        // 检查模板是否存在
        const [existing] = await db
            .select({ id: imageGenTemplate.id })
            .from(imageGenTemplate)
            .where(eq(imageGenTemplate.id, params.id));

        if (!existing) {
            return errorResponse(new NotFoundError('模板不存在'));
        }

        // 构建更新字段
        const updates: Record<string, unknown> = { updatedAt: new Date() };

        if (body.name !== undefined) {
            if (!body.name) return errorResponse(new ValidationError('模板名称不能为空'));
            updates.name = body.name;
        }
        if (body.category !== undefined) {
            if (!body.category) return errorResponse(new ValidationError('分类不能为空'));
            updates.category = body.category;
        }
        if (body.prompt !== undefined) {
            if (!body.prompt) return errorResponse(new ValidationError('提示词不能为空'));
            updates.prompt = body.prompt;
        }
        if (body.previewImageUrl !== undefined) updates.previewImageUrl = body.previewImageUrl || null;
        if (body.description !== undefined) updates.description = body.description || null;
        if (body.imageCountMin !== undefined) updates.imageCountMin = Number(body.imageCountMin);
        if (body.imageCountMax !== undefined) updates.imageCountMax = Number(body.imageCountMax);
        if (body.sortOrder !== undefined) updates.sortOrder = Number(body.sortOrder);
        if (body.isPinned !== undefined) updates.isPinned = Boolean(body.isPinned);
        if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);
        if (body.requiredLevel !== undefined) updates.requiredLevel = Number(body.requiredLevel);

        if (body.assignmentId !== undefined) {
            if (body.assignmentId) {
                // 验证 Assignment 存在
                const [assignment] = await db
                    .select({ id: aiProxyAssignment.id })
                    .from(aiProxyAssignment)
                    .where(eq(aiProxyAssignment.id, body.assignmentId));

                if (!assignment) {
                    return errorResponse(new ValidationError('指定的 AI Proxy Assignment 不存在'));
                }
            }
            updates.assignmentId = body.assignmentId || null;
        }

        const [updated] = await db
            .update(imageGenTemplate)
            .set(updates)
            .where(eq(imageGenTemplate.id, params.id))
            .returning();

        return json({ success: true, template: updated });
    } catch (error) {
        return errorResponse(error, '更新模板失败');
    }
};

// 删除模板
export const DELETE: RequestHandler = async ({ params }) => {
    try {
        const [deleted] = await db
            .delete(imageGenTemplate)
            .where(eq(imageGenTemplate.id, params.id))
            .returning({ id: imageGenTemplate.id });

        if (!deleted) {
            return errorResponse(new NotFoundError('模板不存在'));
        }

        return json({ success: true });
    } catch (error) {
        return errorResponse(error, '删除模板失败');
    }
};
