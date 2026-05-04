import { NextRequest, NextResponse } from 'next/server';
import { listPendingEmailParses, confirmEmailParse } from '@/server/email';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/email/confirm');

export async function GET() {
  try {
    const items = await listPendingEmailParses();
    return NextResponse.json({ items });
  } catch (err) {
    log.error({ err }, 'Failed to list pending emails');
    return NextResponse.json({ error: '获取待确认邮件失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { log_id, action, application_id } = body;

    if (!log_id || !action) {
      return NextResponse.json({ error: 'log_id and action are required' }, { status: 400 });
    }

    if (action !== 'confirm' && action !== 'ignore') {
      return NextResponse.json({ error: 'action must be confirm or ignore' }, { status: 400 });
    }

    const result = await confirmEmailParse({ logId: log_id, action, applicationId: application_id });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '处理失败';
    log.error({ err }, 'Failed to process email confirm');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
