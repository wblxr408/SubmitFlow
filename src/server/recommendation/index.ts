/**
 * 推荐引擎 v3
 * 增强版用户画像与智能推荐系统
 *
 * v3 核心增强：
 * 1. 负反馈建模：排除用户明确不感兴趣的岗位
 * 2. 协同过滤：基于相似用户的推荐
 * 3. 冷启动策略：多策略融合引导新用户
 * 4. 推荐多样性：热门 + 长尾 + 探索 三层架构
 * 5. 实时反馈：行为驱动的动态权重调整
 * 6. 兴趣衰减：时间维度上的兴趣衰减建模
 */
import { query, execute } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import type { Job, UserTagPref } from '@/types';

const log = createLogger('recommendation-v3');

// ============================================================
// 常量定义
// ============================================================

// 城市等级
const TIER1_CITIES = ['北京', '上海', '深圳', '广州'];
const NEW_TIER1_CITIES = ['杭州', '成都', '南京', '武汉', '西安', '苏州', '长沙', '天津'];

// 区域划分
const REGION_MAP: Record<string, string[]> = {
  '华东': ['南京', '苏州', '杭州', '宁波', '无锡', '合肥', '厦门', '福州', '济南', '青岛', '上海', '南通', '常州', '徐州', '温州', '台州', '嘉兴', '绍兴', '扬州', '镇江', '泰州', '盐城', '淮安', '连云港', '宿迁', '金华', '衢州', '丽水', '舟山'],
  '华南': ['广州', '深圳', '东莞', '佛山', '珠海', '南宁', '海口', '福州', '厦门', '泉州', '中山', '惠州', '江门', '肇庆', '汕头', '湛江', '茂名', '柳州', '桂林', '南宁'],
  '华北': ['北京', '天津', '石家庄', '太原', '呼和浩特', '唐山', '保定', '廊坊', '沧州', '邯郸', '秦皇岛', '邢台', '张家口', '承德'],
  '华中': ['武汉', '长沙', '郑州', '南昌', '合肥', '洛阳', '开封', '新乡', '焦作', '许昌', '株洲', '湘潭', '衡阳', '岳阳', '常德', '益阳', '娄底', '邵阳', '赣州', '九江'],
  '西南': ['成都', '重庆', '昆明', '贵阳', '拉萨', '绵阳', '德阳', '南充', '宜宾', '泸州', '达州', '乐山', '内江', '遂宁', '广安', '遵义', '安顺', '黔南', '黔东南'],
  '西北': ['西安', '兰州', '乌鲁木齐', '银川', '西宁', '咸阳', '宝鸡', '渭南', '榆林', '延安', '天水', '定西', '庆阳', '平凉', '张掖'],
  '东北': ['沈阳', '大连', '长春', '哈尔滨', '吉林', '鞍山', '抚顺', '本溪', '丹东', '锦州', '营口', '辽阳', '盘锦', '铁岭', '朝阳', '葫芦岛', '齐齐哈尔', '大庆', '佳木斯', '牡丹江'],
};

// 城市评分
const CITY_SCORE_EXACT = 100;
const CITY_SCORE_TIER1互通 = 85;
const CITY_SCORE_NEW_TIER1 = 80;
const CITY_SCORE_SAME_REGION = 70;
const CITY_SCORE_REMOTE = 75;
const CITY_SCORE_NON_TARGET = 30;
const CITY_SCORE_MISSING = 40;

// 紧迫性评分
const DEADLINE_SCORE_EXPIRED = 0;
const DEADLINE_SCORE_TODAY = 100;
const DEADLINE_SCORE_TOMORROW = 95;
const DEADLINE_SCORE_3DAYS = 90;
const DEADLINE_SCORE_7DAYS = 80;
const DEADLINE_SCORE_14DAYS = 65;
const DEADLINE_SCORE_21DAYS = 50;
const DEADLINE_SCORE_30DAYS = 40;
const DEADLINE_SCORE_60DAYS = 30;
const DEADLINE_SCORE_MISSING = 30;

// 新鲜度评分
const FRESHNESS_SCORE_1DAY = 100;
const FRESHNESS_SCORE_3DAYS = 90;
const FRESHNESS_SCORE_7DAYS = 75;
const FRESHNESS_SCORE_14DAYS = 60;
const FRESHNESS_SCORE_30DAYS = 45;
const FRESHNESS_SCORE_DEFAULT = 30;

// v3 新增：交互类型权重
const INTERACTION_WEIGHTS: Record<string, number> = {
  apply: 1.0,       // 投递：最强信号
  favorite: 0.6,   // 收藏：强信号
  view_detail: 0.4, // 查看详情：中强信号
  recommendation_click: 0.5, // 推荐点击：强信号
  search_result: 0.3, // 搜索结果点击：中信号
  view: 0.15,      // 浏览：弱信号
  recommendation_shown: 0.05, // 推荐展示：被动信号
  dismiss: -0.8,   // 忽略/滑走：负信号
};

// v3 新增：冷启动策略配置
export const COLD_START_CONFIG = {
  min_behaviors_for_profile: 5,     // 开始有个性化推荐所需最小行为数
  min_interests_for_collab: 3,      // 开始协同过滤所需最小兴趣数
  warm_up_weights: {
    // 新用户初始权重分配（逐步过渡到正常）
    fame_weight: 0.15,
    match_weight: 0.25,
    city_weight: 0.30,
    deadline_weight: 0.10,
    conversion_weight: 0.10,
    popularity_weight: 0.10,  // v3 新增：热门权重
  },
};

