/**
 * 认证上下文辅助函数
 * 从请求中提取当前用户信息
 */
import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

export interface AuthContext {
  userId: number;
  email: string;
  role: string;
}

/**
 * 从请求中获取当前用户 ID
 * 优先级：headers['x-user-id'] > cookies['auth_token']
 */
export function getCurrentUserId(request: NextRequest): number | null {
  // 首先尝试从 headers 获取（中间件已注入）
  const userIdHeader = request.headers.get('x-user-id');
  if (userIdHeader) {
    const userId = parseInt(userIdHeader, 10);
    if (!isNaN(userId)) {
      return userId;
    }
  }

  // 回退到 Cookie
  const token = request.cookies.get('auth_token')?.value;
  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

/**
 * 从请求中获取完整认证上下文
 */
export function getAuthContext(request: NextRequest): AuthContext | null {
  // 首先尝试从 headers 获取
  const userIdHeader = request.headers.get('x-user-id');
  const emailHeader = request.headers.get('x-user-email');
  const roleHeader = request.headers.get('x-user-role');

  if (userIdHeader && emailHeader && roleHeader) {
    return {
      userId: parseInt(userIdHeader, 10),
      email: emailHeader,
      role: roleHeader,
    };
  }

  // 回退到 Cookie 验证
  const token = request.cookies.get('auth_token')?.value;
  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  return {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  };
}

/**
 * 验证请求是否已认证
 */
export function requireAuth(request: NextRequest): AuthContext {
  const context = getAuthContext(request);

  if (!context) {
    throw new AuthError('未登录，请先登录');
  }

  return context;
}

/**
 * 验证请求是否有管理员权限
 */
export function requireAdmin(request: NextRequest): AuthContext {
  const context = requireAuth(request);

  if (context.role !== 'admin') {
    throw new AuthError('需要管理员权限');
  }

  return context;
}

/**
 * 认证错误类
 */
export class AuthError extends Error {
  status: number;

  constructor(message: string, status: number = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}
