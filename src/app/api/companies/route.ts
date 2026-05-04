/**
 * 公司搜索与列表 API
 * GET /api/companies
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCache, CacheKeys } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword') ?? '';
  const industry = searchParams.get('industry') ?? '';
  const size = searchParams.get('size') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(50, parseInt(searchParams.get('page_size') ?? '20', 10));
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (keyword) {
    conditions.push(`(
      name ILIKE $${paramIdx}
      OR $${paramIdx} = ANY(alias_names)
      OR $${paramIdx} = ANY(brand_names)
    )`);
    params.push(`%${keyword}%`);
    paramIdx++;
  }

  if (industry) {
    conditions.push(`industry = $${paramIdx}`);
    params.push(industry);
    paramIdx++;
  }

  if (size) {
    conditions.push(`size = $${paramIdx}`);
    params.push(size);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const cacheKey = CacheKeys.companies(`${keyword}-${industry}-${size}-${page}-${pageSize}`);

  const cachedRows = withCache(
    cacheKey,
    async () => {
      return query(`
        SELECT
          id, name, alias_names, brand_names, fame_score, size, industry,
          sub_industry, is_hot, conversion_level, headcount_range,
          headquarters, established_year
        FROM companies
        ${whereClause}
        ORDER BY fame_score DESC
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
      `, [...params, pageSize, offset]);
    },
    300, // 5 分钟缓存
  );

  const totalResult = query(`
    SELECT COUNT(*) AS count FROM companies ${whereClause}
  `, params);

  const [rows, totalRows] = await Promise.all([cachedRows, totalResult]);
  const total = Number.parseInt((totalRows[0] as { count?: string })?.count ?? '0', 10);

  return NextResponse.json({
    companies: rows,
    page,
    pageSize,
    total,
    hasNextPage: offset + rows.length < total,
  });
}
