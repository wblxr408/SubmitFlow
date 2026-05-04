/**
 * 重置密码 API
 * POST /api/auth/reset-password
 */
import { NextRequest, NextResponse } from 'next/server';
import { resetPassword } from '@/lib/auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('auth:reset-password');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: 'token 和新密码不能为空' },
        { status: 400 }
      );
    }

    const result = await resetPassword(token, password);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: '密码重置成功',
    });
  } catch (err) {
    log.error({ err }, 'Reset password error');
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