// ============================================================
// 类型定义
// ============================================================

// 简化的岗位类型（用于推荐引擎内部）
export interface SimpleJob {
  id: number;
  company_id: number;
  title: string;
  city: string | null;
  direction: string | null;
  deadline: string | null;
  conversion_rate: number | null;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
  company_fame_score: number;
  company_size?: string;
  is_remote?: boolean;
  tags?: Array<{ id: number; slug: string; label: string; group_name?: string; color_hex?: string; is_preset?: boolean; created_at?: string }>;
}

export interface UserProfile {
  id: number;
  userId?: number;
  school?: string | null;
  major?: string | null;
  graduationYear?: number | null;
  targetCities: string[];
  internshipTypes: string[];
  mode?: string | null;
}

export interface UserInterest {
  interestType: 'company' | 'position' | 'industry' | 'skill' | 'city';
  interestKey: string;
  score: number;
  decayFactor?: number;
  lastBehaviorAt?: string;
}

export interface DismissedJob {
  jobId: number;
  reason?: string;
  dismissedAt: string;
}

export interface JobInteraction {
  jobId: number;
  interactionType: string;
  interactionScore: number;
  timestamp: string;
}

export interface RecommendationContext {
  profile: UserProfile;
  tagPrefs: UserTagPref[];
  interests: UserInterest[];
  dismissedJobs: DismissedJob[];
  recentInteractions: JobInteraction[];
  similarUsersCount: number;
  isColdStart: boolean;
  activityScore: number;  // 0-100
}

export interface RecommendationSource {
  type: 'personalized' | 'collaborative' | 'popularity' | 'exploration';
  weight: number;
  jobs: Array<SimpleJob & { sourceScore: number }>;
}

export interface EnhancedRankingWeights extends RankingWeightsV2 {
  popularity_weight?: number;  // v3 新增：热门权重
  collaborative_weight?: number;  // v3 新增：协同过滤权重
}

export interface RankingWeightsV2 {
  fame_weight: number;
  match_weight: number;
  city_weight: number;
  deadline_weight: number;
  conversion_weight: number;
  freshness_weight?: number;
}

export interface ScoringDimensions {
  fameScore: number;
  matchScore: number;
  cityScore: number;
  deadlineScore: number;
  conversionScore: number | null;
  freshnessScore: number;
  popularityScore?: number;  // v3 新增
  collaborativeScore?: number;  // v3 新增
}

// ============================================================
// 预设模板权重（v3 新增多样性配置）
// ============================================================
export const RANKING_PRESETS = {
  稳重型: {
    fame_weight: 0.35,
    match_weight: 0.2,
    city_weight: 0.2,
    deadline_weight: 0.1,
    conversion_weight: 0.1,
    freshness_weight: 0.05,
  },
  海投型: {
    fame_weight: 0.1,
    match_weight: 0.2,
    city_weight: 0.15,
    deadline_weight: 0.3,
    conversion_weight: 0.15,
    freshness_weight: 0.1,
  },
  精准型: {
    fame_weight: 0.1,
    match_weight: 0.35,
    city_weight: 0.2,
    deadline_weight: 0.1,
    conversion_weight: 0.15,
    freshness_weight: 0.1,
  },
  新人型: {
    fame_weight: 0.15,
    match_weight: 0.3,
    city_weight: 0.25,
    deadline_weight: 0.1,
    conversion_weight: 0.05,
    freshness_weight: 0.15,
  },
  探索型: {
    fame_weight: 0.1,
    match_weight: 0.25,
    city_weight: 0.15,
    deadline_weight: 0.1,
    conversion_weight: 0.1,
    freshness_weight: 0.1,
    popularity_weight: 0.1,
    collaborative_weight: 0.1,
  },
} as const;

// ============================================================
// 推荐上下文构建
// ============================================================

/**
 * 获取用户推荐上下文
 * 整合所有用于推荐的数据
 */
export async function buildRecommendationContext(
  profileId: number
): Promise<RecommendationContext> {
  // 并行查询各项数据
  const [profileResult, tagPrefsResult, interestsResult, dismissedResult, interactionsResult] = await Promise.all([
    getUserProfile(profileId),
    getTagPreferences(profileId),
    getUserInterestsWithDecay(profileId),
    getDismissedJobs(profileId),
    getRecentInteractions(profileId, 50),
  ]);

  const similarUsersCount = await getSimilarUsersCount(profileId);
  const activityScore = calculateActivityScoreV2(interactionsResult);

  // 判断是否为冷启动用户
  const isColdStart =
    tagPrefsResult.length < COLD_START_CONFIG.min_behaviors_for_profile &&
    interestsResult.length < COLD_START_CONFIG.min_interests_for_collab;

  return {
    profile: profileResult,
    tagPrefs: tagPrefsResult,
    interests: interestsResult,
    dismissedJobs: dismissedResult,
    recentInteractions: interactionsResult,
    similarUsersCount,
    isColdStart,
    activityScore,
  };
}

/**
 * 获取用户基础画像
 */
