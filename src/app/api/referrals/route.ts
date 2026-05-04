import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import type { Referral } from '@/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/referrals');
const DEFAULT_PROFILE_ID = 1;

/**
 * GET /api/referrals
 * 获取内推信息列表
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'active';
  const keyword = searchParams.get('keyword') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(50, parseInt(searchParams.get('page_size') ?? '20', 10));
  const offset = (page - 1) * pageSize;

  try {
    const conditions: string[] = ['r.profile_id = $1', 'r.status = $2'];
    const params: unknown[] = [DEFAULT_PROFILE_ID, status];
    let paramIdx = 3;

    if (keyword) {
      conditions.push(`(r.company_name ILIKE $${paramIdx} OR r.referrer_name ILIKE $${paramIdx} OR r.job_title ILIKE $${paramIdx})`);
      params.push(`%${keyword}%`);
      paramIdx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const rows = await query<Referral>(
      `SELECT
         r.*,
         COUNT(ul.id) AS usage_count,
         MAX(ul.used_at) AS last_used_at
       FROM referrals r
       LEFT JOIN referral_usage_logs ul ON ul.referral_id = r.id
       ${whereClause}
       GROUP BY r.id
       ORDER BY r.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, pageSize, offset],
    );

    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM referrals r ${whereClause}`,
      params,
    );

    const total = Number.parseInt(countResult?.count ?? '0', 10);

    log.debug({ status, keyword, page, pageSize, total }, 'Listed referrals');

    return NextResponse.json({
      items: rows,
      page,
      pageSize,
      total,
      hasNextPage: offset + rows.length < total,
    });
  } catch (err) {
    log.error({ err }, 'Failed to list referrals');
    return NextResponse.json({ error: '获取内推列表失败' }, { status: 500 });
  }
}

/**
 * POST /api/referrals
 * 创建内推信息
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      company_name,
      job_title,
      referrer_name,
      referrer_contact,
      referral_code,
      entry_url,
      notes,
    } = body;

    if (!company_name) {
      return NextResponse.json({ error: 'company_name is required' }, { status: 400 });
    }

    const result = await queryOne<Referral>(
      `INSERT INTO referrals (
         profile_id, company_name, job_title, referrer_name,
         referrer_contact, referral_code, entry_url, notes, source
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'manual')
       RETURNING *`,
      [
        DEFAULT_PROFILE_ID,
        company_name,
        job_title ?? null,
        referrer_name ?? null,
        referrer_contact ?? null,
        referral_code ?? null,
        entry_url ?? null,
        notes ?? null,
      ],
    );

    log.debug({ company_name }, 'Created referral');

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    log.error({ err }, 'Failed to create referral');
    return NextResponse.json({ error: '创建内推信息失败' }, { status: 500 });
  }
}
