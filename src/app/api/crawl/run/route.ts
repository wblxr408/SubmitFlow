import { NextRequest, NextResponse } from 'next/server';
import { triggerCrawlRuns } from '@/server/crawl';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/crawl/run');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { run_type = 'incremental' } = body;
    const runType = run_type === 'full' ? 'full' : 'incremental';

    const { runs, results } = await triggerCrawlRuns({ runType });

    log.info({ queued: runs.length, completed: results.length, runType }, 'Crawl run triggered');

    return NextResponse.json({
      success: true,
      queued: runs.length,
      completed: results.length,
      results,
      runs: runs.map((r) => ({ id: r.id, source: r.source_name, status: r.status })),
    });
  } catch (err) {
    log.error({ err }, 'Failed to trigger crawl run');
    return NextResponse.json({ error: '触发抓取失败' }, { status: 500 });
  }
}