async function getUserProfile(profileId: number): Promise<UserProfile> {
  const rows = await query(`
    SELECT id, user_id, school, major, graduation_year, target_cities, internship_types, mode
    FROM profiles
    WHERE id = $1
  `, [profileId]);

  if (!rows[0]) {
    return {
      id: profileId,
      targetCities: [],
      internshipTypes: [],
    };
  }

  const p = rows[0] as {
    id: number;
    user_id?: number;
    school?: string | null;
    major?: string | null;
    graduation_year?: number | null;
    target_cities?: string[];
    internship_types?: string[];
    mode?: string | null;
  };

  return {
    id: p.id,
    userId: p.user_id,
    school: p.school,
    major: p.major,
    graduationYear: p.graduation_year,
    targetCities: p.target_cities ?? [],
    internshipTypes: p.internship_types ?? [],
    mode: p.mode,
  };
}

/**
 * 获取用户标签偏好
 */
async function getTagPreferences(profileId: number): Promise<UserTagPref[]> {
  const rows = await query(`
    SELECT id, profile_id, tag_id, weight, created_at, updated_at
    FROM user_tag_prefs
    WHERE profile_id = $1
    ORDER BY weight DESC
  `, [profileId]);
  return rows as UserTagPref[];
}

/**
 * 获取用户兴趣（带衰减因子）
 */
async function getUserInterestsWithDecay(profileId: number): Promise<UserInterest[]> {
  const rows = await query(`
    SELECT
      interest_type,
      interest_key,
      score,
      decay_factor,
      last_behavior_at
    FROM user_interest_scores
    WHERE profile_id = $1 AND score >= 0.05
    ORDER BY score DESC
  `, [profileId]);

  return rows.map((r) => {
    const record = r as Record<string, unknown>;
    return {
      interestType: record.interest_type as UserInterest['interestType'],
      interestKey: record.interest_key as string,
      score: Number(record.score),
      decayFactor: Number(record.decay_factor ?? 1),
      lastBehaviorAt: record.last_behavior_at as string | undefined,
    };
  });
}

/**
 * 获取用户忽略的岗位
 */
async function getDismissedJobs(profileId: number): Promise<DismissedJob[]> {
  const rows = await query(`
    SELECT job_id, reason, created_at
    FROM dismissed_jobs
    WHERE profile_id = $1
    ORDER BY created_at DESC
  `, [profileId]);

  return rows.map((r) => {
    const record = r as Record<string, unknown>;
    return {
      jobId: record.job_id as number,
      reason: record.reason as string | undefined,
      dismissedAt: record.created_at as string,
    };
  });
}

/**
 * 获取用户最近交互
 */
async function getRecentInteractions(
  profileId: number,
  limit: number
): Promise<JobInteraction[]> {
  const rows = await query(`
    SELECT job_id, interaction_type, interaction_score, created_at
    FROM user_job_interactions
    WHERE profile_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `, [profileId, limit]);

  return rows.map((r) => {
    const record = r as Record<string, unknown>;
    return {
      jobId: record.job_id as number,
      interactionType: record.interaction_type as string,
      interactionScore: Number(record.interaction_score),
      timestamp: record.created_at as string,
    };
  });
}

/**
 * 获取相似用户数量
 */
async function getSimilarUsersCount(profileId: number): Promise<number> {
  const result = await query(`
    SELECT COUNT(*) as cnt
    FROM user_similarity
    WHERE (profile_id_1 = $1 OR profile_id_2 = $1)
      AND similarity_score >= 0.15
  `, [profileId]);
  const row = result[0] as Record<string, unknown>;
  return Number(row?.cnt ?? 0);
}

/**
 * 计算用户活跃度得分 v2（基于交互记录）
 */
