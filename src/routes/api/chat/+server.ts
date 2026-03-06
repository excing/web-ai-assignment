import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { convertToModelMessages } from 'ai';
import { BaseAIService } from '$lib/server/services/base-ai-service';
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

	// 3. 初始化 AI 服务
	const service = new BaseAIService({
		feature: 'chat',
		userId: locals.session?.user?.id,
		reasoningTagName: 'think',
	});

	try {
		await service.initialize();
		const modelMessages = await convertToModelMessages(messagesResult.data!);
		const result = await service.executeStreaming({
			messages: modelMessages,
			maxOutputTokens: 4096,
			billingDescription: 'AI 对话',
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
