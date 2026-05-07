/**
 * Trace which crawl_run_id created each raw record
 */
import { query } from '@lib/db';

async function main() {
  // For each recent niuke job, check which crawl_run created it
  const recentNiuke = await query(
    `SELECT r.id, r.crawl_run_id, r.source_job_id, r.parse_status, 
            cr.created_at as crawl_time,
            np_title as title
     FROM raw_job_records r
     JOIN crawl_runs cr ON cr.id = r.crawl_run_id
     LEFT JOIN LATERAL jsonb_extract_path(r.normalized_payload, 'title') as np_title ON true
     WHERE r.source_name = '牛客网'
     ORDER BY r.id DESC
     LIMIT 30`
  );
  
  console.log('=== Niuke raw records with crawl_run info ===\n');
  for (const r of recentNiuke as Array<{id: number; crawl_run_id: number; source_job_id: string; parse_status: string; crawl_time: string; title: string}>) {
    console.log(`ID=${r.id} run=${r.crawl_run_id} @${r.crawl_time} job_id=${r.source_job_id} status=${r.parse_status}`);
    console.log(`  title="${r.title}"`);
  }

  // Same for neituiya
  const recentNeituiya = await query(
    `SELECT r.id, r.crawl_run_id, r.source_job_id, r.parse_status,
            cr.created_at as crawl_time
     FROM raw_job_records r
     JOIN crawl_runs cr ON cr.id = r.crawl_run_id
     WHERE r.source_name = '内推鸭'
     ORDER BY r.id DESC
     LIMIT 30`
  );
  
  console.log('\n=== Neituiya raw records with crawl_run info ===\n');
  for (const r of recentNeituiya as Array<{id: number; crawl_run_id: number; source_job_id: string; parse_status: string; crawl_time: string}>) {
    console.log(`ID=${r.id} run=${r.crawl_run_id} @${r.crawl_time} job_id=${r.source_job_id} status=${r.parse_status}`);
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
