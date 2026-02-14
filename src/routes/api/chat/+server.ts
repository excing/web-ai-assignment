import { streamText, convertToModelMessages } from 'ai';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import {
	getProxyForFeatureWithFallback,
	createModelFromProxy,
	reportProxySuccess,
	reportProxyFailure
} from '$lib/server/ai-proxy';
import { createLogger } from '$lib/server/logger';

const log = createLogger('api-chat');

export const POST: RequestHandler = async ({ request, locals }) => {
	// 认证检查：确保用户已登录
	if (!locals.session?.user) {
		return json({ error: '请先登录后再使用聊天功能' }, { status: 401 });
	}

	// 输入验证
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: '无效的请求格式' }, { status: 400 });
	}

	const { messages } = body as { messages?: unknown };
	if (!Array.isArray(messages) || messages.length === 0) {
		return json({ error: '消息内容不能为空' }, { status: 400 });
	}

	// 将 UI messages（包含 parts）转换为 core messages（包含 content）
	const modelMessages = await convertToModelMessages(messages);

	// 获取 Proxy 配置（数据库优先，fallback 到环境变量）
	const proxyConfig = await getProxyForFeatureWithFallback('chat');
	const model = createModelFromProxy(proxyConfig);

	// ── 计费集成：捕获 token 用量 ──
	const billingCtx = locals.billingContext;

	try {
		const result = streamText({
			model,
			messages: modelMessages,
			maxOutputTokens: 4096,
			onFinish: async ({ usage }) => {
				// 记录 Proxy 请求成功
				await reportProxySuccess(proxyConfig.proxyId);

				// 计费回调
				if (billingCtx) {
					billingCtx.usageData = usage;
					billingCtx.resolveUsageData();
				}
			},
			onError: async ({ error }) => {
				// 流式传输中途出错，报告 Proxy 失败
				const errorMsg = error instanceof Error ? error.message : String(error);
				log.error('AI 流式响应错误', undefined, { error: errorMsg });
				await reportProxyFailure(proxyConfig.proxyId, errorMsg);
			}
		});

		return result.toUIMessageStreamResponse();
	} catch (error) {
		// streamText 初始化失败（如网络不可达、API Key 无效等）
		const errorMsg = error instanceof Error ? error.message : String(error);
		log.error('AI 请求失败', error instanceof Error ? error : new Error(String(error)));
		await reportProxyFailure(proxyConfig.proxyId, errorMsg);
		return json({ error: 'AI 服务暂时不可用，请稍后重试' }, { status: 502 });
	}
};
