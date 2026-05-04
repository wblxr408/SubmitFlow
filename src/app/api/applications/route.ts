import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ApplicationTracker } from '@/server/application';
import type { ApplicationStatus } from '@/types';

const DEFAULT_PROFILE_ID = 1;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as ApplicationStatus | null;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(50, parseInt(searchParams.get('page_size') ?? '20', 10));

  // 单次批量获取所有状态计数（避免 N+1 请求）
  if (searchParams.get('counts_only') === 'true') {
    const counts = await query<Record<string, string>>(
      `SELECT status, COUNT(*)::text AS count
       FROM applications
       WHERE profile_id = $1
       GROUP BY status`,
      [DEFAULT_PROFILE_ID],
    );
    const result: Record<string, number> = { all: 0 };
    for (const row of counts) {
      const n = parseInt(row.count, 10);
      result[row.status] = n;
      result.all += n;
    }
    return NextResponse.json(result);
  }

  const tracker = new ApplicationTracker(DEFAULT_PROFILE_ID);
  const result = await tracker.list({ status: status ?? undefined, page, pageSize });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { job_id, job_entrypoint_id } = body;

  if (!job_id) {
    return NextResponse.json({ error: 'job_id is required' }, { status: 400 });
  }

  const tracker = new ApplicationTracker(DEFAULT_PROFILE_ID);
  try {
    const app = await tracker.create(job_id, job_entrypoint_id ?? null);
    return NextResponse.json(app, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
