/**
 * 增强搜索服务
 * - 全文搜索（tsvector）
 * - 模糊匹配（pg_trgm）
 * - 智能分词
 * - 搜索建议
 */
import { query } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('search');

export interface SearchOptions {
  keyword: string;
  page?: number;
  pageSize?: number;
  filters?: {
    city?: string;
    industry?: string;
    internshipType?: string;
    hasReferral?: boolean;
    tags?: number[];
  };
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  searchTime: number;
}

/**
 * 全文搜索（使用 tsvector）
 */
export async function fullTextSearch(options: SearchOptions): Promise<SearchResult<unknown>> {
  const startTime = Date.now();
  const { keyword, page = 1, pageSize = 20, filters = {} } = options;
  const offset = (page - 1) * pageSize;

  // 预处理搜索词：去除特殊字符，分词
  const processedKeyword = preprocessKeyword(keyword);

  // 构建查询条件
  const conditions: string[] = [`j.status = 'valid'`];
  const params: unknown[] = [];
  let paramIdx = 1;

  // 全文搜索
  if (processedKeyword) {
    // 使用 websearch_to_tsquery 支持多词搜索
    conditions.push(`j.search_vector @@ websearch_to_tsquery('simple', $${paramIdx})`);
    params.push(processedKeyword);
    paramIdx++;
  }

  // 过滤条件
  if (filters.city) {
    conditions.push(`j.city = $${paramIdx}`);
    params.push(filters.city);
    paramIdx++;
  }

  if (filters.industry) {
    conditions.push(`EXISTS (
      SELECT 1 FROM companies c WHERE c.id = j.company_id AND c.industry = $${paramIdx}
    )`);
    params.push(filters.industry);
    paramIdx++;
  }

  if (filters.internshipType) {
    conditions.push(`j.internship_type = $${paramIdx}`);
    params.push(filters.internshipType);
    paramIdx++;
  }

  if (filters.hasReferral) {
    conditions.push(`EXISTS (
      SELECT 1 FROM job_entrypoints je
      WHERE je.job_id = j.id AND je.status = 'active' AND je.entry_type <> 'official'
    )`);
  }

  if (filters.tags && filters.tags.length > 0) {
    conditions.push(`EXISTS (
      SELECT 1 FROM job_tags jt WHERE jt.job_id = j.id AND jt.tag_id = ANY($${paramIdx}::int[])
    )`);
    params.push(filters.tags);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 构建搜索查询
  let orderBy = 'j.last_seen_at DESC';
  let selectExtra = '';

  // 如果有搜索词，按相关度排序
  if (processedKeyword) {
    orderBy = `ts_rank(j.search_vector, websearch_to_tsquery('simple', $1)) DESC, ${orderBy}`;
    selectExtra = `, ts_rank(j.search_vector, websearch_to_tsquery('simple', $1)) AS rank`;
  }

  const sql = `
    WITH filtered_jobs AS (
      SELECT j.id, j.title, j.direction, j.city, j.company_id,
             j.internship_type, j.deadline, j.conversion_rate, j.status,
             c.name AS company_name, c.fame_score AS company_fame_score
             ${selectExtra}
      FROM jobs j
      JOIN companies c ON c.id = j.company_id
      ${whereClause}
    )
    SELECT *,
      EXISTS (
        SELECT 1 FROM job_entrypoints je
        WHERE je.job_id = filtered_jobs.id AND je.status = 'active' AND je.entry_type <> 'official'
      ) AS has_referral
    FROM filtered_jobs
    ORDER BY ${orderBy}
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  const countSql = `
    SELECT COUNT(*) AS count
    FROM jobs j
    JOIN companies c ON c.id = j.company_id
    ${whereClause}
  `;

  try {
    const [rows, countResult] = await Promise.all([
      query(sql, [...params, pageSize, offset]),
      query(countSql, params),
    ]);

    const total = Number.parseInt((countResult[0] as { count: string })?.count ?? '0', 10);
    const searchTime = Date.now() - startTime;

    log.debug({ keyword: processedKeyword, total, searchTime }, 'Full-text search completed');

    return {
      items: rows,
      total,
      page,
      pageSize,
      hasNextPage: offset + rows.length < total,
      searchTime,
    };
  } catch (err) {
    log.error({ err, keyword }, 'Full-text search failed');
    throw err;
  }
}

/**
 * 模糊搜索（使用 pg_trgm）
 * 适用于搜索建议、类似职位推荐
 */
export async function fuzzySearch(
  keyword: string,
  type: 'jobs' | 'companies' | 'all' = 'all',
  limit: number = 10
): Promise<{ jobs: unknown[]; companies: unknown[] }> {
  if (!keyword || keyword.length < 2) {
    return { jobs: [], companies: [] };
  }

  // 相似度阈值：0.1 = 10% 相似
  const threshold = 0.1;

  try {
    const results: { jobs: unknown[]; companies: unknown[] } = { jobs: [], companies: [] };

    if (type === 'jobs' || type === 'all') {
      const jobs = await query(`
        SELECT j.id, j.title, j.direction, j.city, c.name AS company_name,
               similarity(j.title, $1) AS sim
        FROM jobs j
        JOIN companies c ON c.id = j.company_id
        WHERE j.status = 'valid'
          AND (j.title % $1 OR j.direction % $1 OR c.name % $1)
        ORDER BY sim DESC, j.last_seen_at DESC
        LIMIT $2
      `, [keyword, limit]);
      results.jobs = jobs;
    }

    if (type === 'companies' || type === 'all') {
      const companies = await query(`
        SELECT c.id, c.name, c.industry, c.fame_score,
               GREATEST(
                 similarity(c.name, $1),
                 COALESCE(MAX(similarity(u, $1)), 0)
               ) AS sim
        FROM companies c
        LEFT JOIN UNNEST(c.alias_names) AS u ON true
        WHERE c.name % $1 OR $1 = ANY(c.alias_names) OR $1 = ANY(c.brand_names)
        GROUP BY c.id, c.name, c.industry, c.fame_score
        ORDER BY sim DESC
        LIMIT $2
      `, [keyword, limit]);
      results.companies = companies;
    }

    return results;
  } catch (err) {
    log.error({ err, keyword }, 'Fuzzy search failed');
    // pg_trgm 可能未启用，降级到 ILIKE
    return await fallbackSearch(keyword, type, limit);
  }
}

/**
 * 降级搜索（ILIKE）
 */
async function fallbackSearch(
  keyword: string,
  type: 'jobs' | 'companies' | 'all',
  limit: number
): Promise<{ jobs: unknown[]; companies: unknown[] }> {
  const likePattern = `%${keyword}%`;
  const results: { jobs: unknown[]; companies: unknown[] } = { jobs: [], companies: [] };

  if (type === 'jobs' || type === 'all') {
    results.jobs = await query(`
      SELECT j.id, j.title, j.direction, j.city, c.name AS company_name
      FROM jobs j
      JOIN companies c ON c.id = j.company_id
      WHERE j.status = 'valid'
        AND (j.title ILIKE $1 OR j.direction ILIKE $1 OR c.name ILIKE $1)
      ORDER BY j.last_seen_at DESC
      LIMIT $2
    `, [likePattern, limit]);
  }

  if (type === 'companies' || type === 'all') {
    results.companies = await query(`
      SELECT id, name, industry, fame_score
      FROM companies
      WHERE name ILIKE $1 OR $1 = ANY(alias_names) OR $1 = ANY(brand_names)
      ORDER BY fame_score DESC
      LIMIT $2
    `, [likePattern, limit]);
  }

  return results;
}

/**
 * 搜索建议（自动补全）
 */
export async function getSearchSuggestions(
  keyword: string,
  type: 'jobs' | 'companies' | 'all' = 'all',
  limit: number = 5
): Promise<{ suggestions: string[]; type: string }[]> {
  if (!keyword || keyword.length < 1) {
    return [];
  }

  const suggestions: { suggestions: string[]; type: string }[] = [];

  try {
    if (type === 'jobs' || type === 'all') {
      // 职位方向建议
      const directions = await query(`
        SELECT DISTINCT direction AS suggestion
        FROM jobs
        WHERE status = 'valid'
          AND direction ILIKE $1
          AND direction IS NOT NULL
        ORDER BY direction
        LIMIT $2
      `, [`${keyword}%`, limit]);

      suggestions.push({
        suggestions: directions.map((d) => (d as { suggestion: string }).suggestion),
        type: 'direction',
      });

      // 城市建议
      const cities = await query(`
        SELECT DISTINCT city AS suggestion
        FROM jobs
        WHERE status = 'valid'
          AND city ILIKE $1
          AND city IS NOT NULL
        ORDER BY city
        LIMIT $2
      `, [`${keyword}%`, limit]);

      suggestions.push({
        suggestions: cities.map((c) => (c as { suggestion: string }).suggestion),
        type: 'city',
      });
    }

    if (type === 'companies' || type === 'all') {
      // 公司名建议
      const companies = await query(`
        SELECT DISTINCT name AS suggestion
        FROM companies
        WHERE name ILIKE $1
        ORDER BY fame_score DESC
        LIMIT $2
      `, [`${keyword}%`, limit]);

      suggestions.push({
        suggestions: companies.map((c) => (c as { suggestion: string }).suggestion),
        type: 'company',
      });
    }

    return suggestions;
  } catch (err) {
    log.error({ err, keyword }, 'Search suggestions failed');
    return [];
  }
}

/**
 * 智能搜索（结合用户画像）
 * 根据用户兴趣调整搜索结果排序
 */
export async function intelligentSearch(
  profileId: number,
  options: SearchOptions
): Promise<SearchResult<unknown>> {
  const startTime = Date.now();
  const { keyword, page = 1, pageSize = 20, filters = {} } = options;
  const offset = (page - 1) * pageSize;

  // 1. 获取用户兴趣标签
  const userInterests = await query(`
    SELECT interest_key, score
    FROM user_interest_scores
    WHERE profile_id = $1 AND score > 0.1
    ORDER BY score DESC
    LIMIT 20
  `, [profileId]);

  // 2. 获取用户偏好的城市和行业
  const userPrefs = await query(`
    SELECT p.target_cities, p.internship_types
    FROM profiles p
    WHERE p.id = $1
  `, [profileId]);

  // 3. 构建智能查询
  const conditions: string[] = [`j.status = 'valid'`];
  const params: unknown[] = [];
  let paramIdx = 1;

  // 关键词搜索
  if (keyword) {
    conditions.push(`(
      j.search_vector @@ websearch_to_tsquery('simple', $${paramIdx})
      OR j.title ILIKE $${paramIdx + 1}
      OR j.direction ILIKE $${paramIdx + 1}
    )`);
    params.push(keyword, `%${keyword}%`);
    paramIdx += 2;
  }

  // 城市偏好（加分）
  const userCities = (userPrefs[0] as { target_cities?: string[] })?.target_cities ?? [];
  if (userCities.length > 0 && filters.city === undefined) {
    // 用户没有指定城市，使用偏好城市
  }

  // 过滤条件
  if (filters.city) {
    conditions.push(`j.city = $${paramIdx}`);
    params.push(filters.city);
    paramIdx++;
  }

  if (filters.industry) {
    conditions.push(`EXISTS (
      SELECT 1 FROM companies c WHERE c.id = j.company_id AND c.industry = $${paramIdx}
    )`);
    params.push(filters.industry);
    paramIdx++;
  }

  if (filters.internshipType) {
    conditions.push(`j.internship_type = $${paramIdx}`);
    params.push(filters.internshipType);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 构建查询：根据用户兴趣加权
  let orderBy = 'j.last_seen_at DESC';

  // 如果有用户兴趣，按兴趣匹配度排序
  if (userInterests.length > 0) {
    const cityBoost = userCities.length > 0
      ? `CASE WHEN j.city = ANY($${paramIdx}::text[]) THEN 1.5 ELSE 1.0 END`
      : '1.0';
    params.push(...userCities);

    orderBy = `(
      ${cityBoost} *
      COALESCE((
        SELECT MAX(uis.score)
        FROM user_interest_scores uis
        WHERE uis.profile_id = $1
          AND (
            (uis.interest_type = 'city' AND uis.interest_key = j.city)
            OR (uis.interest_type = 'position' AND (j.title ILIKE '%' || uis.interest_key || '%' OR j.direction ILIKE '%' || uis.interest_key || '%'))
            OR (uis.interest_type = 'industry' AND EXISTS (SELECT 1 FROM companies c WHERE c.id = j.company_id AND c.industry = uis.interest_key))
          )
      ), 0.5)
    ) DESC, j.last_seen_at DESC`;
  }

  const sql = `
    SELECT j.id, j.title, j.direction, j.city, j.company_id,
           j.internship_type, j.deadline, j.conversion_rate, j.status,
           c.name AS company_name, c.fame_score AS company_fame_score,
           EXISTS (
             SELECT 1 FROM job_entrypoints je
             WHERE je.job_id = j.id AND je.status = 'active' AND je.entry_type <> 'official'
           ) AS has_referral
    FROM jobs j
    JOIN companies c ON c.id = j.company_id
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  const countSql = `
    SELECT COUNT(*) AS count
    FROM jobs j
    JOIN companies c ON c.id = j.company_id
    ${whereClause}
  `;

  try {
    const [rows, countResult] = await Promise.all([
      query(sql, [...params, pageSize, offset]),
      query(countSql, params),
    ]);

    const total = Number.parseInt((countResult[0] as { count: string })?.count ?? '0', 10);
    const searchTime = Date.now() - startTime;

    log.debug({ profileId, keyword, total, searchTime }, 'Intelligent search completed');

    return {
      items: rows,
      total,
      page,
      pageSize,
      hasNextPage: offset + rows.length < total,
      searchTime,
    };
  } catch (err) {
    log.error({ err, profileId, keyword }, 'Intelligent search failed');
    // 降级到普通搜索
    return fullTextSearch(options);
  }
}

/**
 * 预处理搜索关键词
 * - 去除特殊字符
 * - 处理引号
 * - 分词
 */
function preprocessKeyword(keyword: string): string {
  if (!keyword) return '';

  // 去除开头和结尾的空白
  let processed = keyword.trim();

  // 去除特殊字符（保留字母、数字、中文、空格）
  processed = processed.replace(/[^\w\s\u4e00-\u9fff]/g, ' ');

  // 合并多个空格
  processed = processed.replace(/\s+/g, ' ');

  return processed;
}
