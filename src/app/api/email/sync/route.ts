import { NextRequest, NextResponse } from 'next/server';
import { syncGmail, disconnectEmailConnection } from '@/server/email';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/email/sync');

export async function POST() {
  try {
    const result = await syncGmail();
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '同步失败';
    log.error({ err }, 'Email sync failed');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await disconnectEmailConnection();
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error({ err }, 'Failed to disconnect email');
    return NextResponse.json({ error: '断开连接失败' }, { status: 500 });
  }
}
