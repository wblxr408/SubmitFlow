/**
 * Debug script - tests the niuke and neituiya adapters directly
 * to find out why normalize() fails.
 */
import { query } from '@lib/db';

async function main() {
  console.log('=== Testing Neituiya adapter with DB records ===\n');
  
  interface RawRecord {
    id: number;
    source_job_id: string;
    raw_payload: Record<string, unknown>;
    normalized_payload: Record<string, unknown> | null;
    parse_status: string;
  }

  const rawRecords = (await query(
    `SELECT id, source_job_id, raw_payload, normalized_payload, parse_status
     FROM raw_job_records
     WHERE source_name = '内推鸭'
     ORDER BY id DESC
     LIMIT 5`
  )) as RawRecord[];

  for (const rec of rawRecords) {
    console.log(`\n--- Record ${rec.id} (${rec.source_job_id}) ---`);
    console.log(`parse_status: ${rec.parse_status}`);
    console.log(`raw_payload keys: ${Object.keys(rec.raw_payload).join(', ')}`);
    
    const payload = rec.raw_payload;
    const detail = payload.detail as Record<string, unknown> | undefined;
    const listing = payload.listing as Record<string, unknown> | undefined;
    const paper = (detail && (detail.paperModelView as Record<string, unknown>)) || listing;
    
    console.log(`has paper: ${!!paper}`);
    console.log(`paperName: ${(paper && paper.paperName) || (listing && listing.paperName) || 'N/A'}`);
    console.log(`paperType: ${(paper && paper.paperType) || 'N/A'}`);
    const desc = paper && paper.desc ? String(paper.desc).substring(0, 100) : 'N/A';
    console.log(`desc: ${desc}`);
    
    if (rec.parse_status === 'processed') {
      const norm = rec.normalized_payload as Record<string, unknown> | null;
      console.log(`normalized: title="${norm && norm.title}", company="${norm && norm.company_name}"`);
    } else {
      console.log(`normalize FAILED - last normalized_payload: ${rec.normalized_payload ? JSON.stringify(rec.normalized_payload).substring(0, 200) : 'null'}`);
    }
  }

  console.log('\n\n=== Testing Niuke adapter with DB records ===\n');
  
  const niukeRecords = (await query(
    `SELECT id, source_job_id, raw_payload, normalized_payload, parse_status
     FROM raw_job_records
     WHERE source_name = '牛客网'
     ORDER BY id DESC
     LIMIT 5`
  )) as RawRecord[];
  
  for (const rec of niukeRecords) {
    console.log(`\n--- Record ${rec.id} (${rec.source_job_id}) ---`);
    console.log(`parse_status: ${rec.parse_status}`);
    
    const payload = rec.raw_payload;
    console.log(`jobName: ${payload.jobName || 'N/A'}`);
    console.log(`companyNameText: ${payload.companyNameText || 'N/A'}`);
    const recCompany = payload.recommendInternCompany as Record<string, unknown> | undefined;
    console.log(`recommendInternCompany: ${recCompany ? JSON.stringify(recCompany).substring(0, 100) : 'N/A'}`);
    console.log(`recruitType: ${payload.recruitType || 'N/A'}`);
    
    if (rec.parse_status === 'processed') {
      const norm = rec.normalized_payload as Record<string, unknown> | null;
      console.log(`normalized: title="${norm && norm.title}", company="${norm && norm.company_name}"`);
    } else {
      console.log(`normalize FAILED`);
    }
  }

  console.log('\n\n=== Record counts by status ===\n');
  const counts = await query(
    `SELECT source_name, parse_status, COUNT(*) as cnt
     FROM raw_job_records
     GROUP BY source_name, parse_status
     ORDER BY source_name, parse_status`
  );
  for (const c of counts as Array<{source_name: string; parse_status: string; cnt: string}>) {
    console.log(`${c.source_name} / ${c.parse_status}: ${c.cnt}`);
  }

  console.log('\n=== Jobs table count ===\n');
  const jobsCount = await query(`SELECT COUNT(*) as cnt FROM jobs`);
  console.log(`Total jobs: ${(jobsCount[0] as {cnt: string}).cnt}`);
  const validCount = await query(`SELECT COUNT(*) as cnt FROM jobs WHERE status = 'valid'`);
  console.log(`Valid jobs: ${(validCount[0] as {cnt: string}).cnt}`);
  
  const companyCount = await query(`SELECT COUNT(*) as cnt FROM companies`);
  console.log(`Total companies: ${(companyCount[0] as {cnt: string}).cnt}`);

  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