function calculateActivityScoreV2(interactions: JobInteraction[]): number {
  if (interactions.length === 0) return 0;

  // 计算加权交互分数
  let weightedScore = 0;
  let maxPossibleScore = 0;
  const decayDays = 30;

  for (const interaction of interactions) {
    const weight = INTERACTION_WEIGHTS[interaction.interactionType] ?? 0;
    const daysAge = (Date.now() - new Date(interaction.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    const timeDecay = Math.max(0, 1 - daysAge / decayDays);

    weightedScore += weight * interaction.interactionScore * timeDecay;
    maxPossibleScore += Math.abs(weight);
  }

  return maxPossibleScore > 0
    ? Math.min(100, Math.round((weightedScore / maxPossibleScore) * 100))
    : 0;
}

// ============================================================
// 评分函数 v3
// ============================================================

/**
 * 城市匹配评分 v2 - 精细化
 */
export function calcCityScoreV2(
  jobCity: string | null,
  targetCities: string[],
  isRemote: boolean = false
): number {
  if (isRemote) return CITY_SCORE_REMOTE;
  if (!jobCity) return CITY_SCORE_MISSING;
  if (targetCities.length === 0) return CITY_SCORE_MISSING;

  // 精确匹配
  const exactMatch = targetCities.some(
    (c) => c.trim().toLowerCase() === jobCity.trim().toLowerCase()
  );
  if (exactMatch) return CITY_SCORE_EXACT;

  // 一线城市互通
  if (TIER1_CITIES.includes(jobCity) &&
      targetCities.some((c) => TIER1_CITIES.includes(c))) {
    return CITY_SCORE_TIER1互通;
  }

  // 新一线城市互通
  if (NEW_TIER1_CITIES.includes(jobCity) &&
      targetCities.some((c) => NEW_TIER1_CITIES.includes(c))) {
    return CITY_SCORE_NEW_TIER1;
  }

  // 同区域匹配
  for (const [region, cities] of Object.entries(REGION_MAP)) {
    if (cities.includes(jobCity) &&
        targetCities.some((c) => cities.includes(c))) {
      return CITY_SCORE_SAME_REGION;
    }
  }

  return CITY_SCORE_NON_TARGET;
}

/**
 * 紧迫性评分 v2 - 平滑化
 */
export function calcDeadlineScoreV2(deadline: string | null): number {
  if (!deadline) return DEADLINE_SCORE_MISSING;

  const days = Math.ceil(
    (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  if (days < 0) return DEADLINE_SCORE_EXPIRED;
  if (days === 0) return DEADLINE_SCORE_TODAY;
  if (days === 1) return DEADLINE_SCORE_TOMORROW;
  if (days <= 3) return DEADLINE_SCORE_3DAYS;
  if (days <= 7) return DEADLINE_SCORE_7DAYS;
  if (days <= 14) return DEADLINE_SCORE_14DAYS;
  if (days <= 21) return DEADLINE_SCORE_21DAYS;
  if (days <= 30) return DEADLINE_SCORE_30DAYS;
  if (days <= 60) return DEADLINE_SCORE_60DAYS;
  return 20;
}

/**
 * 知名度评分 v3 - 非线性化 + 规模加成
 */
export function calcFameScoreV2(
  fameScore: number,
  companySize: string = '中型'
): number {
  const normalizedScore = Math.min(100, Math.max(0, fameScore)) / 100;
  const baseScore = Math.pow(normalizedScore, 0.8) * 100;

  const sizeBonus: Record<string, number> = {
    '巨头': 5,
    '大型': 3,
    '中型': 0,
    '小型': -2,
  };

  return Math.min(100, Math.max(0, Math.round(baseScore + (sizeBonus[companySize] ?? 0))));
}

/**
 * 新鲜度评分 v2 - 新增
 */
export function calcFreshnessScoreV2(firstSeenAt: string | null): number {
  if (!firstSeenAt) return FRESHNESS_SCORE_DEFAULT;

  const days = Math.ceil(
    (Date.now() - new Date(firstSeenAt).getTime()) / (1000 * 60 * 60 * 24),
  );

  if (days <= 1) return FRESHNESS_SCORE_1DAY;
  if (days <= 3) return FRESHNESS_SCORE_3DAYS;
  if (days <= 7) return FRESHNESS_SCORE_7DAYS;
  if (days <= 14) return FRESHNESS_SCORE_14DAYS;
  if (days <= 30) return FRESHNESS_SCORE_30DAYS;
  return FRESHNESS_SCORE_DEFAULT;
}

/**
 * 匹配度评分 v3 - 考虑兴趣衰减
 */
export function calcMatchScoreV3(
  jobTagIds: number[],
  tagPrefs: UserTagPref[],
  interests: UserInterest[]
): number {
  if (tagPrefs.length === 0 && interests.length === 0) return 50;

  let matchScore = 0;
  let totalWeight = 0;

  // 标签偏好评分
  if (tagPrefs.length > 0) {
    const tagTotalWeight = tagPrefs.reduce((sum, p) => sum + p.weight, 0);
    if (tagTotalWeight > 0) {
      const tagHitWeight = tagPrefs
        .filter((p) => jobTagIds.includes(p.tag_id))
        .reduce((sum, p) => sum + p.weight, 0);
      matchScore += (100 * tagHitWeight) / tagTotalWeight;
      totalWeight += 1;
    }
  }

  // 兴趣衰减评分
  if (interests.length > 0) {
    const skillInterests = interests.filter(i => i.interestType === 'skill');
    if (skillInterests.length > 0) {
      const interestMatchCount = skillInterests.filter(i =>
        jobTagIds.some(tagId => {
          // 简单匹配：检查兴趣 key 是否与标签相关
          const interestKey = i.interestKey.toLowerCase();
          return tagId.toString().includes(interestKey) ||
                 interestKey.includes(tagId.toString());
        })
      ).length;

      // 考虑衰减因子的加权匹配
      const weightedInterestMatch = interestMatchCount *
        skillInterests.reduce((sum, i) => sum + (i.decayFactor ?? 1) * i.score, 0) /
        skillInterests.length;

      matchScore += Math.min(100, weightedInterestMatch * 100);
      totalWeight += 1;
    }
  }

  return totalWeight > 0 ? Math.round(matchScore / totalWeight) : 50;
}

/**
 * 转正率评分
 */
function calcConversionScore(conversionRate: number | null): number | null {
  if (conversionRate === null || conversionRate === undefined) return null;
  return Math.min(100, Math.max(0, conversionRate));
}

/**
 * v3 新增：热门度评分
 */
export function calcPopularityScore(jobId: number, popularJobScores: Map<number, number>): number {
  const score = popularJobScores.get(jobId);
  if (score === undefined) return 30; // 默认中低热度
  // 归一化到 0-100
  return Math.min(100, Math.round(Math.log1p(score) * 15));
}

/**
 * v3 新增：协同过滤评分
 */
export function calcCollaborativeScore(jobId: number, similarUserJobs: Map<number, number>): number {
  const score = similarUserJobs.get(jobId);
  if (score === undefined) return 0;
  return Math.min(100, Math.round(score * 100));
}

// ============================================================
// 综合评分 v3
// ============================================================

export function calcCompositeScoreV3(
  job: Job & {
    company_fame_score: number;
    company_size?: string;
    is_remote?: boolean;
    first_seen_at?: string;
  },
  context: RecommendationContext,
  weights: EnhancedRankingWeights,
  popularJobScores: Map<number, number>,
  similarUserJobs: Map<number, number>,
): { totalScore: number; dimensions: ScoringDimensions } {
  const {
    fame_weight,
    match_weight,
    city_weight,
    deadline_weight,
    conversion_weight,
    freshness_weight = 0.1,
    popularity_weight = 0,
    collaborative_weight = 0,
  } = weights;

  // 计算基础维度得分
  const dimensions: ScoringDimensions = {
    fameScore: calcFameScoreV2(job.company_fame_score, job.company_size),
    matchScore: calcMatchScoreV3(job.tags?.map((t) => t.id) ?? [], context.tagPrefs, context.interests),
    cityScore: calcCityScoreV2(job.city, context.profile.targetCities, job.is_remote ?? false),
    deadlineScore: calcDeadlineScoreV2(job.deadline),
    conversionScore: calcConversionScore(job.conversion_rate ?? null),
    freshnessScore: calcFreshnessScoreV2(job.first_seen_at),
    popularityScore: calcPopularityScore(job.id, popularJobScores),
    collaborativeScore: calcCollaborativeScore(job.id, similarUserJobs),
  };

  // 构建评分数组
  const scores: Array<{ score: number; weight: number; key: keyof ScoringDimensions }> = [
    { score: dimensions.fameScore, weight: fame_weight, key: 'fameScore' },
    { score: dimensions.matchScore, weight: match_weight, key: 'matchScore' },
    { score: dimensions.cityScore, weight: city_weight, key: 'cityScore' },
    { score: dimensions.deadlineScore, weight: deadline_weight, key: 'deadlineScore' },
    { score: dimensions.freshnessScore, weight: freshness_weight, key: 'freshnessScore' },
    { score: dimensions.popularityScore ?? 30, weight: popularity_weight, key: 'popularityScore' },
    { score: dimensions.collaborativeScore ?? 0, weight: collaborative_weight, key: 'collaborativeScore' },
  ];

  // 转正率可选
  if (dimensions.conversionScore !== null) {
    scores.push({ score: dimensions.conversionScore, weight: conversion_weight, key: 'conversionScore' });
  }

  // 过滤有效权重
  const validScores = scores.filter((s) => s.weight > 0);
  const validWeightSum = validScores.reduce((sum, s) => sum + s.weight, 0);

  // 除零守卫
  if (validWeightSum <= 0) {
    return { totalScore: 50, dimensions };
  }

  // 加权平均
  const weightedSum = validScores.reduce((sum, s) => sum + s.score * s.weight, 0);

  // v3 新增：负反馈惩罚
  const dismissPenalty = context.dismissedJobs.some(d => d.jobId === job.id) ? 0.5 : 1;

  // v3 新增：历史交互加成
  const interactionBonus = calculateInteractionBonus(job.id, context.recentInteractions);

  const finalScore = Math.round((weightedSum / validWeightSum) * dismissPenalty * (1 + interactionBonus));

  return {
    totalScore: Math.min(100, Math.max(0, finalScore)),
    dimensions,
  };
}

/**
 * 计算历史交互加成
 */
function calculateInteractionBonus(jobId: number, interactions: JobInteraction[]): number {
  const jobInteractions = interactions.filter(i => i.jobId === jobId);
  if (jobInteractions.length === 0) return 0;

  let bonus = 0;
  for (const interaction of jobInteractions) {
    const weight = INTERACTION_WEIGHTS[interaction.interactionType] ?? 0;
    bonus += weight * interaction.interactionScore;
  }

  // 平滑加成，最大 20%
  return Math.min(0.2, bonus * 0.1);
}

// ============================================================
// 推荐多样性控制
// ============================================================

export interface DiversityConfig {
  explorationRatio: number;  // 探索比例
  popularityRatio: number;   // 热门比例
  maxSameCompany: number;    // 同公司最大岗位数
  minCitySpread: number;     // 最小城市分布
}

export const DIVERSITY_PRESETS = {
  保守型: {
    explorationRatio: 0.10,
    popularityRatio: 0.40,
    maxSameCompany: 2,
    minCitySpread: 1,
  },
  平衡型: {
    explorationRatio: 0.20,
    popularityRatio: 0.30,
    maxSameCompany: 3,
    minCitySpread: 2,
  },
  探索型: {
    explorationRatio: 0.35,
    popularityRatio: 0.20,
    maxSameCompany: 5,
    minCitySpread: 3,
  },
} as const;

/**
 * 应用多样性控制
 */

export function applyDiversityControl<
  T extends { company_id: number; city: string | null; composite_score: number }
>(
  jobs: T[],
  config: DiversityConfig
): T[] {
  if (jobs.length === 0) return jobs;

  // 1. 按公司分组限制
  const companyCounts = new Map<number, number>();
  const limitedByCompany: T[] = [];

  for (const job of jobs) {
    const companyId = job.company_id;
    const currentCount = companyCounts.get(companyId) ?? 0;
    if (currentCount < config.maxSameCompany) {
      limitedByCompany.push(job);
      companyCounts.set(companyId, currentCount + 1);
    }
  }

  // 2. 城市分布（保留各城市优质岗位）
  const cityMap = new Map<string, T[]>();
  for (const job of limitedByCompany) {
    const city = job.city ?? 'unknown';
    if (!cityMap.has(city)) cityMap.set(city, []);
    cityMap.get(city)!.push(job);
  }

  // 合并回列表，优先保留各城市 top 岗位
  const diversified: T[] = [];
  for (const [, cityJobs] of cityMap) {
    cityJobs.sort((a, b) => (b.composite_score ?? 0) - (a.composite_score ?? 0));
    const keepCount = Math.ceil(config.minCitySpread * cityJobs.length);
    diversified.push(...cityJobs.slice(0, keepCount));
  }

  return diversified.sort((a, b) => (b.composite_score ?? 0) - (a.composite_score ?? 0));
}

// ============================================================
// 冷启动策略
// ============================================================

/**
 * 获取冷启动推荐
 * 策略组合：热门 + 城市匹配 + AI 引导
 */
export async function getColdStartRecommendations(
  context: RecommendationContext,
  limit: number = 20
): Promise<RecommendationSource[]> {
  const sources: RecommendationSource[] = [];

  // 1. 热门推荐（不考虑个性化）
  const popularJobs = await getPopularJobsFromDB(limit, context.profile.targetCities);
  if (popularJobs.length > 0) {
    sources.push({
      type: 'popularity',
      weight: 0.4,
      jobs: popularJobs,
    });
  }

  // 2. 城市匹配热门（考虑目标城市）
  const cityMatchedJobs = await getCityMatchedPopularJobs(
    context.profile.targetCities,
    limit
  );
  if (cityMatchedJobs.length > 0) {
    sources.push({
      type: 'exploration',
      weight: 0.3,
      jobs: cityMatchedJobs,
    });
  }

  // 3. 新发布岗位（新鲜度优先）
  const newJobs = await getNewJobs(limit);
  if (newJobs.length > 0) {
    sources.push({
      type: 'exploration',
      weight: 0.3,
      jobs: newJobs,
    });
  }

  return sources;
}

/**
 * 从数据库获取热门岗位
 */
async function getPopularJobsFromDB(
  limit: number,
  targetCities: string[]
): Promise<Array<SimpleJob & { sourceScore: number }>> {
  const rows = await query(`
    SELECT
      j.id, j.company_id, j.title, j.city, j.direction, j.deadline,
      j.conversion_rate, j.status, j.first_seen_at, j.last_seen_at,
      c.fame_score AS company_fame_score, c.size AS company_size, j.is_remote,
      COALESCE(ac.app_count, 0) + COALESCE(fc.fav_count, 0) AS popularity_score
    FROM jobs j
    JOIN companies c ON c.id = j.company_id
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
      AND (j.deadline IS NULL OR j.deadline > NOW())
    ORDER BY popularity_score DESC, j.first_seen_at DESC
    LIMIT $1
  `, [limit]);

  return rows.map((r) => {
    const record = r as Record<string, unknown>;
    return {
      id: record.id as number,
      company_id: record.company_id as number,
      title: record.title as string,
      city: record.city as string | null,
      direction: record.direction as string | null,
      deadline: record.deadline as string | null,
      conversion_rate: record.conversion_rate as number | null,
      status: record.status as string,
      first_seen_at: record.first_seen_at as string,
      last_seen_at: record.last_seen_at as string,
      company_fame_score: (record.company_fame_score ?? 50) as number,
      company_size: record.company_size as string | undefined,
      is_remote: (record.is_remote as boolean) ?? false,
      tags: [],
      sourceScore: Number(record.popularity_score ?? 0),
    };
  });
}

/**
 * 获取城市匹配热门岗位
 */
async function getCityMatchedPopularJobs(
  targetCities: string[],
  limit: number
): Promise<Array<SimpleJob & { sourceScore: number }>> {
  if (targetCities.length === 0) return [];

  const rows = await query(`
    SELECT
      j.id, j.company_id, j.title, j.city, j.direction, j.deadline,
      j.conversion_rate, j.status, j.first_seen_at, j.last_seen_at,
      c.fame_score AS company_fame_score, c.size AS company_size, j.is_remote,
      COALESCE(ac.app_count, 0) AS popularity_score
    FROM jobs j
    JOIN companies c ON c.id = j.company_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::INT AS app_count
      FROM applications a
      WHERE a.job_id = j.id AND a.created_at > NOW() - INTERVAL '30 days'
    ) ac ON TRUE
    WHERE j.status = 'active'
      AND j.city = ANY($1)
      AND (j.deadline IS NULL OR j.deadline > NOW())
    ORDER BY popularity_score DESC, j.first_seen_at DESC
    LIMIT $2
  `, [targetCities, limit]);

  return rows.map((r) => {
    const record = r as Record<string, unknown>;
    return {
      id: record.id as number,
      company_id: record.company_id as number,
      title: record.title as string,
      city: record.city as string | null,
      direction: record.direction as string | null,
      deadline: record.deadline as string | null,
      conversion_rate: record.conversion_rate as number | null,
      status: record.status as string,
      first_seen_at: record.first_seen_at as string,
      last_seen_at: record.last_seen_at as string,
      company_fame_score: (record.company_fame_score ?? 50) as number,
      company_size: record.company_size as string | undefined,
      is_remote: (record.is_remote as boolean) ?? false,
      tags: [],
      sourceScore: Number(record.popularity_score ?? 0),
    };
  });
}

/**
 * 获取新发布岗位
 */
async function getNewJobs(limit: number): Promise<Array<SimpleJob & { sourceScore: number }>> {
  const rows = await query(`
    SELECT
      j.id, j.company_id, j.title, j.city, j.direction, j.deadline,
      j.conversion_rate, j.status, j.first_seen_at, j.last_seen_at,
      c.fame_score AS company_fame_score, c.size AS company_size, j.is_remote
    FROM jobs j
    JOIN companies c ON c.id = j.company_id
    WHERE j.status = 'active'
      AND j.first_seen_at > NOW() - INTERVAL '7 days'
      AND (j.deadline IS NULL OR j.deadline > NOW())
    ORDER BY j.first_seen_at DESC
    LIMIT $1
  `, [limit]);

  return rows.map((r) => {
    const record = r as Record<string, unknown>;
    return {
      id: record.id as number,
      company_id: record.company_id as number,
      title: record.title as string,
      city: record.city as string | null,
      direction: record.direction as string | null,
      deadline: record.deadline as string | null,
      conversion_rate: record.conversion_rate as number | null,
      status: record.status as string,
      first_seen_at: record.first_seen_at as string,
      last_seen_at: record.last_seen_at as string,
      company_fame_score: (record.company_fame_score ?? 50) as number,
      company_size: record.company_size as string | undefined,
      is_remote: (record.is_remote as boolean) ?? false,
      tags: [],
      sourceScore: 75, // 新发布岗位默认高分
    };
  });
}

// ============================================================
// 协同过滤推荐
// ============================================================

/**
 * 获取相似用户推荐的岗位
 */
export async function getCollaborativeRecommendations(
  profileId: number,
  limit: number = 20,
  minSimilarity: number = 0.15
): Promise<Map<number, number>> {
  const rows = await query(`
    SELECT job_id, similarity_score
    FROM (
      SELECT
        a.job_id,
        MAX(su.similarity_score) AS similarity_score,
        ROW_NUMBER() OVER (PARTITION BY a.job_id ORDER BY MAX(su.similarity_score) DESC) AS rn
      FROM applications a
      JOIN (
        SELECT profile_id_2 AS profile_id, similarity_score
        FROM user_similarity
        WHERE profile_id_1 = $1 AND similarity_score >= $3
        UNION
        SELECT profile_id_1 AS profile_id, similarity_score
        FROM user_similarity
        WHERE profile_id_2 = $1 AND similarity_score >= $3
      ) su ON a.profile_id = su.profile_id
      WHERE a.job_id NOT IN (
        SELECT job_id FROM applications WHERE profile_id = $1
      )
      AND a.job_id NOT IN (
        SELECT job_id FROM dismissed_jobs WHERE profile_id = $1
      )
      AND a.status NOT IN ('rejected', 'withdrawn')
      GROUP BY a.job_id
    ) ranked
    WHERE rn = 1
    ORDER BY similarity_score DESC
    LIMIT $2
  `, [profileId, limit, minSimilarity]);

  const result = new Map<number, number>();
  for (const row of rows) {
    const r = row as { job_id: number; similarity_score: number };
    result.set(r.job_id, Number(r.similarity_score));
  }

  return result;
}

// ============================================================
// 负反馈管理
// ============================================================

/**
 * 记录负反馈
 */
export async function recordDismiss(
  profileId: number,
  jobId: number,
  reason?: string
): Promise<void> {
  await execute(`
    INSERT INTO dismissed_jobs (profile_id, job_id, reason)
    VALUES ($1, $2, $3)
    ON CONFLICT (profile_id, job_id)
    DO UPDATE SET reason = COALESCE($3, dismissed_jobs.reason), created_at = NOW()
  `, [profileId, jobId, reason ?? null]);

  log.debug({ profileId, jobId, reason }, 'Job dismissed');
}

/**
 * 批量记录负反馈
 */
export async function recordDismissBatch(
  profileId: number,
  jobIds: number[],
  reason?: string
): Promise<void> {
  if (jobIds.length === 0) return;

  for (const jobId of jobIds) {
    await recordDismiss(profileId, jobId, reason);
  }
}

/**
 * 清除负反馈（用户反悔）
 */
export async function undismissJob(profileId: number, jobId: number): Promise<void> {
  await execute(`
    DELETE FROM dismissed_jobs WHERE profile_id = $1 AND job_id = $2
  `, [profileId, jobId]);

  log.debug({ profileId, jobId }, 'Job undismissed');
}

// ============================================================
// 细粒度交互记录
// ============================================================

/**
 * 记录用户-岗位交互
 */
export async function recordJobInteraction(
  profileId: number,
  jobId: number,
  interactionType: string,
  options: {
    sessionId?: string;
    referrer?: string;
    positionIndex?: number;
    dwellTimeMs?: number;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const {
    sessionId,
    referrer,
    positionIndex,
    dwellTimeMs,
    metadata = {},
  } = options;

  // 计算交互分数
  const baseWeight = INTERACTION_WEIGHTS[interactionType] ?? 0;
  const timeBonus = dwellTimeMs ? Math.min(1, dwellTimeMs / 30000) : 0.5; // 30秒为满分
  const positionBonus = positionIndex ? Math.max(0.5, 1 - positionIndex * 0.05) : 1; // 位置越靠前越高
  const interactionScore = Math.min(1, baseWeight * timeBonus * positionBonus);

  await execute(`
    INSERT INTO user_job_interactions (
      profile_id, job_id, interaction_type, interaction_score,
      session_id, referrer, position_index, dwell_time_ms, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [
    profileId,
    jobId,
    interactionType,
    interactionScore,
    sessionId ?? null,
    referrer ?? null,
    positionIndex ?? null,
    dwellTimeMs ?? null,
    JSON.stringify(metadata),
  ]);

  // 如果是强交互，同步更新兴趣分数
  if (baseWeight >= 0.5) {
    await syncInterestFromInteraction(profileId, jobId, baseWeight);
  }
}

/**
 * 从交互同步兴趣分数
 */
async function syncInterestFromInteraction(
  profileId: number,
  jobId: number,
  weight: number
): Promise<void> {
  const jobs = await query(`
    SELECT j.city, j.direction, c.name AS company_name, c.industry
    FROM jobs j
    JOIN companies c ON c.id = j.company_id
    WHERE j.id = $1
  `, [jobId]);

  if (!jobs[0]) return;

  const { city, direction, company_name, industry } = jobs[0] as {
    city?: string;
    direction?: string;
    company_name?: string;
    industry?: string;
  };

  const delta = weight * 0.3;

  if (city) {
    await upsertInterestScoreV2(profileId, 'city', city, delta);
  }
  if (company_name) {
    await upsertInterestScoreV2(profileId, 'company', company_name, delta);
  }
  if (industry) {
    await upsertInterestScoreV2(profileId, 'industry', industry, delta * 0.5);
  }
  if (direction) {
    await upsertInterestScoreV2(profileId, 'position', direction, delta);
  }
}

/**
 * UPSERT 兴趣分数 v2（带衰减）
 */
async function upsertInterestScoreV2(
  profileId: number,
  interestType: string,
  interestKey: string,
  delta: number
): Promise<void> {
  // 获取衰减配置
  const configRows = await query(`
    SELECT decay_rate_daily, min_score
    FROM interest_decay_config
    WHERE interest_type = $1
  `, [interestType]);

  const decayRate = configRows[0]
    ? (configRows[0] as { decay_rate_daily: number }).decay_rate_daily
    : 0.01;

  await execute(`
    INSERT INTO user_interest_scores (
      profile_id, interest_type, interest_key, score, peak_score,
      behavior_count, last_behavior_at, decay_factor
    ) VALUES ($1, $2, $3, $4, $4, 1, NOW(), 1.0)
    ON CONFLICT (profile_id, interest_type, interest_key)
    DO UPDATE SET
      score = LEAST(1.0, user_interest_scores.score + $4),
      peak_score = GREATEST(user_interest_scores.peak_score, LEAST(1.0, user_interest_scores.score + $4)),
      behavior_count = user_interest_scores.behavior_count + 1,
      last_behavior_at = NOW(),
      decay_factor = POWER((1 - $5), EXTRACT(EPOCH FROM (NOW() - user_interest_scores.last_behavior_at)) / 86400),
      updated_at = NOW()
  `, [profileId, interestType, interestKey, delta, decayRate]);
}

// ============================================================
// 向后兼容：保留 v1/v2 函数
// ============================================================
export function calcDeadlineScore(deadline: string | null): number {
  return calcDeadlineScoreV2(deadline);
}

export function calcCityScore(jobCity: string | null, targetCities: string[], isRemote: boolean = false): number {
  return calcCityScoreV2(jobCity, targetCities, isRemote);
}

export function calcMatchScore(jobTagIds: number[], tagPrefs: UserTagPref[]): number {
  return calcMatchScoreV3(jobTagIds, tagPrefs, []);
}

export function calcFameScore(fameScore: number): number {
  return calcFameScoreV2(fameScore, '中型');
}

export function calcCompositeScore(
  job: Job & { company_fame_score: number },
  tagPrefs: UserTagPref[],
  targetCities: string[],
  weights: {
    fame_weight: number;
    match_weight: number;
    city_weight: number;
    deadline_weight: number;
    conversion_weight: number;
  },
): number {
  const context: RecommendationContext = {
    profile: { id: 0, targetCities, internshipTypes: [] },
    tagPrefs,
    interests: [],
    dismissedJobs: [],
    recentInteractions: [],
    similarUsersCount: 0,
    isColdStart: false,
    activityScore: 50,
  };

  const result = calcCompositeScoreV3(
    job as Job & { company_fame_score: number; company_size?: string; is_remote?: boolean; first_seen_at?: string },
    context,
    { ...weights, freshness_weight: 0.1 },
    new Map(),
    new Map()
  );
  return result.totalScore;
}

// ============================================================
// 榜单分层
// ============================================================
export function getTierRange(tier: string): [number, number] | null {
  const map: Record<string, [number, number]> = {
    top20: [0, 20],
    top50: [20, 50],
    top100: [50, 100],
    top200: [100, 200],
  };
  return map[tier] ?? null;
}
