import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/reminders');
const DEFAULT_PROFILE_ID = 1;

export async function GET(request: NextRequest) {
  try {
    const rows = await query(
      `SELECT * FROM reminders WHERE profile_id = $1 ORDER BY created_at DESC`,
      [DEFAULT_PROFILE_ID],
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    log.error({ err }, 'Failed to list reminders');
    return NextResponse.json({ error: '获取提醒配置失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reminder_type, days_before, job_id, channel, is_enabled } = body;

    const result = await queryOne(
      `INSERT INTO reminders (profile_id, reminder_type, days_before, job_id, channel, is_enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [DEFAULT_PROFILE_ID, reminder_type ?? 'deadline', days_before ?? 3, job_id ?? null, channel ?? 'email', is_enabled ?? true],
    );

    log.debug({ reminder_type, days_before, channel }, 'Created reminder');
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    log.error({ err }, 'Failed to create reminder');
    return NextResponse.json({ error: '创建提醒失败' }, { status: 500 });
  }
}
