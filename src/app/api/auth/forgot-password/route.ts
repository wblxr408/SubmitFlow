/**
 * 忘记密码 API
 * POST /api/auth/forgot-password
 * 发送密码重置邮件
 */
import { NextRequest, NextResponse } from 'next/server';
import { requestPasswordReset } from '@/lib/auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('auth:forgot-password');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: '邮箱不能为空' },
        { status: 400 }
      );
    }

    // 为防止邮箱枚举攻击，始终返回成功
    await requestPasswordReset(email);

    return NextResponse.json({
      success: true,
      message: '如果该邮箱已注册，将收到密码重置链接',
    });
  } catch (err) {
    log.error({ err }, 'Forgot password error');
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
