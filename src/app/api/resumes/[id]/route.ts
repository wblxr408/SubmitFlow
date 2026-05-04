import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/resumes/[id]');
const DEFAULT_PROFILE_ID = 1;

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  try {
    const body = await request.json();
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (body.tags !== undefined) { fields.push(`tags = $${i++}`); values.push(body.tags); }
    if (body.notes !== undefined) { fields.push(`notes = $${i++}`); values.push(body.notes); }
    if (body.is_default !== undefined) { fields.push(`is_default = $${i++}`); values.push(body.is_default); }

    if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

    fields.push('updated_at = NOW()');
    values.push(id, DEFAULT_PROFILE_ID);

    const result = await queryOne(
      `UPDATE resumes SET ${fields.join(', ')} WHERE id = $${i++} AND profile_id = $${i} RETURNING *`,
      values,
    );

    if (!result) return NextResponse.json({ error: '简历不存在' }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    log.error({ err, id }, 'Failed to update resume');
    return NextResponse.json({ error: '更新简历失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  try {
    const result = await queryOne(
      `DELETE FROM resumes WHERE id = $1 AND profile_id = $2 RETURNING *`,
      [id, DEFAULT_PROFILE_ID],
    );
    if (!result) return NextResponse.json({ error: '简历不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error({ err, id }, 'Failed to delete resume');
    return NextResponse.json({ error: '删除简历失败' }, { status: 500 });
  }
}
