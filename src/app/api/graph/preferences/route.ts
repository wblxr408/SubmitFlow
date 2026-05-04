import { NextRequest, NextResponse } from 'next/server';
import { execute, query } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/graph/preferences');
const DEFAULT_PROFILE_ID = 1;

/**
 * GET /api/graph/preferences
 * 获取用户标签权重和方向偏好
 */
export async function GET() {
  try {
    const [tagPrefs, profile] = await Promise.all([
      query<{ tag_id: number; weight: number }>(
        `SELECT tag_id, weight
         FROM user_tag_prefs
         WHERE profile_id = $1`,
        [DEFAULT_PROFILE_ID],
      ),
      query<{ interested_directions: string[]; uninterested_directions: string[] }>(
        `SELECT interested_directions, uninterested_directions
         FROM profiles WHERE id = $1`,
        [DEFAULT_PROFILE_ID],
      ),
    ]);

    return NextResponse.json({
      prefs: tagPrefs,
      interested_directions: profile[0]?.interested_directions ?? [],
      uninterested_directions: profile[0]?.uninterested_directions ?? [],
    });
  } catch (err) {
    log.error({ err }, 'Failed to load preferences');
    return NextResponse.json({ error: '加载偏好失败' }, { status: 500 });
  }
}

/**
 * PATCH /api/graph/preferences
 * 批量更新标签权重
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { tag_weights } = body;

    if (Array.isArray(tag_weights) && tag_weights.length > 0) {
      for (const { tag_id, weight } of tag_weights) {
        if (typeof tag_id !== 'number' || typeof weight !== 'number') continue;
        await execute(
          `INSERT INTO user_tag_prefs (profile_id, tag_id, weight, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (profile_id, tag_id)
           DO UPDATE SET weight = $3, updated_at = NOW()`,
          [DEFAULT_PROFILE_ID, tag_id, weight],
        );
      }
    }

    log.debug({ count: tag_weights?.length ?? 0 }, 'Updated tag weights');
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error({ err }, 'Failed to update tag weights');
    return NextResponse.json({ error: '更新标签权重失败' }, { status: 500 });
  }
}

/**
 * POST /api/graph/preferences
 * 保存感兴趣/不感兴趣方向
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { interested_directions, uninterested_directions } = body;

    if (Array.isArray(interested_directions) || Array.isArray(uninterested_directions)) {
      await execute(
        `UPDATE profiles
         SET interested_directions = $1, uninterested_directions = $2, updated_at = NOW()
         WHERE id = $3`,
        [
          interested_directions ?? [],
          uninterested_directions ?? [],
          DEFAULT_PROFILE_ID,
        ],
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    log.error({ err }, 'Failed to save direction preferences');
    return NextResponse.json({ error: '保存方向偏好失败' }, { status: 500 });
  }
}
