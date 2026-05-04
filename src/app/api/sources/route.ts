import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/sources');

export async function GET() {
  try {
    const rows = await query(
      `SELECT
         id,
         source_name,
         source_type,
         industry_scope,
         is_enabled,
         priority,
         last_crawled_at,
         created_at
       FROM job_sources
       ORDER BY priority DESC, source_name`,
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    log.error({ err }, 'Failed to list sources');
    return NextResponse.json({ error: '获取来源失败' }, { status: 500 });
  }
}
