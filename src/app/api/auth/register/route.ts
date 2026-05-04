/**
 * 用户注册 API
 * POST /api/auth/register
 */
import { NextRequest, NextResponse } from 'next/server';
import { createUser } from '@/lib/auth';
import { getAuthCookieOptions } from '@/lib/auth-cookie';
import { createLogger } from '@/lib/logger';

const log = createLogger('auth:register');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, nickname } = body;

    // 验证必填字段
    if (!email || !password) {
      return NextResponse.json(
        { error: '邮箱和密码不能为空' },
        { status: 400 }
      );
    }

    const result = await createUser(email, password, nickname);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const response = NextResponse.json({
      success: true,
      redirectTo: '/',
    });

    // 设置 Cookie
    if (result.token) {
      response.cookies.set('auth_token', result.token, getAuthCookieOptions(request));
    }

    return response;
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
    }

    log.error({ err }, 'Register error');
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
