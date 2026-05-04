import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';
import { withCache, CacheKeys } from '@/lib/cache';
import type { Job, Tag } from '@/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/jobs');

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword') ?? '';
  const city = searchParams.get('city') ?? '';
  const internship_type = searchParams.get('internship_type') ?? '';
  const has_referral = searchParams.get('has_referral');
  const industry = searchParams.get('industry') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(50, parseInt(searchParams.get('page_size') ?? '20', 10));
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [`j.status = 'valid'`];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (keyword) {
    conditions.push(`(
      j.title ILIKE $${paramIdx}
      OR c.name ILIKE $${paramIdx}
      OR $${paramIdx} = ANY(c.alias_names)
      OR $${paramIdx} = ANY(c.brand_names)
    )`);
    params.push(`%${keyword}%`);
    paramIdx++;
  }
  if (city) {
    conditions.push(`j.city = $${paramIdx}`);
    params.push(city);
    paramIdx++;
  }
  if (internship_type) {
    conditions.push(`j.internship_type = $${paramIdx}`);
    params.push(internship_type);
    paramIdx++;
  }
  if (industry) {
    conditions.push(`c.industry = $${paramIdx}`);
    params.push(industry);
    paramIdx++;
  }
  if (has_referral === 'true') {
    conditions.push(
      `EXISTS (
         SELECT 1
         FROM job_entrypoints je
         WHERE je.job_id = j.id
           AND je.status = 'active'
           AND je.entry_type <> 'official'
       )`,
    );
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 缓存键
  const cacheKey = CacheKeys.jobs(`${keyword}-${city}-${internship_type}-${industry}-${has_referral}-${page}-${pageSize}`);

  // 使用缓存的查询结果
  const cachedResult = withCache(
    cacheKey,
    async () => {
      const rows = await query<Job & { company_name: string; company_fame_score: number; tags: Tag[]; has_referral: boolean; company_size: string }>(
        `WITH company_fames AS (
           SELECT id, name, fame_score, size FROM companies
         ),
         job_tags_agg AS (
           SELECT job_id,
                  COALESCE(json_agg(jsonb_build_object(
                    'id', t.id,
                    'slug', t.slug,
                    'label', t.label,
                    'group_name', t.group_name,
                    'color_hex', t.color_hex,
                    'is_preset', t.is_preset,
                    'created_at', t.created_at
                  )) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
           FROM job_tags jt
           LEFT JOIN tags t ON t.id = jt.tag_id
           GROUP BY job_id
         )
         SELECT
           j.id, j.company_id, j.title, j.direction, j.jd_text, j.city, j.is_remote,
           j.internship_type, j.deadline, j.conversion_rate, j.status, j.canonical_source,
           j.created_at, j.updated_at, j.first_seen_at, j.last_seen_at,
           cf.name AS company_name,
           cf.fame_score AS company_fame_score,
           cf.size AS company_size,
           COALESCE(jta.tags, '[]'::json) AS tags,
           EXISTS (
             SELECT 1 FROM job_entrypoints je
             WHERE je.job_id = j.id AND je.status = 'active'
               AND je.entry_type <> 'official'
           ) AS has_referral
         FROM jobs j
         JOIN company_fames cf ON cf.id = j.company_id
         LEFT JOIN job_tags_agg jta ON jta.job_id = j.id
         ${whereClause}
         ORDER BY j.last_seen_at DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, pageSize, offset],
      );
      return rows;
    },
    60, // 60 秒缓存
  );

  // 单独查询总数（不缓存）
  const totalResult = query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM jobs j
     JOIN companies c ON c.id = j.company_id
     ${whereClause}`,
    params,
  );

  const [rows, totalRows] = await Promise.all([cachedResult, totalResult]);
  const total = Number.parseInt(totalRows[0]?.count ?? '0', 10);

  log.debug({ keyword, city, internship_type, has_referral, page, pageSize, total }, 'Listed jobs');

  return NextResponse.json({
    jobs: rows,
    page,
    pageSize,
    total,
    hasNextPage: offset + rows.length < total,
  });
}
