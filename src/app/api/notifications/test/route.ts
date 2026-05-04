import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/notifications/test');

export async function POST() {
  try {
    const testReminder = await query<{ id: number }>(
      `INSERT INTO reminder_logs (reminder_id, job_id, channel, status, sent_at)
       VALUES (0, 0, 'email', 'sent', NOW())
       RETURNING id`,
    );
    log.debug({}, 'Test notification sent');
    return NextResponse.json({ success: true, log_id: testReminder[0]?.id });
  } catch (err) {
    log.error({ err }, 'Failed to send test notification');
    return NextResponse.json({ error: '发送测试通知失败' }, { status: 500 });
  }
}
