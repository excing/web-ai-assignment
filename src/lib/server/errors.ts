import { json } from '@sveltejs/kit';

// ============================================================================
// 统一错误基类
// ============================================================================

export class AppError extends Error {
    constructor(
        message: string,
        public code: string,
        public httpStatus: number = 500
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export class NotFoundError extends AppError {
    constructor(message: string = '资源不存在', code: string = 'NOT_FOUND') {
        super(message, code, 404);
        this.name = 'NotFoundError';
    }
}

export class ValidationError extends AppError {
    constructor(message: string = '请求参数无效', code: string = 'VALIDATION_ERROR') {
        super(message, code, 400);
        this.name = 'ValidationError';
    }
}

// ============================================================================
// 统一错误响应
// ============================================================================

/**
 * 将任意错误转为标准 JSON Response
 */
export function errorResponse(error: unknown, fallbackMessage: string = '操作失败'): Response {
    if (error instanceof AppError) {
        return json(
            { error: error.message, code: error.code },
            { status: error.httpStatus }
        );
    }

    if (error instanceof Error) {
        console.error(error.message, error);
        return json(
            { error: fallbackMessage, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }

    console.error('Unknown error', String(error));
    return json(
        { error: fallbackMessage, code: 'UNKNOWN_ERROR' },
        { status: 500 }
    );
}
