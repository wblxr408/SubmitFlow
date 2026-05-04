/**
 * 公司详情 API
 * GET /api/companies/[id]
 */
import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { withCache, CacheKeys } from '@/lib/cache';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const companyId = parseInt(id, 10);

  if (isNaN(companyId)) {
    return NextResponse.json({ error: '无效的公司ID' }, { status: 400 });
  }

  const cacheKey = CacheKeys.companies(`detail:${companyId}`);

  const result = withCache(
    cacheKey,
    async () => {
      const company = await queryOne(`
        SELECT
          id, name, alias_names, brand_names, fame_score, size, industry,
          sub_industry, is_hot, conversion_level, headcount_range,
          headquarters, established_year, description, website, logo_url
        FROM companies
        WHERE id = $1
      `, [companyId]);

      if (!company) {
        return null;
      }

      // 获取该公司下的岗位统计
      const stats = await queryOne(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'valid') AS active_jobs,
          COUNT(*) FILTER (WHERE status = 'closed') AS closed_jobs,
          COUNT(*) FILTER (WHERE internship_type = 'summer') AS summer_jobs,
          COUNT(*) FILTER (WHERE internship_type = 'daily') AS daily_jobs,
          COUNT(*) FILTER (WHERE internship_type = 'offline') AS offline_jobs
        FROM jobs
        WHERE company_id = $1
      `, [companyId]);

      // 获取最新岗位
      const recentJobs = await query(`
        SELECT
          id, title, city, is_remote, internship_type, deadline,
          conversion_rate, last_seen_at
        FROM jobs
        WHERE company_id = $1 AND status = 'valid'
        ORDER BY last_seen_at DESC
        LIMIT 5
      `, [companyId]);

      return { company, stats, recentJobs };
    },
    120, // 2 分钟缓存
  );

  if (!result) {
    return NextResponse.json({ error: '公司不存在' }, { status: 404 });
  }

  return NextResponse.json(result);
}
