import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/ai/providers/[id]');

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const row = await queryOne(
      `SELECT c.*, p.provider_key, p.display_name, p.adapter_type
       FROM user_ai_provider_configs c
       JOIN ai_providers p ON p.id = c.provider_id
       WHERE c.id = $1 AND c.profile_id = 1`,
      [id],
    );
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(row);
  } catch (err) {
    log.error({ err, id }, 'Failed to get provider config');
    return NextResponse.json({ error: '获取配置失败' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { is_enabled } = body;
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (is_enabled !== undefined) {
      updates.push(`is_enabled = $${idx++}`);
      values.push(Boolean(is_enabled));
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id, 1);

    await execute(
      `UPDATE user_ai_provider_configs SET ${updates.join(', ')}
       WHERE id = $${idx++} AND profile_id = $${idx}`,
      values,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    log.error({ err, id }, 'Failed to update provider config');
    return NextResponse.json({ error: '更新配置失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    await execute(
      `DELETE FROM user_ai_provider_configs WHERE id = $1 AND profile_id = 2`,
      [id],
    );
    log.debug({ id }, 'Deleted provider config');
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error({ err, id }, 'Failed to delete provider config');
    return NextResponse.json({ error: '删除配置失败' }, { status: 500 });
  }
}
