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
    // 被动健康检查
    healthStatus: text('health_status').notNull().default('healthy'), // 'healthy' | 'unhealthy'
    unhealthyCount: integer('unhealthy_count').notNull().default(0), // 连续失败次数
    lastError: text('last_error'), // 最近一次错误信息
    lastErrorAt: timestamp('last_error_at'), // 最近一次错误时间
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
    models: jsonb('models').$type<string[]>(), // 可用模型范围（allowlist），null 表示该 Proxy 所有模型均可用
    defaultModel: text('default_model'), // 该功能的默认模型
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
});
