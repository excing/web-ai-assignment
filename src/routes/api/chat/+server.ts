import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { createChatService } from '$lib/server/services/chat-service';
import {
	parseRequestBody,
	validateAuthentication,
	validateChatMessages
} from '$lib/server/services/validation';

export const POST: RequestHandler = async ({ request, locals }) => {
	// 1. 认证检查
	const authResult = validateAuthentication(locals.session);
	if (!authResult.success) {
		return json({ error: authResult.error }, { status: 401 });
	}

	// 2. 解析请求体
	const bodyResult = await parseRequestBody(request);
	if (!bodyResult.success) {
		return json({ error: bodyResult.error }, { status: 400 });
	}

	// 3. 验证消息列表
	const { messages } = bodyResult.data as { messages?: unknown };
	const messagesResult = validateChatMessages(messages);
	if (!messagesResult.success) {
		return json({ error: messagesResult.error }, { status: 400 });
	}

	// 4. 创建聊天服务并处理请求
	const chatService = createChatService({
		feature: 'chat',
		maxOutputTokens: 4096,
		reasoningTagName: 'think',
		billingContext: locals.billingContext
	});

	try {
		const result = await chatService.handleChatRequest({
			messages: messagesResult.data!
		});

		return result.toUIMessageStreamResponse();
	} catch (error) {
		return json({ error: 'AI 服务暂时不可用，请稍后重试' }, { status: 502 });
	}
};
