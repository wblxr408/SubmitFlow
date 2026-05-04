/**
 * 投递私有标签 API
 * POST: 添加标签
 * GET: 获取标签列表
 * DELETE: 删除标签
 */
import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

const DEFAULT_PROFILE_ID = 1;

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const applicationId = parseInt(params.id, 10);
  if (Number.isNaN(applicationId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const rows = await query(
    `SELECT * FROM application_private_tags WHERE application_id = $1 ORDER BY created_at`,
    [applicationId],
  );
  return NextResponse.json({ tags: rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const applicationId = parseInt(params.id, 10);
  if (Number.isNaN(applicationId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const body = await request.json();
  const { label } = body;
  if (!label?.trim()) {
    return NextResponse.json({ error: 'label is required' }, { status: 400 });
  }
  const rows = await query(
    `INSERT INTO application_private_tags (application_id, label)
     VALUES ($1, $2)
     RETURNING *`,
    [applicationId, label.trim()],
  );
  return NextResponse.json({ tag: rows[0] }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const applicationId = parseInt(params.id, 10);
  if (Number.isNaN(applicationId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const { searchParams } = new URL(request.url);
  const tagId = parseInt(searchParams.get('tag_id') ?? '', 10);
  if (Number.isNaN(tagId)) {
    return NextResponse.json({ error: 'tag_id is required' }, { status: 400 });
  }
  await execute(
    `DELETE FROM application_private_tags WHERE id = $1 AND application_id = $2`,
    [tagId, applicationId],
  );
  return NextResponse.json({ success: true });
}
