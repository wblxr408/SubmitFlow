/**
 * Debug script - tests the niuke and neituiya adapters directly
 * to find out why normalize() fails.
 */
import { query } from './src/lib/db';

async function main() {
  // Test Neituiya adapter with some existing DB records
  console.log('=== Testing Neituiya adapter with DB records ===\n');
  
  const rawRecords = await query<{
    id: number;
    source_job_id: string;
    raw_payload: Record<string, unknown>;
    normalized_payload: Record<string, unknown> | null;
    parse_status: string;
  }>(
    `SELECT id, source_job_id, raw_payload, normalized_payload, parse_status
     FROM raw_job_records
     WHERE source_name = '内推鸭'
     ORDER BY id DESC
     LIMIT 5`
  );
  
  for (const rec of rawRecords) {
    console.log(`\n--- Record ${rec.id} (${rec.source_job_id}) ---`);
    console.log(`parse_status: ${rec.parse_status}`);
    console.log(`raw_payload keys: ${Object.keys(rec.raw_payload).join(', ')}`);
    
    const payload = rec.raw_payload;
    const detail = payload.detail as Record<string, unknown> | undefined;
    const listing = payload.listing as Record<string, unknown> | undefined;
    const paper = detail?.paperModelView ?? listing;
    
    console.log(`has paper: ${!!paper}`);
    console.log(`paperName: ${(paper as Record<string, unknown>)?.paperName ?? (listing as Record<string, unknown>)?.paperName ?? 'N/A'}`);
    console.log(`paperType: ${(paper as Record<string, unknown>)?.paperType ?? 'N/A'}`);
    console.log(`desc: ${String((paper as Record<string, unknown>)?.desc ?? '').substring(0, 100)}`);
    
    if (rec.parse_status === 'processed') {
      const norm = rec.normalized_payload;
      console.log(`normalized: title="${norm?.title}", company="${norm?.company_name}"`);
    } else {
      console.log(`normalize FAILED - last normalized_payload: ${rec.normalized_payload ? JSON.stringify(rec.normalized_payload).substring(0, 200) : 'null'}`);
    }
  }

  // Test Niuke adapter
  console.log('\n\n=== Testing Niuke adapter with DB records ===\n');
  
  const niukeRecords = await query<{
    id: number;
    source_job_id: string;
    raw_payload: Record<string, unknown>;
    normalized_payload: Record<string, unknown> | null;
    parse_status: string;
  }>(
    `SELECT id, source_job_id, raw_payload, normalized_payload, parse_status
     FROM raw_job_records
     WHERE source_name = '牛客网'
     ORDER BY id DESC
     LIMIT 5`
  );
  
  for (const rec of niukeRecords) {
    console.log(`\n--- Record ${rec.id} (${rec.source_job_id}) ---`);
    console.log(`parse_status: ${rec.parse_status}`);
    
    const payload = rec.raw_payload;
    console.log(`jobName: ${payload.jobName ?? 'N/A'}`);
    console.log(`companyNameText: ${payload.companyNameText ?? 'N/A'}`);
    console.log(`recommendInternCompany: ${payload.recommendInternCompany ? JSON.stringify(payload.recommendInternCompany).substring(0, 100) : 'N/A'}`);
    console.log(`recruitType: ${payload.recruitType ?? 'N/A'}`);
    
    if (rec.parse_status === 'processed') {
      const norm = rec.normalized_payload;
      console.log(`normalized: title="${norm?.title}", company="${norm?.company_name}"`);
    } else {
      console.log(`normalize FAILED`);
    }
  }

  // Count records by status
  console.log('\n\n=== Record counts by status ===\n');
  const counts = await query<{ source_name: string; parse_status: string; cnt: string }>(
    `SELECT source_name, parse_status, COUNT(*) as cnt
     FROM raw_job_records
     GROUP BY source_name, parse_status
     ORDER BY source_name, parse_status`
  );
  for (const c of counts) {
    console.log(`${c.source_name} / ${c.parse_status}: ${c.cnt}`);
  }

  // Check jobs table
  console.log('\n=== Jobs table count ===\n');
  const jobsCount = await query<{ cnt: string }>(`SELECT COUNT(*) as cnt FROM jobs`);
  console.log(`Total jobs: ${jobsCount[0]?.cnt}`);
  const validCount = await query<{ cnt: string }>(`SELECT COUNT(*) as cnt FROM jobs WHERE status = 'valid'`);
  console.log(`Valid jobs: ${validCount[0]?.cnt}`);
  
  const companyCount = await query<{ cnt: string }>(`SELECT COUNT(*) as cnt FROM companies`);
  console.log(`Total companies: ${companyCount[0]?.cnt}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
