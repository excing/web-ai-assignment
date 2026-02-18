import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { createChatService } from '$lib/server/services/chat-service';
import { parseRequestBody, validateChatMessages } from '$lib/server/services/validation';
import { InsufficientBalanceError } from '$lib/server/credits/billing-service';

export const POST: RequestHandler = async ({ request, locals }) => {
	// 1. 解析请求体
	const bodyResult = await parseRequestBody(request);
	if (!bodyResult.success) {
		return json({ error: bodyResult.error }, { status: 400 });
	}

	// 2. 验证消息列表
	const { messages } = bodyResult.data as { messages?: unknown };
	const messagesResult = validateChatMessages(messages);
	if (!messagesResult.success) {
		return json({ error: messagesResult.error }, { status: 400 });
	}

	// 3. 创建聊天服务并处理请求
	const chatService = createChatService({
		feature: 'chat',
		maxOutputTokens: 4096,
		reasoningTagName: 'think',
		userId: locals.session?.user?.id
	});

	try {
		const result = await chatService.handleChatRequest({
			messages: messagesResult.data!
		});

		return result.toUIMessageStreamResponse();
	} catch (error) {
		if (error instanceof InsufficientBalanceError) {
			return json({
				error: error.message,
				required: error.required,
				current: error.current,
				description: error.description,
			}, { status: 402 });
		}
		return json({ error: 'AI 服务暂时不可用，请稍后重试' }, { status: 502 });
	}
};
