import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/reminders/[id]');
const DEFAULT_PROFILE_ID = 1;

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  try {
    const body = await request.json();
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (body.reminder_type !== undefined) { fields.push(`reminder_type = $${i++}`); values.push(body.reminder_type); }
    if (body.days_before !== undefined) { fields.push(`days_before = $${i++}`); values.push(body.days_before); }
    if (body.job_id !== undefined) { fields.push(`job_id = $${i++}`); values.push(body.job_id); }
    if (body.channel !== undefined) { fields.push(`channel = $${i++}`); values.push(body.channel); }
    if (body.is_enabled !== undefined) { fields.push(`is_enabled = $${i++}`); values.push(body.is_enabled); }

    if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

    fields.push('updated_at = NOW()');
    values.push(id, DEFAULT_PROFILE_ID);

    const result = await queryOne(
      `UPDATE reminders SET ${fields.join(', ')} WHERE id = $${i++} AND profile_id = $${i} RETURNING *`,
      values,
    );

    if (!result) return NextResponse.json({ error: '提醒不存在' }, { status: 404 });
    log.debug({ id }, 'Updated reminder');
    return NextResponse.json(result);
  } catch (err) {
    log.error({ err, id }, 'Failed to update reminder');
    return NextResponse.json({ error: '更新提醒失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  try {
    const result = await queryOne(
      `DELETE FROM reminders WHERE id = $1 AND profile_id = $2 RETURNING *`,
      [id, DEFAULT_PROFILE_ID],
    );
    if (!result) return NextResponse.json({ error: '提醒不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error({ err, id }, 'Failed to delete reminder');
    return NextResponse.json({ error: '删除提醒失败' }, { status: 500 });
  }
}
