/**
 * Check if the failedItems from the last crawl are now in DB
 * (would be upserted with ON CONFLICT)
 */
import { query } from '@lib/db';

async function main() {
  // Check the latest crawl runs for niuke
  const runs = await query(
    `SELECT cr.id, cr.source_id, cr.status, cr.stats_json, cr.created_at
     FROM crawl_runs cr
     JOIN job_sources js ON js.id = cr.source_id
     WHERE js.source_name = '牛客网'
     ORDER BY cr.id DESC
     LIMIT 5`
  );
  
  console.log('=== Recent Niuke crawl runs ===');
  for (const r of runs as Array<{id: number; source_id: number; status: string; stats_json: Record<string, unknown>; created_at: string}>) {
    console.log(`Run ${r.id}: status=${r.status}, created=${r.created_at}`);
    console.log(`  stats: ${JSON.stringify(r.stats_json)}`);
  }

  // Count raw records for niuke
  const niukeCount = await query(
    `SELECT COUNT(*) as cnt FROM raw_job_records WHERE source_name = '牛客网'`
  );
  console.log(`\nTotal niuke raw records: ${(niukeCount[0] as {cnt: string}).cnt}`);
  
  // Count raw records for neituiya
  const neituiyaCount = await query(
    `SELECT COUNT(*) as cnt FROM raw_job_records WHERE source_name = '内推鸭'`
  );
  console.log(`Total neituiya raw records: ${(neituiyaCount[0] as {cnt: string}).cnt}`);
  
  // Sample some recent niuke raw records
  const recentNiuke = await query(
    `SELECT r.id, r.source_job_id, r.parse_status, 
            np->>'title' as title, np->>'company_name' as company
     FROM raw_job_records r
     LEFT JOIN LATERAL jsonb_extract_path(r.normalized_payload, 'title') as np_title ON true
     WHERE r.source_name = '牛客网'
     ORDER BY r.id DESC
     LIMIT 10`
  );
  
  console.log('\n=== Recent Niuke records ===');
  for (const r of recentNiuke as Array<{id: number; source_job_id: string; parse_status: string; title: string; company: string}>) {
    console.log(`ID=${r.id} job_id=${r.source_job_id} status=${r.parse_status} title="${r.title}" company="${r.company}"`);
  }
  
  // Sample recent neituiya
  const recentNeituiya = await query(
    `SELECT r.id, r.source_job_id, r.parse_status, 
            np->>'title' as title, np->>'company_name' as company
     FROM raw_job_records r
     WHERE r.source_name = '内推鸭'
     ORDER BY r.id DESC
     LIMIT 10`
  );
  
  console.log('\n=== Recent Neituiya records ===');
  for (const r of recentNeituiya as Array<{id: number; source_job_id: string; parse_status: string; title: string; company: string}>) {
    console.log(`ID=${r.id} job_id=${r.source_job_id} status=${r.parse_status} title="${r.title}" company="${r.company}"`);
  }

  // Check what jobs were actually inserted from the crawls
  const recentJobs = await query(
    `SELECT j.id, j.title, c.name as company, j.internship_type, j.status
     FROM jobs j
     JOIN companies c ON c.id = j.company_id
     ORDER BY j.id DESC
     LIMIT 20`
  );
  
  console.log('\n=== Recent Jobs ===');
  for (const j of recentJobs as Array<{id: number; title: string; company: string; internship_type: string; status: string}>) {
    console.log(`ID=${j.id} "${j.title}" @ ${j.company} (${j.internship_type}) [${j.status}]`);
  }
  
  // Check entrypoints
  const recentEntrypoints = await query(
    `SELECT je.id, je.source_name, je.source_job_id, je.entry_type, je.entry_url
     FROM job_entrypoints je
     ORDER BY je.id DESC
     LIMIT 10`
  );
  
  console.log('\n=== Recent Entrypoints ===');
  for (const e of recentEntrypoints as Array<{id: number; source_name: string; source_job_id: string; entry_type: string; entry_url: string}>) {
    console.log(`ID=${e.id} ${e.source_name} job=${e.source_job_id} type=${e.entry_type} url=${e.entry_url.substring(0, 80)}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
