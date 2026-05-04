import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import type { JobFavorite } from '@/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/favorites/[id]');
const DEFAULT_PROFILE_ID = 1;

/**
 * GET /api/favorites/:id
 * 获取单个收藏详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const favoriteId = parseInt(params.id, 10);

  if (isNaN(favoriteId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const result = await queryOne<JobFavorite & { company_name: string; company_fame_score: number }>(
      `SELECT
         f.*,
         j.title AS job_title,
         j.city AS job_city,
         j.deadline AS job_deadline,
         c.name AS company_name,
         c.fame_score AS company_fame_score
       FROM job_favorites f
       JOIN jobs j ON j.id = f.job_id
       JOIN companies c ON c.id = j.company_id
       WHERE f.id = $1 AND f.profile_id = $2`,
      [favoriteId, DEFAULT_PROFILE_ID],
    );

    if (!result) {
      return NextResponse.json({ error: '收藏不存在' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    log.error({ err, favoriteId }, 'Failed to get favorite');
    return NextResponse.json({ error: '获取收藏详情失败' }, { status: 500 });
  }
}

/**
 * PATCH /api/favorites/:id
 * 更新收藏备注或状态
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const favoriteId = parseInt(params.id, 10);

  if (isNaN(favoriteId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { note, status } = body;

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (note !== undefined) {
      updates.push(`note = $${paramIdx++}`);
      values.push(note);
    }

    if (status !== undefined) {
      updates.push(`status = $${paramIdx++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push('updated_at = NOW()');
    values.push(favoriteId, DEFAULT_PROFILE_ID);

    const result = await queryOne<JobFavorite>(
      `UPDATE job_favorites
       SET ${updates.join(', ')}
       WHERE id = $${paramIdx++} AND profile_id = $${paramIdx}
       RETURNING *`,
      values,
    );

    if (!result) {
      return NextResponse.json({ error: '收藏不存在' }, { status: 404 });
    }

    log.debug({ favoriteId, note, status }, 'Updated favorite');

    return NextResponse.json(result);
  } catch (err) {
    log.error({ err, favoriteId }, 'Failed to update favorite');
    return NextResponse.json({ error: '更新收藏失败' }, { status: 500 });
  }
}

/**
 * DELETE /api/favorites/:id
 * 取消收藏（软删除 -> 归档）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const favoriteId = parseInt(params.id, 10);

  if (isNaN(favoriteId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const result = await queryOne<JobFavorite>(
      `UPDATE job_favorites
       SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND profile_id = $2
       RETURNING *`,
      [favoriteId, DEFAULT_PROFILE_ID],
    );

    if (!result) {
      return NextResponse.json({ error: '收藏不存在' }, { status: 404 });
    }

    log.debug({ favoriteId }, 'Archived favorite');

    return NextResponse.json({ success: true });
  } catch (err) {
    log.error({ err, favoriteId }, 'Failed to archive favorite');
    return NextResponse.json({ error: '删除收藏失败' }, { status: 500 });
  }
}
