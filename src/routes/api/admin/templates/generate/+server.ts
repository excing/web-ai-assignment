import { json, type RequestHandler } from '@sveltejs/kit';
import { BaseAIService } from '$lib/server/services/base-ai-service';
import { errorResponse, ValidationError } from '$lib/server/errors';

const FEATURE_KEY = 'one-time-gen';

/**
 * AI 一键生成模板
 *
 * 根据 Admin 提供的"使用说明"，调用 AI 自动生成模板的所有字段。
 * 使用 `one-time-gen` featureKey 对应的 Assignment。
 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const { description, assignments } = body as {
            description: string;
            assignments: Array<{ id: string; name: string; featureKey: string }>;
        };

        if (!description?.trim()) {
            return errorResponse(new ValidationError('使用说明不能为空'));
        }

        // 构建 Assignment 列表供 AI 参考
        const assignmentList = assignments?.length
            ? assignments
                .map((a) => `- id: "${a.id}", name: "${a.name}", featureKey: "${a.featureKey}"`)
                .join('\n')
            : '（无可用 Assignment）';

        const systemPrompt = `你是一个图片生成模板配置助手。根据用户提供的"使用说明"，生成一个完整的图片生成模板配置。

你必须严格输出一个 JSON 对象，不要输出任何其他内容（不要 markdown 代码块、不要解释文字）。

JSON 字段说明：
- name: 模板名称，简洁有吸引力（2-8个字）
- category: 模板分类（如：人物、风景、创意、商业、艺术等）
- prompt: 图片生成提示词，支持 {占位符} 语法让用户填写可变部分。提示词应该专业、详细，能产出高质量图片
- description: 对使用说明的优化和完善，让用户更容易理解如何使用此模板
- imageCountMin: 最少参考图数量（0-9），根据使用场景判断是否需要参考图
- imageCountMax: 最多参考图数量（0-9），0表示不限。注意：min=0 且 max=0 表示不限制
- assignmentId: 从可用 Assignment 列表中选择最合适的一个，返回其 id。如果没有合适的选择则返回 null

可用的 AI Proxy Assignment 列表：
${assignmentList}

注意事项：
1. prompt 中的 {占位符} 应该是用户需要自定义的部分，用简洁的中文命名
2. 根据使用说明判断是否需要参考图（如"换脸"、"风格迁移"等需要参考图）
3. assignmentId 根据模板的功能场景选择最匹配的 Assignment`;

        const aiService = new BaseAIService({ feature: FEATURE_KEY });
        await aiService.initialize();

        const result = await aiService.executeGenerate({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `使用说明：${description.trim()}` },
            ],
            maxOutputTokens: 2048,
            temperature: 0.7,
        });

        // 解析 AI 返回的 JSON
        let generated: Record<string, unknown>;
        try {
            // 尝试直接解析，兼容可能包含 markdown 代码块的情况
            let text = result.text.trim();
            const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (fenceMatch) {
                text = fenceMatch[1].trim();
            }
            generated = JSON.parse(text);
        } catch {
            return errorResponse(
                new ValidationError('AI 返回格式异常，请重试'),
            );
        }

        // 校验必要字段
        if (!generated.name || !generated.category || !generated.prompt) {
            return errorResponse(
                new ValidationError('AI 生成的内容缺少必要字段，请重试'),
            );
        }

        return json({
            success: true,
            data: {
                name: String(generated.name),
                category: String(generated.category),
                prompt: String(generated.prompt),
                description: generated.description ? String(generated.description) : description.trim(),
                imageCountMin: Number(generated.imageCountMin) || 0,
                imageCountMax: Number(generated.imageCountMax) || 0,
                assignmentId: generated.assignmentId ? String(generated.assignmentId) : null,
            },
        });
    } catch (error) {
        return errorResponse(error, 'AI 生成模板失败');
    }
};
