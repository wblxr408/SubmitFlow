/**
 * 邮箱验证 API
 * POST /api/auth/verify
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyUserEmail } from '@/lib/auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('auth:verify');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: '验证 token 不能为空' },
        { status: 400 }
      );
    }

    const result = await verifyUserEmail(token);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: '邮箱验证成功',
    });
  } catch (err) {
    log.error({ err }, 'Verify error');
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
