/**
 * 推荐 API v3
 * GET /api/recommendations - 获取个性化推荐
 *
 * v3 增强：
 * - 协同过滤推荐
 * - 负反馈过滤
 * - 多样性控制
 * - 冷启动策略
 * - 实时反馈闭环
 *
 * Query params:
 * - tier: top20 | top50 | top100 | top200 | all
 * - has_referral: boolean
 * - custom weights: fame_weight, match_weight, city_weight, deadline_weight, conversion_weight, freshness_weight, popularity_weight, collaborative_weight
 * - diversity: 保守型 | 平衡型 | 探索型
 * - include_breakdown: boolean (返回评分明细)
 */
import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';
import {
  calcCompositeScoreV3,
  buildRecommendationContext,
  getColdStartRecommendations,
  getCollaborativeRecommendations,
  applyDiversityControl,
  DIVERSITY_PRESETS,
  RANKING_PRESETS,
  type EnhancedRankingWeights,
  type RecommendationContext,
} from '@/server/recommendation';
import type { AgentProfileResult } from '@/types';

const RESULT_LIMITS = {
  top20: 20,
  top50: 50,
  top100: 100,
  top200: 200,
  all: 200,
} as const;

const TECH_JOB_KEYWORDS = [
  '前端', '后端', '服务端', '客户端', '全栈', '开发', '研发', '软件',
  '测试', '测试开发', '自动化测试', 'qa', '算法', 'ai', '人工智能', '人智',
  '机器学习', '深度学习', '大模型', 'llm', 'nlp', '自然语言', 'cv', '视觉',
  '推荐', '搜索', '搜广推', 'java', 'python', 'golang', 'go', 'c++', 'cpp',
  'javascript', 'typescript', 'react', 'vue', 'android', 'ios', 'flutter',
  '运维', 'sre', 'devops', 'infra', '平台工程', '数据开发', '数据工程',
  '数仓', '大数据', 'flink', 'spark', 'etl', '云计算', '网络安全', '信息安全',
];

const NON_TECH_JOB_KEYWORDS = [
  '经纪人', '经济人', '中介', '置业顾问', '房产', '地产', '销售', '客服',
  '行政', '人事', 'hr', '招聘', '财务', '会计', '出纳', '法务', '审计',
  '采购', '供应链', '文员', '招商主管', '商务拓展', '渠道经理', '导购',
  '证券经纪', '银行柜员',
];

const DIRECTION_KEYWORD_GROUPS = [
  {
    triggers: ['前端', 'web'],
    keywords: ['前端', 'web', 'react', 'vue', 'javascript', 'typescript', 'html', 'css'],
  },
  {
    triggers: ['后端', '服务端', 'java', 'python', 'golang', 'go', 'c++', 'cpp'],
    keywords: ['后端', '服务端', 'java', 'python', 'golang', 'c++', 'cpp', '微服务', '分布式'],
  },
  {
    triggers: ['算法', 'ai', '人工智能', '人智', '机器学习', '深度学习', '大模型', 'llm', 'nlp', 'cv', '视觉', '推荐', '搜索'],
    keywords: ['算法', 'ai', '人工智能', '人智', '机器学习', '深度学习', '大模型', 'llm', 'nlp', 'cv', '视觉', '推荐', '搜索'],
  },
  {
    triggers: ['客户端', 'android', 'ios', '移动端'],
    keywords: ['客户端', 'android', 'ios', '移动端', 'flutter'],
  },
  {
    triggers: ['测试', 'qa'],
    keywords: ['测试开发', '自动化测试', 'qa'],
  },
  {
    triggers: ['数据', '大数据', '数仓', 'data'],
    keywords: ['数据开发', '数据工程', '数仓', '大数据', 'flink', 'spark', 'etl'],
  },
  {
    triggers: ['运维', 'sre', 'devops', 'infra', '平台'],
    keywords: ['运维', 'sre', 'devops', 'infra', '平台工程', '云计算'],
  },
] as const;

