import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/reminders/check');

export async function GET() {
  try {
    const rows = await query<{
      id: number;
      job_title: string | null;
      company_name: string | null;
      deadline: string | null;
      days_before: number;
    }>(
      `SELECT
         r.id,
         r.reminder_type,
         r.days_before,
         r.channel,
         r.is_enabled,
         j.title AS job_title,
         c.name AS company_name,
         j.deadline
       FROM reminders r
       LEFT JOIN jobs j ON j.id = r.job_id
       LEFT JOIN companies c ON c.id = j.company_id
       WHERE r.profile_id = 1
         AND r.is_enabled = TRUE
         AND r.reminder_type = 'deadline'
       ORDER BY r.created_at DESC`,
    );

    const today = new Date();
    const upcoming: Array<Record<string, unknown>> = [];

    for (const row of rows) {
      if (!row.deadline) continue;
      const deadline = new Date(row.deadline);
      const diff = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diff > 0 && diff <= (row.days_before ?? 3)) {
        upcoming.push({
          reminder_id: row.id,
          company: row.company_name,
          job: row.job_title,
          deadline: row.deadline,
          days_left: diff,
        });
      }
    }

    log.debug({ count: upcoming.length }, 'Checked upcoming reminders');
    return NextResponse.json({ items: upcoming });
  } catch (err) {
    log.error({ err }, 'Failed to check reminders');
    return NextResponse.json({ error: '检查提醒失败' }, { status: 500 });
  }
}
