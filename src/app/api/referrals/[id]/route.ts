import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import type { Referral, ReferralUsageLog } from '@/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/referrals/[id]');
const DEFAULT_PROFILE_ID = 1;

/**
 * GET /api/referrals/:id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const referralId = parseInt(params.id, 10);
  if (isNaN(referralId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const result = await queryOne<Referral>(
      `SELECT
         r.*,
         COUNT(ul.id) AS usage_count,
         MAX(ul.used_at) AS last_used_at
       FROM referrals r
       LEFT JOIN referral_usage_logs ul ON ul.referral_id = r.id
       WHERE r.id = $1 AND r.profile_id = $2
       GROUP BY r.id`,
      [referralId, DEFAULT_PROFILE_ID],
    );

    if (!result) {
      return NextResponse.json({ error: '内推信息不存在' }, { status: 404 });
    }

    const usageLogs = await query<ReferralUsageLog>(
      `SELECT ul.*
       FROM referral_usage_logs ul
       WHERE ul.referral_id = $1
       ORDER BY ul.used_at DESC
       LIMIT 20`,
      [referralId],
    );

    return NextResponse.json({ ...result, usage_logs: usageLogs });
  } catch (err) {
    log.error({ err, referralId }, 'Failed to get referral');
    return NextResponse.json({ error: '获取内推详情失败' }, { status: 500 });
  }
}

/**
 * PATCH /api/referrals/:id
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const referralId = parseInt(params.id, 10);
  if (isNaN(referralId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const {
      company_name, job_title, referrer_name,
      referrer_contact, referral_code, entry_url, notes, status,
    } = body;

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (company_name !== undefined) { updates.push(`company_name = $${paramIdx++}`); values.push(company_name); }
    if (job_title !== undefined) { updates.push(`job_title = $${paramIdx++}`); values.push(job_title); }
    if (referrer_name !== undefined) { updates.push(`referrer_name = $${paramIdx++}`); values.push(referrer_name); }
    if (referrer_contact !== undefined) { updates.push(`referrer_contact = $${paramIdx++}`); values.push(referrer_contact); }
    if (referral_code !== undefined) { updates.push(`referral_code = $${paramIdx++}`); values.push(referral_code); }
    if (entry_url !== undefined) { updates.push(`entry_url = $${paramIdx++}`); values.push(entry_url); }
    if (notes !== undefined) { updates.push(`notes = $${paramIdx++}`); values.push(notes); }
    if (status !== undefined) { updates.push(`status = $${paramIdx++}`); values.push(status); }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push('updated_at = NOW()');
    values.push(referralId, DEFAULT_PROFILE_ID);

    const result = await queryOne<Referral>(
      `UPDATE referrals SET ${updates.join(', ')}
       WHERE id = $${paramIdx++} AND profile_id = $${paramIdx}
       RETURNING *`,
      values,
    );

    if (!result) {
      return NextResponse.json({ error: '内推信息不存在' }, { status: 404 });
    }

    log.debug({ referralId }, 'Updated referral');
    return NextResponse.json(result);
  } catch (err) {
    log.error({ err, referralId }, 'Failed to update referral');
    return NextResponse.json({ error: '更新内推信息失败' }, { status: 500 });
  }
}

/**
 * DELETE /api/referrals/:id
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const referralId = parseInt(params.id, 10);
  if (isNaN(referralId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const result = await queryOne<Referral>(
      `UPDATE referrals
       SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND profile_id = $2
       RETURNING *`,
      [referralId, DEFAULT_PROFILE_ID],
    );

    if (!result) {
      return NextResponse.json({ error: '内推信息不存在' }, { status: 404 });
    }

    log.debug({ referralId }, 'Archived referral');
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error({ err, referralId }, 'Failed to archive referral');
    return NextResponse.json({ error: '删除内推信息失败' }, { status: 500 });
  }
}