interface ProfilePreferenceRow {
  id: number;
  major: string | null;
  target_cities: string[] | null;
  interested_directions: string[] | null;
  uninterested_directions: string[] | null;
}

interface SessionProfileRow {
  result_json: AgentProfileResult | string | null;
}

interface RecommendationCandidateRow extends Record<string, unknown> {
  title: string | null;
  direction: string | null;
  jd_text: string | null;
  company_name: string | null;
  company_industry: string | null;
  company_sub_industry: string | null;
}

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeStringList(values: string[] | null | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function parseAgentProfileResult(value: AgentProfileResult | string | null | undefined): AgentProfileResult | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as AgentProfileResult;
    } catch {
      return null;
    }
  }
  return value;
}

function buildJobSearchText(job: RecommendationCandidateRow): string {
  return normalizeText([
    job.title,
    job.direction,
    job.jd_text,
    job.company_name,
    job.company_industry,
    job.company_sub_industry,
  ].filter(Boolean).join(' '));
}

function includesAnyKeyword(text: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function collectDirectionKeywords(directions: string[]): string[] {
  const keywords = new Set<string>();

  for (const direction of directions) {
    const normalized = normalizeText(direction);
    if (!normalized) {
      continue;
    }

    keywords.add(normalized);

    for (const group of DIRECTION_KEYWORD_GROUPS) {
      if (group.triggers.some((trigger) => normalized.includes(trigger))) {
        group.keywords.forEach((keyword) => keywords.add(keyword));
      }
    }
  }

  return Array.from(keywords);
}

function isLikelyTechJob(text: string, interestedKeywords: string[]): boolean {
  if (!text) {
    return false;
  }

  if (interestedKeywords.length > 0 && includesAnyKeyword(text, interestedKeywords)) {
    return true;
  }

  return includesAnyKeyword(text, TECH_JOB_KEYWORDS);
}

function filterRecommendationRows(
  rows: RecommendationCandidateRow[],
  interestedDirections: string[],
  uninterestedDirections: string[],
): RecommendationCandidateRow[] {
  const interestedKeywords = collectDirectionKeywords(interestedDirections);
  const uninterestedKeywords = collectDirectionKeywords(uninterestedDirections);

  return rows.filter((job) => {
    const jobText = buildJobSearchText(job);
    const titleText = normalizeText(job.title);
    if (!jobText) {
      return false;
    }

    if (titleText && includesAnyKeyword(titleText, NON_TECH_JOB_KEYWORDS)) {
      return false;
    }

    const isTechJob = isLikelyTechJob(jobText, interestedKeywords);

    if (uninterestedKeywords.length > 0 && includesAnyKeyword(jobText, uninterestedKeywords)) {
      return false;
    }

    if (includesAnyKeyword(jobText, NON_TECH_JOB_KEYWORDS) && !isTechJob) {
      return false;
    }

    return isTechJob;
  });
}

export async function GET(request: NextRequest) {
  const auth = getAuthContext(request);
  const userId = auth?.userId ?? 1;

  const { searchParams } = new URL(request.url);
  const requestedTier = searchParams.get('tier') ?? 'all';
  const tier = Object.prototype.hasOwnProperty.call(RESULT_LIMITS, requestedTier)
    ? requestedTier as keyof typeof RESULT_LIMITS
    : 'all';
  const hasReferral = searchParams.get('has_referral') === 'true';
  const includeBreakdown = searchParams.get('include_breakdown') === 'true';
  const diversityPreset = (searchParams.get('diversity') ?? '平衡型') as keyof typeof DIVERSITY_PRESETS;
  const presetName = searchParams.get('preset') as keyof typeof RANKING_PRESETS | null;

  // v3: 获取用户配置或使用预设
  let weights: EnhancedRankingWeights;
  if (presetName && RANKING_PRESETS[presetName]) {
    weights = { ...RANKING_PRESETS[presetName] };
  } else {
    weights = {
      fame_weight: parseFloat(searchParams.get('fame_weight') ?? '0.2'),
      match_weight: parseFloat(searchParams.get('match_weight') ?? '0.2'),
      city_weight: parseFloat(searchParams.get('city_weight') ?? '0.2'),
      deadline_weight: parseFloat(searchParams.get('deadline_weight') ?? '0.2'),
      conversion_weight: parseFloat(searchParams.get('conversion_weight') ?? '0.2'),
      freshness_weight: parseFloat(searchParams.get('freshness_weight') ?? '0.1'),
      popularity_weight: parseFloat(searchParams.get('popularity_weight') ?? '0'),
      collaborative_weight: parseFloat(searchParams.get('collaborative_weight') ?? '0'),
    };
  }

  // 获取用户画像
  const profile = await queryOne<ProfilePreferenceRow>(
    `SELECT id, major, target_cities, interested_directions, uninterested_directions
     FROM profiles
     WHERE user_id = $1`,
    [userId],
  );
  const profileId = profile?.id ?? userId;

  // v3: 构建推荐上下文
  let context: RecommendationContext;
  let popularJobScores = new Map<number, number>();
  let similarUserJobs = new Map<number, number>();

  try {
    context = await buildRecommendationContext(profileId);

    // 如果用户有一定积累，获取协同过滤推荐
    if (context.similarUsersCount > 0 && context.interests.length >= 3) {
      similarUserJobs = await getCollaborativeRecommendations(profileId, 100, 0.15);
    }

    // 获取热门岗位分数
    const popularRows = await query<{ id: number; score: number }>(`
      SELECT j.id, COALESCE(ac.app_count, 0) + COALESCE(fc.fav_count, 0) AS score
      FROM jobs j
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INT AS app_count
        FROM applications a
        WHERE a.job_id = j.id AND a.created_at > NOW() - INTERVAL '30 days'
      ) ac ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INT AS fav_count
        FROM job_favorites jf
        WHERE jf.job_id = j.id AND jf.created_at > NOW() - INTERVAL '30 days'
      ) fc ON TRUE
      WHERE j.status = 'active'
    `);

    for (const row of popularRows) {
      popularJobScores.set(row.id, row.score);
    }
  } catch (err) {
    // 降级：使用基础上下文
    context = {
      profile: {
        id: profileId,
        targetCities: profile?.target_cities ?? [],
        internshipTypes: [],
      },
      tagPrefs: [],
      interests: [],
      dismissedJobs: [],
      recentInteractions: [],
      similarUsersCount: 0,
      isColdStart: true,
      activityScore: 0,
    };
  }

  // 获取其他配置
  const [tagPrefs, rankingPrefs, latestSession] = await Promise.all([
    query(`SELECT * FROM user_tag_prefs WHERE profile_id = $1`, [profileId]),
    queryOne<{ preset_name: string | null }>(`SELECT preset_name FROM user_ranking_prefs WHERE profile_id = $1`, [profileId]),
    queryOne<SessionProfileRow>(
      `SELECT result_json
       FROM agent_sessions
       WHERE profile_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [profileId],
    ),
  ]);

  // 更新 context 的 tagPrefs
  context.tagPrefs = tagPrefs as typeof context.tagPrefs;

  const latestProfileResult = parseAgentProfileResult(latestSession?.result_json);
  const interestedDirections = normalizeStringList(
    profile?.interested_directions?.length
      ? profile.interested_directions
      : latestProfileResult?.interested_directions,
  );
  const uninterestedDirections = normalizeStringList(
    profile?.uninterested_directions?.length
      ? profile.uninterested_directions
      : latestProfileResult?.uninterested_directions,
  );
  const resultLimit = RESULT_LIMITS[tier];
  const candidateLimit = Math.max(400, resultLimit * 6);

  const referralCondition = hasReferral
    ? `AND EXISTS (SELECT 1 FROM job_entrypoints je WHERE je.job_id = j.id AND je.entry_type != 'official')`
    : '';

  // v3: 排除已忽略的岗位
  const dismissedCondition = context.dismissedJobs.length > 0
    ? `AND j.id NOT IN (${context.dismissedJobs.map(d => d.jobId).join(',')})`
    : '';

  const rows = await query<Record<string, unknown>>(`
    SELECT
       j.*,
       c.name AS company_name,
       c.fame_score AS company_fame_score,
       c.size AS company_size,
       c.industry AS company_industry,
       c.sub_industry AS company_sub_industry,
       EXISTS (
         SELECT 1 FROM job_entrypoints je WHERE je.job_id = j.id AND je.status = 'active'
           AND je.entry_type <> 'official'
       ) AS has_referral,
       COALESCE(
         json_agg(
           DISTINCT jsonb_build_object(
             'id', t.id,
             'slug', t.slug,
             'label', t.label,
             'group_name', t.group_name,
             'color_hex', t.color_hex,
             'is_preset', t.is_preset,
             'created_at', t.created_at
           )
         ) FILTER (WHERE t.id IS NOT NULL),
         '[]'::json
       ) AS tags
     FROM jobs j
     JOIN companies c ON c.id = j.company_id
     LEFT JOIN job_tags jt ON jt.job_id = j.id
     LEFT JOIN tags t ON t.id = jt.tag_id
     WHERE j.status = 'valid'
     ${referralCondition}
     ${dismissedCondition}
     GROUP BY j.id, c.name, c.fame_score, c.size, c.industry, c.sub_industry
     ORDER BY j.last_seen_at DESC
     LIMIT $1
  `, [candidateLimit]);

  const filteredRows = filterRecommendationRows(
    rows as RecommendationCandidateRow[],
    interestedDirections,
    uninterestedDirections,
  );

  // v3: 冷启动处理
  let recommendations: Array<Record<string, unknown>>;

  if (context.isColdStart) {
    // 冷启动：使用多策略融合
    const coldStartSources = await getColdStartRecommendations(context, resultLimit);

    // 合并冷启动来源
    const coldStartJobs: Array<Record<string, unknown>> = [];
    for (const source of coldStartSources) {
      for (const job of source.jobs) {
        coldStartJobs.push({
          ...job,
          composite_score: job.sourceScore,
          source_type: source.type,
        });
      }
    }

    recommendations = coldStartJobs.slice(0, resultLimit);
  } else {
    // 个性化推荐
    recommendations = filteredRows.map((job) => {
      const result = calcCompositeScoreV3(
        job as unknown as Parameters<typeof calcCompositeScoreV3>[0],
        context,
        weights,
        popularJobScores,
        similarUserJobs,
      );

      return {
        ...job,
        composite_score: result.totalScore,
        ...(includeBreakdown ? { score_breakdown: result.dimensions } : {}),
      };
    });

    recommendations.sort((a, b) => (b.composite_score ?? 50) - (a.composite_score ?? 50));

    // v3: 应用多样性控制
    const diversityConfig = DIVERSITY_PRESETS[diversityPreset] ?? DIVERSITY_PRESETS.平衡型;
    recommendations = applyDiversityControl(
      recommendations as unknown as Array<typeof recommendations[0] & { compositeScore: number }>,
      diversityConfig
    ) as typeof recommendations;
  }

  return NextResponse.json({
    items: recommendations.slice(0, resultLimit),
    tier,
    weights,
    preset: presetName ?? rankingPrefs?.preset_name ?? null,
    diversity: diversityPreset,
    meta: {
      totalCandidates: filteredRows.length,
      dismissedCount: context.dismissedJobs.length,
      similarUsersCount: context.similarUsersCount,
      isColdStart: context.isColdStart,
      activityScore: context.activityScore,
      collaborativeJobsAvailable: similarUserJobs.size,
      popularityJobsAvailable: popularJobScores.size,
    },
  });
}
