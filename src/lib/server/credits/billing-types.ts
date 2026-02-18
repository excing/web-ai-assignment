// ─── 扣费服务 ───

/** 扣费请求参数 */
export interface DeductionInput {
	userId: string;
	amount: number;
	description: string;
	metadata: Record<string, unknown>;
	/** 触发扣费的端点路径或 assignmentId */
	endpoint: string;
}

/** 扣费结果 */
export interface DeductionResult {
	success: boolean;
	transactionId?: string;
	newBalance?: number;
	error?: string;
}
