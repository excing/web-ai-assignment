import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { createTextGenerationService } from '$lib/server/services/text-generation-service';
import { parseRequestBody, validateChatMessages } from '$lib/server/services/validation';
import { InsufficientBalanceError } from '$lib/server/credits/billing-service';

export const POST: RequestHandler = async ({ request, locals }) => {
	// 1. 解析请求体
	const bodyResult = await parseRequestBody(request);
	if (!bodyResult.success) {
		return json({ error: bodyResult.error }, { status: 400 });
	}

	// 2. 提取 featureKey 和消息
	const { messages, featureKey } = bodyResult.data as { messages?: unknown; featureKey?: string };

	// 3. 验证消息列表
	const messagesResult = validateChatMessages(messages);
	if (!messagesResult.success) {
		return json({ error: messagesResult.error }, { status: 400 });
	}

	// 4. 创建文本生成服务（使用传入的 featureKey 或默认值）
	const textGenerationService = createTextGenerationService({
		feature: featureKey || 'text-generation',
		maxOutputTokens: 4096,
		reasoningTagName: 'think',
		temperature: 0.7,
		userId: locals.session?.user?.id
	});

	try {
		const result = await textGenerationService.handleTextGenerationRequest({
			messages: messagesResult.data!
		});

		return json(result);
	} catch (error) {
		if (error instanceof InsufficientBalanceError) {
			return json({
				error: error.message,
				required: error.required,
				current: error.current,
				description: error.description,
			}, { status: 402 });
		}
		console.error('图片生成请求失败:', error);
		return json({ error: 'AI 服务暂时不可用，请稍后重试' }, { status: 502 });
	}
};
