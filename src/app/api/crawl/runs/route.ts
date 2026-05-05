/**
 * GET /api/crawl/runs — List crawl run history
 */
import { NextRequest, NextResponse } from 'next/server';
import { listCrawlRuns } from '@/server/crawl';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/crawl/runs');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const status = searchParams.get('status');
    const sourceId = searchParams.get('source_id');

    const runs = await listCrawlRuns(limit);

    let filtered = runs;
    if (status) {
      filtered = filtered.filter((r) => r.status === status);
    }
    if (sourceId) {
      const sid = parseInt(sourceId, 10);
      if (!isNaN(sid)) {
        filtered = filtered.filter((r) => r.source_id === sid);
      }
    }

    log.info({ count: filtered.length, limit, status, sourceId }, 'Listed crawl runs');

    return NextResponse.json({
      items: filtered,
      total: filtered.length,
      limit,
    });
  } catch (err) {
    log.error({ err }, 'Failed to list crawl runs');
    return NextResponse.json({ error: '获取爬取记录失败' }, { status: 500 });
  }
}
