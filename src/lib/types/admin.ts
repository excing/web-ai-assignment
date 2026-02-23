// ============ AI Proxy 管理 ============

export interface AiProxyItem {
	id: string;
	name: string;
	provider: string;
	baseUrl: string;
	models: string[];
	isActive: boolean;
	priority: number;
	metadata: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface AiProxyAssignment {
	id: string;
	name: string;
	description: string | null;
	featureKey: string;
	proxyId: string;
	defaultModel: string | null;
	isActive: boolean;
	// 备份渠道
	backupProxyId: string | null;
	backupModel: string | null;
	// 计费配置
	billingMode: string | null;
	inputPer1k: number | null;
	outputPer1k: number | null;
	minimum: number | null;
	// 健康检查
	healthStatus: string;
	unhealthyCount: number;
	lastError: string | null;
	lastErrorAt: string | null;
	createdAt: string;
	updatedAt: string;
	// 关联信息
	proxyName: string;
	proxyProvider: string;
	backupProxyName: string | null;
}

export interface ProxyFormData {
	id: string;
	name: string;
	provider: string;
	baseUrl: string;
	apiKey: string;
	models: string; // 逗号分隔的模型列表
	priority: number;
	isActive: boolean;
}

export interface AssignmentFormData {
	id: string;
	name: string;
	description: string;
	featureKey: string;
	proxyId: string;
	defaultModel: string;
	isActive: boolean;
	// 备份渠道
	backupProxyId: string;
	backupModel: string;
	// 计费配置
	billingMode: string; // '' | 'fixed' | 'dynamic'
	inputPer1k: string;
	outputPer1k: string;
	minimum: string;
}

// ============ 图片生成模板管理 ============

export interface ImageGenTemplate {
	id: string;
	name: string;
	category: string;
	prompt: string;
	previewImageUrl: string | null;
	description: string | null;
	imageCountMin: number;
	imageCountMax: number;
	assignmentId: string | null;
	sortOrder: number;
	isPinned: boolean;
	isActive: boolean;
	requiredLevel: number;
	createdAt: string;
	updatedAt: string;
	// 关联信息（JOIN 查询时填充）
	assignmentName?: string;
	featureKey?: string;
}

export interface TemplateFormData {
	id: string;
	name: string;
	category: string;
	prompt: string;
	previewImageUrl: string;
	description: string;
	imageCountMin: string;
	imageCountMax: string;
	assignmentId: string;
	sortOrder: string;
	isPinned: boolean;
	isActive: boolean;
	requiredLevel: string;
}
