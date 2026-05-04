/**
 * Worker 入口
 * 定时调度：无 Redis，node-cron 实现
 */
import cron from 'node-cron';
import { createLogger } from '../lib/logger';
import { validateEnv } from '../lib/env';
import { healthCheck } from '../lib/db';
import { executeCrawlRuns, triggerCrawlRuns } from '../server/crawl';
import { syncGmail } from '../server/email';

const log = createLogger('worker');

validateEnv();
log.info('Worker starting...');

async function main() {
  try {
    const resumed = await executeCrawlRuns({ maxRuns: 10 });
    if (resumed.length > 0) {
      log.info({ completed: resumed.length }, 'Processed pending crawl runs on startup');
    }
  } catch (err) {
    log.error({ err }, 'Failed to process pending crawl runs on startup');
  }

  // Gmail 同步：每小时
  cron.schedule('0 * * * *', async () => {
    log.info('Gmail sync triggered');
    try {
      const result = await syncGmail();
      log.info(result, 'Gmail sync completed');
    } catch (err) {
      log.error({ err }, 'Gmail sync failed');
    }
  });

  // 抓取调度：每天早上 8 点
  cron.schedule('0 8 * * *', async () => {
    log.info('Crawl triggered');
    try {
      const { runs, results } = await triggerCrawlRuns({ runType: 'incremental' });
      log.info({ queued: runs.length, completed: results.length }, 'Crawl completed');
    } catch (err) {
      log.error({ err }, 'Crawl failed');
    }
  });

  // 健康检查：每 5 分钟
  cron.schedule('*/5 * * * *', async () => {
    const ok = await healthCheck();
    if (!ok) {
      log.warn('Database health check failed');
    }
  });

  log.info('All scheduled tasks registered');
}

main().catch((err) => {
  log.error({ err }, 'Worker fatal error');
  process.exit(1);
});
