import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/ai/routes');

export async function GET(
  request: NextRequest,
  { params }: { params: { taskType: string } },
) {
  log.debug({ taskType: params.taskType }, 'AI route lookup');
  return NextResponse.json({ taskType: params.taskType, routes: [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { taskType: string } },
) {
  try {
    const body = await request.json();
    log.info({ taskType: params.taskType, body }, 'AI route task dispatched');
    return NextResponse.json({ success: true, taskType: params.taskType });
  } catch (err) {
    log.error({ err, taskType: params.taskType }, 'AI route task failed');
    return NextResponse.json({ error: 'AI 任务失败' }, { status: 500 });
  }
}
