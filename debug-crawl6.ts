// This file is meant to be run inside the app container
// to replicate the exact environment of the crawl worker
import { createLogger } from '@/lib/logger';
import { NiukeAdapter, NeituiyaAdapter } from '@/server/crawl/adapters';

const log = createLogger('debug-crawl6');

async function testNiuke() {
  console.log('=== Testing Niuke Adapter ===\n');
  const adapter = new NiukeAdapter();
  const ctx = { profile_id: 1, source_id: 2, session_status: 'active' as const };

  try {
    const items = await adapter.discover(ctx);
    console.log(`Discovered: ${items.length} items`);

    if (items.length > 0) {
      console.log('First item metadata keys:', Object.keys(items[0].metadata));
      console.log('First item:', JSON.stringify(items[0], null, 2));

      // Test fetchDetail
      const raw = await adapter.fetchDetail(items[0], ctx);
      console.log('\nFetchDetail raw_payload keys:', Object.keys(raw.raw_payload as Record<string, unknown>));

      // Test normalize
      try {
        const normalized = await adapter.normalize(raw);
        console.log('\nNormalize SUCCESS:', JSON.stringify(normalized, null, 2));
      } catch (err: unknown) {
        console.error('\nNormalize FAILED:', err instanceof Error ? err.message : err);
      }
    }
  } catch (err: unknown) {
    console.error('Discover FAILED:', err instanceof Error ? err.message : err);
  }
}

async function testNeituiya() {
  console.log('\n=== Testing Neituiya Adapter ===\n');
  const adapter = new NeituiyaAdapter();
  const ctx = { profile_id: 1, source_id: 5, session_status: 'active' as const };

  try {
    const items = await adapter.discover(ctx);
    console.log(`Discovered: ${items.length} items`);

    if (items.length > 0) {
      console.log('First item:', JSON.stringify(items[0], null, 2));

      // Test fetchDetail
      try {
        const raw = await adapter.fetchDetail(items[0], ctx);
        console.log('\nFetchDetail SUCCESS, raw_payload keys:', Object.keys(raw.raw_payload as Record<string, unknown>));

        // Test normalize
        try {
          const normalized = await adapter.normalize(raw);
          console.log('\nNormalize SUCCESS:', JSON.stringify(normalized, null, 2));
        } catch (err: unknown) {
          console.error('\nNormalize FAILED:', err instanceof Error ? err.message : err);
        }
      } catch (err: unknown) {
        console.error('\nFetchDetail FAILED:', err instanceof Error ? err.message : err);
      }
    }
  } catch (err: unknown) {
    console.error('Discover FAILED:', err instanceof Error ? err.message : err);
  }
}

async function main() {
  await testNiuke();
  await testNeituiya();
}

main().catch((err: unknown) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
