import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resetAssignmentHealth } from '$lib/server/ai-proxy';
import { errorResponse, ValidationError } from '$lib/server/errors';

// 重置 Assignment 健康状态
export const POST: RequestHandler = async ({ params }) => {
    const assignmentId = params.id;
    if (!assignmentId) {
        return errorResponse(new ValidationError('Assignment ID 不能为空'));
    }

    try {
        await resetAssignmentHealth(assignmentId);
        return json({ success: true, message: '健康状态已重置' });
    } catch (error) {
        return errorResponse(error, '重置失败');
    }
};
