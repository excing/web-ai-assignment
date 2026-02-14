import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { aiProxyAssignment } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateProxyCache } from '$lib/server/ai-proxy';
import { errorResponse, ValidationError, NotFoundError } from '$lib/server/errors';

// 更新 Assignment
export const PUT: RequestHandler = async ({ params, request }) => {
    const assignmentId = params.id;
    if (!assignmentId) {
        return errorResponse(new ValidationError('Assignment ID 不能为空'));
    }

    try {
        const body = await request.json();
        const { name, description, featureKey, proxyId, models, defaultModel, isActive } = body;

        if (!name || !featureKey || !proxyId) {
            return errorResponse(new ValidationError('请填写名称、功能标识和 Proxy'));
        }

        const [updatedAssignment] = await db
            .update(aiProxyAssignment)
            .set({
                name,
                description: description || null,
                featureKey,
                proxyId,
                models: Array.isArray(models) && models.length > 0 ? models : null,
                defaultModel: defaultModel || null,
                isActive: Boolean(isActive),
                updatedAt: new Date()
            })
            .where(eq(aiProxyAssignment.id, assignmentId))
            .returning();

        if (!updatedAssignment) {
            return errorResponse(new NotFoundError('Assignment 不存在'));
        }

        // 清除缓存
        invalidateProxyCache();

        return json({ success: true, assignment: updatedAssignment });
    } catch (error) {
        return errorResponse(error, '更新 Assignment 失败');
    }
};

// 删除 Assignment
export const DELETE: RequestHandler = async ({ params }) => {
    const assignmentId = params.id;
    if (!assignmentId) {
        return errorResponse(new ValidationError('Assignment ID 不能为空'));
    }

    try {
        const [deletedAssignment] = await db
            .delete(aiProxyAssignment)
            .where(eq(aiProxyAssignment.id, assignmentId))
            .returning();

        if (!deletedAssignment) {
            return errorResponse(new NotFoundError('Assignment 不存在'));
        }

        // 清除缓存
        invalidateProxyCache();

        return json({ success: true, message: 'Assignment 删除成功' });
    } catch (error) {
        return errorResponse(error, '删除 Assignment 失败');
    }
};
