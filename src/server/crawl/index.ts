import type { PoolClient } from 'pg';
import { query, transaction } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { getSourceAdapter, getSupportedSourceNames } from './adapters';
import type { CrawlContext, JobEntrypointInput, NormalizedJob, RawJobRecord } from './types';

const log = createLogger('crawl');
const DEFAULT_PROFILE_ID = 1;
const DEFAULT_MAX_RUNS = 10;

export interface CrawlRunRecord {
  id: number;
  source_id: number;
  source_name: string;
  run_type: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

interface PendingCrawlRun extends CrawlRunRecord {
  source_type: string;
  auth_payload_encrypted: string | null;
  session_status: string | null;
}

interface PersistedJobResult {
  action: 'inserted' | 'updated';
  entrypoints: number;
}

export interface CrawlExecutionResult {
  runId: number;
  sourceId: number;
  sourceName: string;
  status: 'completed' | 'failed';
  discovered: number;
  inserted: number;
  updated: number;
  rawRecords: number;
  entrypoints: number;
  failedItems: number;
  error?: string;
}

export async function listCrawlRuns(limit = 20): Promise<CrawlRunRecord[]> {
  const safeLimit = Math.min(50, Math.max(1, limit));

  return query<CrawlRunRecord>(
    `SELECT
       cr.id,
       cr.source_id,
       js.source_name,
       cr.run_type,
       cr.status,
       cr.started_at,
       cr.finished_at,
       cr.created_at
     FROM crawl_runs cr
     JOIN job_sources js ON js.id = cr.source_id
     ORDER BY cr.created_at DESC
     LIMIT $1`,
    [safeLimit],
  );
}

export async function queueCrawlRuns(input?: {
  sourceIds?: number[];
  runType?: 'full' | 'incremental';
}): Promise<CrawlRunRecord[]> {
  const supportedSourceNames = getSupportedSourceNames();
  if (supportedSourceNames.length === 0) {
    return [];
  }

  const sourceIds = input?.sourceIds?.filter(Number.isInteger) ?? [];
  const runType = input?.runType === 'incremental' ? 'incremental' : 'full';
  const params: unknown[] = [];
  const conditions = ['is_enabled = TRUE'];

  if (sourceIds.length > 0) {
    params.push(sourceIds);
    conditions.push(`id = ANY($${params.length}::int[])`);
  }

  params.push(supportedSourceNames);
  conditions.push(`source_name = ANY($${params.length}::text[])`);

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const sources = await query<{ id: number; source_name: string }>(
    `SELECT id, source_name
     FROM job_sources
     ${whereClause}
     ORDER BY priority DESC, source_name`,
    params,
  );

  if (sources.length === 0) {
    return [];
  }

  const runs = await Promise.all(
    sources.map(async (source) => {
      const created = await query<CrawlRunRecord>(
        `INSERT INTO crawl_runs (source_id, run_type, status, started_at, stats_json)
         VALUES ($1, $2, 'pending', NULL, '{}'::jsonb)
         RETURNING
           id,
           source_id,
           $3::text AS source_name,
           run_type,
           status,
           started_at,
           finished_at,
           created_at`,
        [source.id, runType, source.source_name],
      );

      return created[0];
    }),
  );

  log.info({ runType, sourceIds, queued: runs.length }, 'Queued crawl runs');
  return runs;
}

export async function triggerCrawlRuns(input?: {
  sourceIds?: number[];
  runType?: 'full' | 'incremental';
}): Promise<{ runs: CrawlRunRecord[]; results: CrawlExecutionResult[] }> {
  const runs = await queueCrawlRuns(input);
  if (runs.length === 0) {
    return { runs, results: [] };
  }

  const results = await executeCrawlRuns({
    runIds: runs.map((run) => run.id),
    maxRuns: runs.length,
  });

  return { runs, results };
}

export async function executeCrawlRuns(input?: {
  runIds?: number[];
  maxRuns?: number;
}): Promise<CrawlExecutionResult[]> {
  const supportedSourceNames = getSupportedSourceNames();
  if (supportedSourceNames.length === 0) {
    return [];
  }

  const runIds = input?.runIds?.filter(Number.isInteger) ?? [];
  const safeMaxRuns = Math.min(50, Math.max(1, input?.maxRuns ?? DEFAULT_MAX_RUNS));

  await markUnsupportedRunsFailed(supportedSourceNames, runIds);
  const pendingRuns = await selectPendingRuns(supportedSourceNames, runIds, safeMaxRuns);
  const results: CrawlExecutionResult[] = [];

  for (const run of pendingRuns) {
    results.push(await executeSingleRun(run));
  }

  return results;
}

async function markUnsupportedRunsFailed(
  supportedSourceNames: string[],
  runIds: number[],
): Promise<void> {
  const params: unknown[] = [supportedSourceNames, 'Source adapter not implemented'];
  const conditions = [
    `cr.source_id = js.id`,
    `cr.status = 'pending'`,
    `NOT (js.source_name = ANY($1::text[]))`,
  ];

  if (runIds.length > 0) {
    params.push(runIds);
    conditions.push(`cr.id = ANY($${params.length}::int[])`);
  }

  await query(
    `UPDATE crawl_runs cr
     SET status = 'failed',
         finished_at = NOW(),
         stats_json = COALESCE(cr.stats_json, '{}'::jsonb) || jsonb_build_object('error', $2::text)
     FROM job_sources js
     WHERE ${conditions.join(' AND ')}`,
    params,
  );
}

async function selectPendingRuns(
  supportedSourceNames: string[],
  runIds: number[],
  maxRuns: number,
): Promise<PendingCrawlRun[]> {
  const params: unknown[] = [DEFAULT_PROFILE_ID, supportedSourceNames];
  const conditions = [
    `cr.status = 'pending'`,
    `js.source_name = ANY($2::text[])`,
  ];

  if (runIds.length > 0) {
    params.push(runIds);
    conditions.push(`cr.id = ANY($${params.length}::int[])`);
  }

  params.push(maxRuns);

  return query<PendingCrawlRun>(
    `SELECT
       cr.id,
       cr.source_id,
       js.source_name,
       cr.run_type,
       cr.status,
       cr.started_at,
       cr.finished_at,
       cr.created_at,
       js.source_type,
       sa.auth_payload_encrypted,
       sa.session_status
     FROM crawl_runs cr
     JOIN job_sources js ON js.id = cr.source_id
     LEFT JOIN source_accounts sa
       ON sa.source_id = js.id
      AND sa.profile_id = $1
     WHERE ${conditions.join(' AND ')}
     ORDER BY cr.created_at ASC
     LIMIT $${params.length}`,
    params,
  );
}

async function executeSingleRun(run: PendingCrawlRun): Promise<CrawlExecutionResult> {
  const adapter = getSourceAdapter(run.source_name);
  const result: CrawlExecutionResult = {
    runId: run.id,
    sourceId: run.source_id,
    sourceName: run.source_name,
    status: 'completed',
    discovered: 0,
    inserted: 0,
    updated: 0,
    rawRecords: 0,
    entrypoints: 0,
    failedItems: 0,
  };

  await query(
    `UPDATE crawl_runs
     SET status = 'running',
         started_at = COALESCE(started_at, NOW()),
         finished_at = NULL
     WHERE id = $1`,
    [run.id],
  );

  if (!adapter) {
    result.status = 'failed';
    result.error = 'Source adapter not implemented';
    await finalizeRun(run, result);
    return result;
  }

  const context: CrawlContext = {
    profile_id: DEFAULT_PROFILE_ID,
    source_id: run.source_id,
    auth_payload_encrypted: run.auth_payload_encrypted ?? undefined,
    session_status: (run.session_status ?? 'active') as CrawlContext['session_status'],
  };

  try {
    const discoveredItems = await adapter.discover(context);
    result.discovered = discoveredItems.length;

    for (const item of discoveredItems) {
      try {
        const raw = await adapter.fetchDetail(item, context);
        const normalized = await adapter.normalize(raw);
        const entrypoints = await adapter.extractEntrypoints(normalized);
        const persisted = await persistCrawlItem(run, raw, normalized, entrypoints);

        result.rawRecords += 1;
        result.entrypoints += persisted.entrypoints;
        if (persisted.action === 'inserted') {
          result.inserted += 1;
        } else {
          result.updated += 1;
        }
      } catch (err) {
        result.failedItems += 1;
        log.warn({ err, runId: run.id, source: run.source_name, item }, 'Failed to persist crawl item');
      }
    }
  } catch (err) {
    result.status = 'failed';
    result.error = stringifyError(err);
    log.error({ err, runId: run.id, source: run.source_name }, 'Crawl run failed');
  }

  await finalizeRun(run, result);
  return result;
}

async function finalizeRun(run: PendingCrawlRun, result: CrawlExecutionResult): Promise<void> {
  const statsJson = {
    discovered: result.discovered,
    inserted: result.inserted,
    updated: result.updated,
    rawRecords: result.rawRecords,
    entrypoints: result.entrypoints,
    failedItems: result.failedItems,
    error: result.error ?? null,
  };

  await query(
    `UPDATE crawl_runs
     SET status = $2,
         finished_at = NOW(),
         stats_json = $3::jsonb
     WHERE id = $1`,
    [run.id, result.status, JSON.stringify(statsJson)],
  );

  if (result.status === 'completed') {
    await query(
      `UPDATE job_sources
       SET last_crawled_at = NOW()
       WHERE id = $1`,
      [run.source_id],
    );
  }
}

async function persistCrawlItem(
  run: PendingCrawlRun,
  raw: RawJobRecord,
  normalized: NormalizedJob,
  entrypoints: JobEntrypointInput[],
): Promise<PersistedJobResult> {
  return transaction(async (client) => {
    const companyId = await findOrCreateCompany(client, normalized.company_name);
    const rawRecord = await client.query<{ id: number }>(
      `INSERT INTO raw_job_records
         (crawl_run_id, source_name, source_job_id, raw_payload, normalized_payload, parse_status)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, 'processed')
       RETURNING id`,
      [
        run.id,
        raw.source_name,
        raw.source_job_id,
        JSON.stringify(raw.raw_payload),
        JSON.stringify(normalized),
      ],
    );

    const existingEntrypoint = await client.query<{ job_id: number }>(
      `SELECT job_id
       FROM job_entrypoints
       WHERE source_name = $1
         AND source_job_id = $2
       ORDER BY id ASC
       LIMIT 1`,
      [raw.source_name, raw.source_job_id],
    );

    const direction = inferDirection(raw);
    let jobId: number;
    let action: PersistedJobResult['action'];

    if (existingEntrypoint.rows[0]?.job_id) {
      jobId = existingEntrypoint.rows[0].job_id;
      action = 'updated';
      await updateJob(client, jobId, companyId, normalized, direction, raw.source_name);
    } else {
      const matchedJobId = await findMatchingJob(client, companyId, normalized.title, normalized.city, normalized.internship_type);
      if (matchedJobId) {
        jobId = matchedJobId;
        action = 'updated';
        await updateJob(client, jobId, companyId, normalized, direction, raw.source_name);
      } else {
        jobId = await insertJob(client, companyId, normalized, direction, raw.source_name);
        action = 'inserted';
      }
    }

    await client.query(
      `INSERT INTO job_canonical_mappings (raw_job_record_id, job_id, match_score)
       VALUES ($1, $2, $3)`,
      [rawRecord.rows[0].id, jobId, action === 'inserted' ? 100 : 95],
    );

    const syncedEntrypoints = await syncJobEntrypoints(
      client,
      jobId,
      raw.source_name,
      raw.source_job_id,
      entrypoints,
    );

    return {
      action,
      entrypoints: syncedEntrypoints,
    };
  });
}

async function findOrCreateCompany(client: PoolClient, companyName: string): Promise<number> {
  const variants = buildCompanySearchVariants(companyName);

  for (const variant of variants) {
    const existing = await client.query<{ id: number }>(
      `SELECT id
       FROM companies
       WHERE name = $1
          OR $1 = ANY(alias_names)
          OR $1 = ANY(brand_names)
       ORDER BY CASE
         WHEN name = $1 THEN 0
         WHEN $1 = ANY(alias_names) THEN 1
         ELSE 2
       END
       LIMIT 1`,
      [variant],
    );

    if (existing.rows[0]?.id) {
      return existing.rows[0].id;
    }
  }

  const inserted = await client.query<{ id: number }>(
    `INSERT INTO companies (name, alias_names, created_at, updated_at)
     VALUES ($1, $2, NOW(), NOW())
     RETURNING id`,
    [variants[0], variants.slice(1)],
  );

  return inserted.rows[0].id;
}

async function findMatchingJob(
  client: PoolClient,
  companyId: number,
  title: string,
  city: string,
  internshipType: string,
): Promise<number | null> {
  const matched = await client.query<{ id: number }>(
    `SELECT id
     FROM jobs
     WHERE company_id = $1
       AND title = $2
       AND COALESCE(city, '') = COALESCE($3, '')
       AND COALESCE(internship_type, '') = COALESCE($4, '')
     ORDER BY id ASC
     LIMIT 1`,
    [companyId, title, nullIfBlank(city), nullIfBlank(internshipType)],
  );

  return matched.rows[0]?.id ?? null;
}

async function insertJob(
  client: PoolClient,
  companyId: number,
  normalized: NormalizedJob,
  direction: string | null,
  sourceName: string,
): Promise<number> {
  const inserted = await client.query<{ id: number }>(
    `INSERT INTO jobs
       (company_id, title, direction, jd_text, city, is_remote, internship_type, deadline, status, canonical_source)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, 'valid', $9)
     RETURNING id`,
    [
      companyId,
      normalized.title,
      direction,
      nullIfBlank(normalized.jd_text),
      nullIfBlank(normalized.city),
      normalized.is_remote,
      nullIfBlank(normalized.internship_type),
      normalized.deadline,
      sourceName,
    ],
  );

  return inserted.rows[0].id;
}

async function updateJob(
  client: PoolClient,
  jobId: number,
  companyId: number,
  normalized: NormalizedJob,
  direction: string | null,
  sourceName: string,
): Promise<void> {
  await client.query(
    `UPDATE jobs
     SET company_id = $2,
         title = $3,
         direction = $4,
         jd_text = $5,
         city = $6,
         is_remote = $7,
         internship_type = $8,
         deadline = $9,
         status = 'valid',
         canonical_source = $10,
         updated_at = NOW(),
         last_seen_at = NOW()
     WHERE id = $1`,
    [
      jobId,
      companyId,
      normalized.title,
      direction,
      nullIfBlank(normalized.jd_text),
      nullIfBlank(normalized.city),
      normalized.is_remote,
      nullIfBlank(normalized.internship_type),
      normalized.deadline,
      sourceName,
    ],
  );
}

async function syncJobEntrypoints(
  client: PoolClient,
  jobId: number,
  sourceName: string,
  sourceJobId: string,
  entrypoints: JobEntrypointInput[],
): Promise<number> {
  const uniqueEntrypoints = dedupeEntrypoints(entrypoints);

  for (const entrypoint of uniqueEntrypoints) {
    const existing = await client.query<{ id: number }>(
      `SELECT id
       FROM job_entrypoints
       WHERE job_id = $1
         AND source_name = $2
         AND source_job_id = $3
         AND entry_url = $4
       ORDER BY id ASC
       LIMIT 1`,
      [jobId, sourceName, sourceJobId, entrypoint.entry_url],
    );

    if (existing.rows[0]?.id) {
      await client.query(
        `UPDATE job_entrypoints
         SET entry_type = $2,
             visibility = $3,
             requires_auth = $4,
             referrer_name = $5,
             status = 'active',
             valid_until = NULL
         WHERE id = $1`,
        [
          existing.rows[0].id,
          entrypoint.entry_type,
          entrypoint.visibility,
          entrypoint.requires_auth,
          entrypoint.referrer_name ?? null,
        ],
      );
      continue;
    }

    await client.query(
      `INSERT INTO job_entrypoints
         (job_id, entry_type, entry_url, visibility, requires_auth, referrer_name, source_name, source_job_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')`,
      [
        jobId,
        entrypoint.entry_type,
        entrypoint.entry_url,
        entrypoint.visibility,
        entrypoint.requires_auth,
        entrypoint.referrer_name ?? null,
        sourceName,
        sourceJobId,
      ],
    );
  }

  return uniqueEntrypoints.length;
}

function dedupeEntrypoints(entrypoints: JobEntrypointInput[]): JobEntrypointInput[] {
  const seen = new Set<string>();
  const unique: JobEntrypointInput[] = [];

  for (const entrypoint of entrypoints) {
    const key = [
      entrypoint.entry_type,
      entrypoint.entry_url,
      entrypoint.visibility,
      entrypoint.requires_auth,
      entrypoint.referrer_name ?? '',
    ].join('|');

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(entrypoint);
  }

  return unique;
}

function inferDirection(raw: RawJobRecord): string | null {
  const payload = raw.raw_payload as Record<string, unknown>;
  const value = firstNonEmpty(
    stringValue(payload.careerJobName),
    stringValue(payload.secondJobType),
    stringValue(payload.jobKeys)?.split(',')[0],
  );

  return nullIfBlank(value);
}

function buildCompanySearchVariants(companyName: string): string[] {
  const normalized = companyName.trim();
  if (!normalized) return [];

  const variants = new Set<string>();
  variants.add(normalized);

  const compact = normalized.replace(/\s+/g, '');
  if (compact !== normalized) variants.add(compact);

  const withoutBracket = compact.replace(/[（(].*?[）)]/g, '');
  if (withoutBracket !== compact && withoutBracket) variants.add(withoutBracket);

  const suffixPatterns = [
    /股份有限公司$/u,
    /有限责任公司$/u,
    /集团有限公司$/u,
    /有限公司$/u,
    /集团$/u,
  ];

  for (const base of [compact, withoutBracket]) {
    if (!base) continue;
    for (const pattern of suffixPatterns) {
      const stripped = base.replace(pattern, '').trim();
      if (stripped && stripped !== base && stripped.length >= 2) {
        variants.add(stripped);
        let current = stripped;
        for (const p2 of suffixPatterns) {
          const stripped2 = current.replace(p2, '').trim();
          if (stripped2 && stripped2 !== current && stripped2.length >= 2) {
            variants.add(stripped2);
            current = stripped2;
          }
        }
      }
    }
  }

  return [...variants].slice(0, 10);
}

function nullIfBlank(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  return String(err);
}
