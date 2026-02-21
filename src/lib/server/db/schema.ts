import {
    boolean,
    integer,
    bigint,
    index,
    jsonb,
    pgTable,
    text,
    timestamp
} from 'drizzle-orm/pg-core';

// Better Auth Tables
export const user = pgTable('user', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('emailVerified').notNull().default(false),
    image: text('image'),
    creditBalance: integer('credit_balance').notNull().default(0),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow()
});

export const session = pgTable('session', {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expiresAt').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    userId: text('userId')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' })
}, (table) => [
    index('session_userId_idx').on(table.userId),
]);

export const account = pgTable('account', {
    id: text('id').primaryKey(),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    userId: text('userId')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
    refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow()
}, (table) => [
    index('account_userId_idx').on(table.userId),
]);

export const verification = pgTable('verification', {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expiresAt').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow()
});

export const rateLimit = pgTable("rate_limit", {
    id: text("id").primaryKey(),
    key: text("key"),
    count: integer("count"),
    lastRequest: bigint("last_request", { mode: "number" }),
}, (table) => [
    index('rate_limit_key_idx').on(table.key),
]);

// Credits Module Tables

export const creditPackage = pgTable('credit_package', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    credits: integer('credits').notNull(),
    price: integer('price').notNull().default(0),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    isVisible: boolean('is_visible').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const redemptionCode = pgTable('redemption_code', {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    packageId: text('package_id').notNull()
        .references(() => creditPackage.id, { onDelete: 'restrict' }),
    packageName: text('package_name').notNull(),
    packageCredits: integer('package_credits').notNull(),
    packagePrice: integer('package_price').notNull(),
    expiresAt: timestamp('expires_at'),
    maxRedemptions: integer('max_redemptions'),
    currentRedemptions: integer('current_redemptions').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: text('created_by')
        .references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
    index('redemption_code_code_idx').on(table.code),
    index('redemption_code_package_id_idx').on(table.packageId),
]);

export const creditTransaction = pgTable('credit_transaction', {
    id: text('id').primaryKey(),
    userId: text('user_id')
        .references(() => user.id, { onDelete: 'set null' }),
    amount: integer('amount').notNull(),
    type: text('type').notNull(),
    referenceId: text('reference_id'),
    description: text('description'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
    index('credit_transaction_user_id_idx').on(table.userId),
    index('credit_transaction_type_idx').on(table.type),
]);

// AI Proxy Tables

// AI Proxy - AI 代理配置表
export const aiProxy = pgTable('ai_proxy', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    provider: text('provider').notNull(), // 'openai' | 'anthropic' | 'google'
    baseUrl: text('base_url').notNull(),
    apiKey: text('api_key').notNull(), // AES-256 加密存储
    models: jsonb('models').$type<string[]>().notNull().default([]), // 支持的模型列表
    isActive: boolean('is_active').notNull().default(true),
    priority: integer('priority').notNull().default(0), // 优先级，数值越大越优先
    metadata: text('metadata'), // 扩展字段（JSON 字符串）
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// AI Proxy Assignment - 功能与 Proxy 绑定关系表
export const aiProxyAssignment = pgTable('ai_proxy_assignment', {
    id: text('id').primaryKey(),
    name: text('name').notNull(), // 显示名称，如 "聊天功能 - Kimi"
    description: text('description'), // 描述说明
    featureKey: text('feature_key').notNull(), // 功能标识，如 'chat', 'image_generation'
    proxyId: text('proxy_id').notNull()
        .references(() => aiProxy.id, { onDelete: 'cascade' }),
    defaultModel: text('default_model'), // 该功能的默认模型
    isActive: boolean('is_active').notNull().default(true),
    // 备份渠道（可选）
    backupProxyId: text('backup_proxy_id')
        .references(() => aiProxy.id, { onDelete: 'set null' }),
    backupModel: text('backup_model'),
    // 计费配置（按功能计费，与渠道无关）
    billingMode: text('billing_mode'), // 'fixed' | 'dynamic' | null
    inputPer1k: integer('input_per_1k'), // 每千 tokens 输入费用（积分）
    outputPer1k: integer('output_per_1k'), // 每千 tokens 输出费用（积分）
    minimum: integer('minimum'), // 最小扣款（固定模式下为固定扣费积分）
    // 被动健康检查（复用单套字段跟踪默认+备份渠道）
    // unhealthyCount 0~4: 默认渠道累积失败; ≥5: 切备份; 5~9: 备份累积失败; ≥10: 应急
    healthStatus: text('health_status').notNull().default('healthy'), // 'healthy' | 'unhealthy'
    unhealthyCount: integer('unhealthy_count').notNull().default(0),
    lastError: text('last_error'),
    lastErrorAt: timestamp('last_error_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Image Generation Template - 图片生成模板表
export const imageGenTemplate = pgTable('image_gen_template', {
    id: text('id').primaryKey(),
    name: text('name').notNull(), // 模板名称
    category: text('category').notNull(), // 分类（自由文本）
    prompt: text('prompt').notNull(), // 提示词，支持 {占位符}
    previewImageUrl: text('preview_image_url'), // 效果图 URL
    description: text('description'), // 使用说明
    imageCountMin: integer('image_count_min').notNull().default(0), // 最少参考图数量
    imageCountMax: integer('image_count_max').notNull().default(0), // 最多参考图数量（0-0 表示不限）
    assignmentId: text('assignment_id')
        .references(() => aiProxyAssignment.id, { onDelete: 'set null' }), // 关联的 AI Proxy Assignment
    sortOrder: integer('sort_order').notNull().default(0), // 排序（数值越大越靠前）
    isPinned: boolean('is_pinned').notNull().default(false), // 是否置顶
    isActive: boolean('is_active').notNull().default(true), // 是否启用
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => [
    index('image_gen_template_category_idx').on(table.category),
    index('image_gen_template_is_active_idx').on(table.isActive),
]);
