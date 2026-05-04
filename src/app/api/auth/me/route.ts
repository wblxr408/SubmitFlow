/**
 * 获取当前用户信息 API
 * GET /api/auth/me
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getUserById } from '@/lib/auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('auth:me');

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    const user = await getUserById(payload.userId);
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        email_verified: user.email_verified,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    log.error({ err }, 'Get user error');
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
