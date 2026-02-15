import type { UIMessage } from 'ai';

/**
 * 验证结果
 */
export interface ValidationResult<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
}

/**
 * 验证聊天请求的消息列表
 */
export function validateChatMessages(
	messages: unknown
): ValidationResult<Array<Omit<UIMessage, 'id'>>> {
	if (!Array.isArray(messages)) {
		return {
			success: false,
			error: '消息必须是数组格式'
		};
	}

	if (messages.length === 0) {
		return {
			success: false,
			error: '消息内容不能为空'
		};
	}

	return {
		success: true,
		data: messages as Array<Omit<UIMessage, 'id'>>
	};
}

/**
 * 验证请求体是否为有效的 JSON
 */
export async function parseRequestBody(request: Request): Promise<ValidationResult<unknown>> {
	try {
		const body = await request.json();
		return {
			success: true,
			data: body
		};
	} catch {
		return {
			success: false,
			error: '无效的请求格式'
		};
	}
}

/**
 * 验证用户是否已认证
 */
export function validateAuthentication(session: unknown): ValidationResult<{ user: unknown }> {
	if (!session || typeof session !== 'object' || !('user' in session) || !session.user) {
		return {
			success: false,
			error: '请先登录后再使用聊天功能'
		};
	}

	return {
		success: true,
		data: session as { user: unknown }
	};
}
