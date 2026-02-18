import { convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
import { BaseAIService } from './base-ai-service';

/**
 * 聊天服务配置选项
 */
export interface ChatServiceOptions {
	/** AI 功能特性名称（用于获取对应的 Proxy 配置） */
	feature?: string;
	/** 最大输出 token 数 */
	maxOutputTokens?: number;
	/** 推理标签名称（用于提取 <think> 等标签内容） */
	reasoningTagName?: string;
	/** 用户 ID（用于计费，不传则不计费） */
	userId?: string;
}

/**
 * 聊天请求参数
 */
export interface ChatRequest {
	/** UI 消息列表（包含 parts） */
	messages: Array<Omit<UIMessage, 'id'>>;
}

/**
 * 聊天服务核心类
 * 负责处理 AI 聊天的核心业务逻辑，可在多个场景复用
 */
export class ChatService {
	private base: BaseAIService;
	private maxOutputTokens: number;

	constructor(private options: ChatServiceOptions = {}) {
		this.base = new BaseAIService({
			feature: options.feature || 'chat',
			userId: options.userId,
			reasoningTagName: options.reasoningTagName,
		});
		this.maxOutputTokens = options.maxOutputTokens ?? 4096;
	}

	/**
	 * 将 UI 消息转换为模型消息
	 */
	async convertMessages(messages: Array<Omit<UIMessage, 'id'>>) {
		return await convertToModelMessages(messages);
	}

	/**
	 * 执行流式聊天
	 */
	async streamChat(modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>) {
		return await this.base.executeStreaming({
			messages: modelMessages,
			maxOutputTokens: this.maxOutputTokens,
			billingDescription: 'AI 对话',
		});
	}

	/**
	 * 便捷方法：处理完整的聊天请求
	 */
	async handleChatRequest(request: ChatRequest) {
		await this.base.initialize();
		const modelMessages = await this.convertMessages(request.messages);
		return await this.streamChat(modelMessages);
	}
}

/**
 * 创建聊天服务实例的工厂函数
 */
export function createChatService(options?: ChatServiceOptions): ChatService {
	return new ChatService(options);
}
