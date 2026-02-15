import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { createTextGenerationService } from '$lib/server/services/text-generation-service';
import { parseRequestBody, validateChatMessages } from '$lib/server/services/validation';

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

	// 3. 创建文本生成服务并处理请求
	const textGenerationService = createTextGenerationService({
		feature: 'text-generation',
		maxOutputTokens: 4096,
		reasoningTagName: 'think',
		temperature: 0.7,
		billingContext: locals.billingContext
	});

	try {
		const result = await textGenerationService.handleTextGenerationRequest({
			messages: messagesResult.data!
		});

		return json(result);
	} catch (error) {
		console.error('AI 请求失败:', error);
		return json({ error: 'AI 服务暂时不可用，请稍后重试' }, { status: 502 });
	}
};
