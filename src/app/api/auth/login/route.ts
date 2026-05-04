/**
 * 用户登录 API
 * POST /api/auth/login
 */
import { NextRequest, NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth';
import { getAuthCookieOptions } from '@/lib/auth-cookie';
import { createLogger } from '@/lib/logger';

const log = createLogger('auth:login');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // 验证必填字段
    if (!email || !password) {
      return NextResponse.json(
        { error: '邮箱和密码不能为空' },
        { status: 400 }
      );
    }

    const result = await loginUser(email, password);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      redirectTo: '/',
    });

    // 设置 Cookie
    if (result.token) {
      const cookieOptions = getAuthCookieOptions(request);
      
      log.info({ 
        cookieOptions, 
        nodeEnv: process.env.NODE_ENV,
        dockerEnv: process.env.DOCKER_ENV 
      }, 'Setting auth cookie');
      
      response.cookies.set('auth_token', result.token, cookieOptions);
    }

    return response;
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
    }

    log.error({ err }, 'Login error');
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
