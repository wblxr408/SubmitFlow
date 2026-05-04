/**
 * 更新个人资料 API
 * PATCH /api/auth/profile
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, updateUserProfile } from '@/lib/auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('auth:profile');

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    const body = await request.json();
    const { nickname, email } = body;

    const result = await updateUserProfile(payload.userId, { nickname, email });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: result.user!.id,
        email: result.user!.email,
        nickname: result.user!.nickname,
        role: result.user!.role,
      },
    });
  } catch (err) {
    log.error({ err }, 'Update profile error');
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
