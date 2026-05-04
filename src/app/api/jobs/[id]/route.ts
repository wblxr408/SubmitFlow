import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import type { Job, Company, JobTag, JobEntrypoint } from '@/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const jobId = parseInt(params.id, 10);
  if (Number.isNaN(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
  }

  const job = await queryOne<Job & { company_name: string; company_alias_names: string[] }>(
    `SELECT j.*, c.name as company_name, c.alias_names as company_alias_names
     FROM jobs j
     JOIN companies c ON c.id = j.company_id
     WHERE j.id = $1`,
    [jobId],
  );

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const [tags, entrypoints] = await Promise.all([
    query<JobTag & { tag_label: string; tag_color: string }>(
      `SELECT jt.*, t.label as tag_label, t.color_hex as tag_color
       FROM job_tags jt
       JOIN tags t ON t.id = jt.tag_id
       WHERE jt.job_id = $1`,
      [jobId],
    ),
    query<JobEntrypoint>(
      `SELECT * FROM job_entrypoints
       WHERE job_id = $1 AND status = 'active'
       ORDER BY entry_type`,
      [jobId],
    ),
  ]);

  return NextResponse.json({ ...job, tags, entrypoints });
}
