export interface CreditPackage {
    id: string;
    name: string;
    credits: number;
    price: number;
    description: string | null;
    isActive: boolean;
    isVisible: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface RedemptionCode {
    id: string;
    code: string;
    packageId: string;
    packageName: string;
    packageCredits: number;
    packagePrice: number;
    expiresAt: string | null;
    maxRedemptions: number | null;
    currentRedemptions: number;
    isActive: boolean;
    createdBy: string | null;
    createdAt: string;
}

export interface CreditTransaction {
    id: string;
    userId: string | null;
    amount: number;
    type: string;
    referenceId: string | null;
    description: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
}

export interface RedemptionDetail {
    id: string;
    userId: string | null;
    userEmail: string | null;
    userName: string | null;
    amount: number;
    description: string | null;
    createdAt: string;
    refunded: boolean;
}

export interface RedeemResponse {
    message: string;
    creditsAdded: number;
    newBalance: number;
}

export interface RefundResponse {
    message: string;
    creditsDeducted: number;
    newBalance: number;
}
