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
}
