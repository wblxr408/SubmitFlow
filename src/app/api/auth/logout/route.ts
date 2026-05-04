/**
 * 用户登出 API
 * POST /api/auth/logout
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthCookieOptions } from '@/lib/auth-cookie';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });

  // 清除 Cookie
  response.cookies.set('auth_token', '', {
    ...getAuthCookieOptions(request),
    maxAge: 0,
  });

  return response;
}
