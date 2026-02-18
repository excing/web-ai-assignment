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
	// 计费配置
	billingMode: string; // '' | 'fixed' | 'dynamic'
	inputPer1k: string;
	outputPer1k: string;
	minimum: string;
}
