/**
 * 认证中间件（Edge Runtime）
 * 仅使用 auth-jwt-edge，禁止 import @/lib/auth（会拉取 bcrypt 等原生模块）
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAuthToken } from '@/lib/auth-jwt-edge';

// 公开路径（无需认证）
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/verify-email',
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify',
  '/api/health',
  '/api/graph/taxonomy',
  '/api/graph/preferences',
];

const API_PREFIX = '/api/';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth_token')?.value;

  if (!pathname.startsWith(API_PREFIX)) {
    if (!token && pathname !== '/login') {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (token) {
      const payload = await verifyAuthToken(token);
      if (!payload) {
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete('auth_token');
        return response;
      }

      if (pathname === '/login' || pathname === '/register') {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }

    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.json(
      { error: '未登录', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  const payload = await verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: '登录已过期', code: 'TOKEN_EXPIRED' },
      { status: 401 },
    );
  }

  const headers = new Headers(request.headers);
  headers.set('x-user-id', String(payload.userId));
  headers.set('x-user-email', payload.email);
  headers.set('x-user-role', payload.role);

  return NextResponse.next({
    request: {
      headers,
    },
  });
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (publicPath) =>
      pathname === publicPath || pathname.startsWith(publicPath + '/'),
  );
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
