import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/favorites/check');
const DEFAULT_PROFILE_ID = 1;

/**
 * GET /api/favorites/check?job_ids=1,2,3
 * 批量检查岗位是否被收藏
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobIds = searchParams.get('job_ids');

  if (!jobIds) {
    return NextResponse.json({ error: 'job_ids is required' }, { status: 400 });
  }

  try {
    const ids = jobIds.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id));

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Invalid job_ids' }, { status: 400 });
    }

    const rows = await query<{ job_id: number }>(
      `SELECT job_id
       FROM job_favorites
       WHERE profile_id = $1 AND status = 'active' AND job_id = ANY($2)`,
      [DEFAULT_PROFILE_ID, ids],
    );

    const favoritedIds = new Set(rows.map((r) => r.job_id));

    log.debug({ ids, favoritedCount: rows.length }, 'Checked favorites');

    return NextResponse.json({
      favorited: ids.map((id) => ({
        job_id: id,
        is_favorited: favoritedIds.has(id),
      })),
    });
  } catch (err) {
    log.error({ err }, 'Failed to check favorites');
    return NextResponse.json({ error: '检查收藏状态失败' }, { status: 500 });
  }
}
