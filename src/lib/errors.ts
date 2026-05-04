/**
 * 统一错误类定义
 * 覆盖业务错误、网络错误、验证错误等场景
 */

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    const msg = id !== undefined ? `${resource} ${id} not found` : `${resource} not found`;
    super('NOT_FOUND', msg, 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403);
    this.name = 'ForbiddenError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: unknown) {
    super(`EXTERNAL_${service.toUpperCase()}_ERROR`, message, 502, details);
    this.name = 'ExternalServiceError';
  }
}

/**
 * 全局错误处理映射
 * 用于 Next.js API 路由的 error 响应
 */
export function formatError(error: unknown): {
  code: string;
  message: string;
  details?: unknown;
} {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }
  if (error instanceof Error) {
    return {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal error' : error.message,
    };
  }
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unknown error occurred',
  };
}
