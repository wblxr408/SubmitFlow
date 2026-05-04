import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import type { JobFavorite, Job, Tag } from '@/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/favorites');
const DEFAULT_PROFILE_ID = 1;

/**
 * GET /api/favorites
 * 获取用户收藏的岗位列表
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'active';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(50, parseInt(searchParams.get('page_size') ?? '20', 10));
  const offset = (page - 1) * pageSize;

  try {
    const rows = await query<JobFavorite & { job: Job & { company_name: string; company_fame_score: number } }>(
      `SELECT
         f.*,
         j.id AS job_id,
         j.title,
         j.city,
         j.is_remote,
         j.internship_type,
         j.deadline,
         j.conversion_rate,
         j.status AS job_status,
         c.name AS company_name,
         c.fame_score AS company_fame_score,
         COALESCE(
           json_agg(
             DISTINCT jsonb_build_object(
               'id', t.id,
               'slug', t.slug,
               'label', t.label,
               'group_name', t.group_name,
               'color_hex', t.color_hex,
               'is_preset', t.is_preset,
               'created_at', t.created_at
             )
           ) FILTER (WHERE t.id IS NOT NULL),
           '[]'::json
         ) AS tags
       FROM job_favorites f
       JOIN jobs j ON j.id = f.job_id
       JOIN companies c ON c.id = j.company_id
       LEFT JOIN job_tags jt ON jt.job_id = j.id
       LEFT JOIN tags t ON t.id = jt.tag_id
       WHERE f.profile_id = $1 AND f.status = $2
       GROUP BY f.id, j.id, c.name, c.fame_score
       ORDER BY f.created_at DESC
       LIMIT $3 OFFSET $4`,
      [DEFAULT_PROFILE_ID, status, pageSize, offset],
    );

    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM job_favorites
       WHERE profile_id = $1 AND status = $2`,
      [DEFAULT_PROFILE_ID, status],
    );

    const total = Number.parseInt(countResult?.count ?? '0', 10);

    log.debug({ status, page, pageSize, total }, 'Listed favorites');

    return NextResponse.json({
      items: rows,
      page,
      pageSize,
      total,
      hasNextPage: offset + rows.length < total,
    });
  } catch (err) {
    log.error({ err }, 'Failed to list favorites');
    return NextResponse.json({ error: '获取收藏列表失败' }, { status: 500 });
  }
}

/**
 * POST /api/favorites
 * 添加岗位到收藏
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { job_id, note } = body;

    if (!job_id) {
      return NextResponse.json({ error: 'job_id is required' }, { status: 400 });
    }

    // 检查岗位是否存在
    const jobExists = await queryOne<{ id: number }>(
      'SELECT id FROM jobs WHERE id = $1 AND status = $2',
      [job_id, 'valid'],
    );

    if (!jobExists) {
      return NextResponse.json({ error: '岗位不存在或已下架' }, { status: 404 });
    }

    // 尝试插入或更新（upsert）
    const result = await queryOne<JobFavorite>(
      `INSERT INTO job_favorites (profile_id, job_id, note, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (profile_id, job_id)
       DO UPDATE SET
         note = EXCLUDED.note,
         status = 'active',
         updated_at = NOW()
       RETURNING *`,
      [DEFAULT_PROFILE_ID, job_id, note ?? null],
    );

    log.debug({ job_id }, 'Added to favorites');

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    log.error({ err }, 'Failed to add favorite');
    return NextResponse.json({ error: '添加收藏失败' }, { status: 500 });
  }
}

/**
 * DELETE /api/favorites?job_id=xxx
 * 根据 job_id 取消收藏
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('job_id');

  if (!jobId) {
    return NextResponse.json({ error: 'job_id is required' }, { status: 400 });
  }

  try {
    const result = await queryOne<JobFavorite>(
      `UPDATE job_favorites
       SET status = 'archived', updated_at = NOW()
       WHERE profile_id = $1 AND job_id = $2 AND status = 'active'
       RETURNING *`,
      [DEFAULT_PROFILE_ID, parseInt(jobId, 10)],
    );

    if (!result) {
      return NextResponse.json({ error: '收藏不存在' }, { status: 404 });
    }

    log.debug({ jobId }, 'Removed from favorites');

    return NextResponse.json({ success: true });
  } catch (err) {
    log.error({ err, jobId }, 'Failed to remove favorite');
    return NextResponse.json({ error: '删除收藏失败' }, { status: 500 });
  }
}
