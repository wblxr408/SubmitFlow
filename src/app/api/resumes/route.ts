import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { query } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/resumes');
const DEFAULT_PROFILE_ID = 1;
const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'resumes');

export async function GET() {
  try {
    const rows = await query(
      `SELECT * FROM resumes WHERE profile_id = $1 ORDER BY is_default DESC, created_at DESC`,
      [DEFAULT_PROFILE_ID],
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    log.error({ err }, 'Failed to list resumes');
    return NextResponse.json({ error: '获取简历列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const tags = formData.get('tags') as string | null;
    const notes = formData.get('notes') as string | null;
    const is_default = formData.get('is_default') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    const ext = file.name.split('.').pop() ?? 'pdf';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = join(UPLOAD_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const rows = await query(
      `INSERT INTO resumes (profile_id, filename, original_name, file_path, file_size, mime_type, tags, notes, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        DEFAULT_PROFILE_ID,
        filename,
        file.name,
        `/uploads/resumes/${filename}`,
        buffer.length,
        file.type || 'application/pdf',
        tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        notes ?? null,
        is_default,
      ],
    );

    log.debug({ filename: file.name }, 'Uploaded resume');
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    log.error({ err }, 'Failed to upload resume');
    return NextResponse.json({ error: '上传简历失败' }, { status: 500 });
  }
}
