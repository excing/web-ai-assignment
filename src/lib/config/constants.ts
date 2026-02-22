/**
 * 应用全局常量配置
 */

// ─── 分页 ───────────────────────────────────────────────────

export const PAGINATION = {
	/** 统一每页数量 */
	DEFAULT_LIMIT: 20,
	/** 最大每页数量 */
	MAX_LIMIT: 100,
	/** 默认偏移量 */
	DEFAULT_OFFSET: 0,
} as const;

/**
 * 安全解析分页参数，防止 NaN、负数、超大值
 */
export function parsePagination(url: URL): { limit: number; offset: number } {
	const rawLimit = parseInt(url.searchParams.get('limit') || '');
	const rawOffset = parseInt(url.searchParams.get('offset') || '');
	return {
		limit: Number.isNaN(rawLimit) || rawLimit < 1 ? PAGINATION.DEFAULT_LIMIT : Math.min(rawLimit, PAGINATION.MAX_LIMIT),
		offset: Number.isNaN(rawOffset) || rawOffset < 0 ? PAGINATION.DEFAULT_OFFSET : rawOffset,
	};
}

// ─── AI Proxy ───────────────────────────────────────────────

export const AI_PROVIDER = {
	/** OpenAI */
	OPENAI: 'openai',
	/** Anthropic */
	ANTHROPIC: 'anthropic',
	/** Google */
	GOOGLE: 'google',
} as const;

export const HEALTH_STATUS = {
	/** 健康 */
	HEALTHY: 'healthy',
	/** 不健康 */
	UNHEALTHY: 'unhealthy',
} as const;

export const FAILOVER = {
	/** 默认渠道连续失败阈值：达到后切换到备份渠道 */
	PRIMARY_THRESHOLD: 5,
	/** 备份渠道连续失败阈值：unhealthyCount 达到此值触发应急（PRIMARY_THRESHOLD + 5） */
	EMERGENCY_THRESHOLD: 10,
	/** 默认渠道冷却时间（毫秒）：1 小时 */
	COOLDOWN_MS: 60 * 60 * 1000,
} as const;

// ─── 积分 ────────────────────────────────────────────────────

export const CREDITS = {
	/** 低余额警告阈值 */
	LOW_BALANCE_WARNING: 10,
	/** 固定扣费回退值（图片生成等，数据库未配置时使用） */
	DEFAULT_FIXED_COST: 5,
	/** 文件上传固定扣费 */
	UPLOAD_COST: 5,
	/** 动态计费回退值（数据库未配置时使用） */
	DEFAULT_DYNAMIC_PRICING: {
		/** 每千 token 输入费用 */
		INPUT_PER_1K: 1,
		/** 每千 token 输出费用 */
		OUTPUT_PER_1K: 2,
		/** 最低消费积分 */
		MINIMUM: 1,
	},
} as const;

// ─── UI ──────────────────────────────────────────────────────

export const UI = {
	/** 聊天页面自动滚动距底部阈值 (px) */
	CHAT_SCROLL_THRESHOLD: 100,
	/** 输入框最大高度 (px) */
	TEXTAREA_MAX_HEIGHT: 200,
} as const;

// ─── 聊天附件 ────────────────────────────────────────────────

export const CHAT_ATTACHMENTS = {
	/** 允许的图片 MIME 类型 */
	ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as string[],
	/** 单文件最大 (字节)：512KB */
	MAX_FILE_SIZE: 512 * 1024,
	/** 单次最多附件数 */
	MAX_FILES: 9,
} as const;

// ─── 图片生成 ──────────────────────────────────────────────

export type AspectRatio = '1:1' | '4:3' | '16:9' | '9:16';

export const IMAGE_GEN = {
	/** 单次最多参考图数量 */
	MAX_REFERENCE_IMAGES: 9,
	/** 合成画布最大边长 (px) */
	CANVAS_MAX_SIDE: 2048,
	/** 合成 JPEG 质量 */
	CANVAS_QUALITY: 0.85,
	/** 图片间距 (px) */
	CANVAS_GAP: 8,
	/** 可选画布比例 */
	ASPECT_RATIOS: ['1:1', '4:3', '16:9', '9:16'] as AspectRatio[],
	/** 默认画布比例 */
	DEFAULT_ASPECT_RATIO: '1:1' as AspectRatio,
} as const;
