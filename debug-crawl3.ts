/**
 * Check the 14 failed niuke items - are they already in DB as raw records?
 */
import { query } from '@lib/db';

async function main() {
  // Check the most recent niuke records to understand why they might have failed
  const recentNiuke = await query(
    `SELECT id, source_job_id, parse_status, normalized_payload
     FROM raw_job_records
     WHERE source_name = '牛客网'
     ORDER BY id DESC
     LIMIT 20`
  );
  
  console.log('=== All Niuke raw records (most recent first) ===\n');
  for (const r of recentNiuke as Array<{id: number; source_job_id: string; parse_status: string; normalized_payload: Record<string, unknown> | null}>) {
    const np = r.normalized_payload;
    console.log(`ID=${r.id} job_id=${r.source_job_id} status=${r.parse_status}`);
    if (np) {
      console.log(`  title="${np.title}" company="${np.company_name}" city="${np.city || '(none)'}"`);
    } else {
      console.log(`  [no normalized data]`);
    }
  }
  
  // How many unique jobs in DB from niuke?
  const niukeJobs = await query(
    `SELECT COUNT(DISTINCT j.id) as cnt
     FROM jobs j
     JOIN companies c ON c.id = j.company_id
     WHERE j.canonical_source = '牛客网'`
  );
  console.log(`\nUnique jobs from 牛客网: ${(niukeJobs[0] as {cnt: string}).cnt}`);
  
  // What's the distribution of parse_status?
  const statusDist = await query(
    `SELECT parse_status, COUNT(*) as cnt FROM raw_job_records GROUP BY parse_status ORDER BY cnt DESC`
  );
  console.log('\nParse status distribution:');
  for (const s of statusDist as Array<{parse_status: string; cnt: string}>) {
    console.log(`  ${s.parse_status}: ${s.cnt}`);
  }

  // Check crawl run history
  const crawlHistory = await query(
    `SELECT cr.id, cr.source_id, js.source_name, cr.status, cr.stats_json, cr.created_at
     FROM crawl_runs cr
     JOIN job_sources js ON js.id = cr.source_id
     WHERE js.source_name IN ('牛客网', '内推鸭')
     ORDER BY cr.id DESC
     LIMIT 10`
  );
  
  console.log('\n=== Recent crawl run history ===');
  for (const r of crawlHistory as Array<{id: number; source_id: number; source_name: string; status: string; stats_json: Record<string, unknown>; created_at: string}>) {
    const s = r.stats_json;
    console.log(`\nRun ${r.id} (${r.source_name}) @ ${r.created_at} - ${r.status}`);
    console.log(`  discovered=${s.discovered} rawRecords=${s.rawRecords} inserted=${s.inserted} updated=${s.updated} failed=${s.failedItems}`);
    if (s.failedItemDetails && (s.failedItemDetails as Array<{sourceJobId: string; error: string}>).length > 0) {
      console.log(`  FAILED ITEMS:`);
      for (const f of s.failedItemDetails as Array<{sourceJobId: string; error: string}>) {
        console.log(`    job=${f.sourceJobId}: ${f.error}`);
      }
    }
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
