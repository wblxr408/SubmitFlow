/**
 * 用户画像服务 v1.6
 * - 多层次行为事件采集
 * - 职业意向分类（Career Intent Classification）
 * - 用户生命周期阶段（Lifecycle Stage）
 * - 活跃模式分类（Activity Pattern）
 * - 求职紧迫度评估（Job Urgency）
 * - 偏好稳定性追踪（Preference Stability）
 * - 数字肢体语言信号（Digital Body Language）
 * - 行为序列特征（Sequence Features）
 *
 * 对标：LinkedIn Digital Body Language + ICLER意图分类
 */
import { query, execute } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('profiling');

// ============================================================
// 第一部分：类型定义
// ============================================================

// ---- 行为类型 ----

/** 行为类别（行为归类的顶层分类） */
export type BehaviorCategory =
  | 'exposure'    // 曝光
  | 'engagement'  // 互动
  | 'action'      // 行动
  | 'feedback'    // 反馈
  | 'social'      // 社交
  | 'notification' // 通知
  | 'profile';    // 资料

/** 细粒度行为类型（v2） */
export type BehaviorTypeV2 =
  // 曝光类
  | 'impression'
  | 'recommendation_shown'
  | 'search_result_shown'
  // 互动类
  | 'view'
  | 'view_detail'
  | 'view_company'
  | 'view_JD'
  | 'hover'
  | 'scroll'
  | 'search'
  | 'filter_change'
  | 'search_refine'
  // 行动类
  | 'click'
  | 'apply'
  | 'apply_start'
  | 'favorite'
  | 'unfavorite'
  | 'share'
  | 'save_draft'
  | 'resume_download'
  | 'resume_upload'
  // 反馈类
  | 'dismiss'
  | 'hide_company'
  | 'report_spam'
  | 'negative_feedback'
  // AI交互类
  | 'ai_chat'
  | 'ai_question'
  | 'ai_recommendation'
  | 'ai_profile_update'
  // 社交类
  | 'view_referral'
  | 'use_referral'
  | 'connect_recruiter'
  // 通知类
  | 'notification_open'
  | 'notification_click'
  | 'email_open'
  | 'email_click'
  // 资料编辑类
  | 'profile_view'
  | 'profile_edit'
  | 'resume_edit'
  | 'skill_add'
  | 'skill_remove';

/** 目标对象类型 */
export type TargetType = 'job' | 'company' | 'tag' | 'search' | 'recommendation' | 'profile' | 'resume' | 'ai' | 'referral';

// ---- 职业意向分类 ----

/** 职业主意向（一级） */
export type CareerIntentPrimary =
  | 'active_job_seeker'       // 主动求职者（最强意向）
  | 'passive_talent'          // 被动型人才（有意向但观望）
  | 'exploratory'             // 探索型（随便看看）
  | 'internship_seeker'       // 实习求职者
  | 'career_changer'         // 转型求职者
  | 'new_grad'               // 应届生求职
  | 'returning_professional'  // 回归职场者
  | 'information_gathering'    // 信息收集型
  | 'market_research'         // 市场调研（评估自身价值）
  | 'passive_browsing'        // 被动浏览（无明确意向）
  | 'idle_curiosity'          // 闲逛好奇心
  | 'network_builder'          // 人脉拓展型
  | 'content_consumer';        // 内容消费型

/** 职业次意向（二级） */
export type CareerIntentSecondary =
  // active_job_seeker 的二级分类
  | 'urgent_apply'       // 紧迫投递型
  | 'selective_apply'    // 选择性投递型
  | 'bulk_apply'         // 海投型
  | 'defensive_apply'    // 防御型投递
  | 'last_mile'         // Offer谈判阶段
  // passive_talent 的二级分类
  | 'window_shopping'    // 观望型
  | 'opportunity_aware'  // 关注机会型
  | 'recruiter_responsive' // recruiter响应型
  | 'salary_conscious'   // 薪资驱动型
  | 'growth_oriented'    // 成长驱动型
  // exploratory 二级分类
  | 'trend_tracking'     // 趋势跟踪型
  | 'benchmarking'       // 对标学习型
  | 'option_exploration'; // 选项探索型

// ---- 用户生命周期 ----

/** 用户生命周期阶段 */
export type LifecycleStage =
  | 'onboarding'           // 入职引导
  | 'cold_start'          // 冷启动
  | 'profile_setup'        // 资料完善中
  | 'early_exploration'   // 早期探索
  | 'active_browsing'      // 活跃浏览
  | 'intent_formation'     // 意向形成
  | 'active_application'   // 积极投递
  | 'application_tracking' // 投递追踪
  | 'offer_evaluation'     // Offer评估
  | 'hired_success'        // 求职成功
  | 'dormant'            // 沉睡用户
  | 'churned';           // 流失

// ---- 活跃模式 ----

/** 活跃时间模式 */
export type ActiveTimePattern = 'morning' | 'afternoon' | 'evening' | 'late_night' | 'mixed';

/** 活跃日模式 */
export type ActiveDaysPattern = 'weekday_only' | 'weekend_only' | 'everyday' | 'sporadic';

/** 活跃频率 */
export type ActivityFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'sporadic';

/** 互动深度 */
export type EngagementDepth = 'surface_skim' | 'selective_deep' | 'thorough_explorer';

/** 求职策略 */
export type JobSearchStrategy = 'focused_narrow' | 'focused_broad' | 'scattered' | 'opportunistic';

/** 漏斗位置 */
export type FunnelPosition = 'awareness' | 'interest' | 'consideration' | 'intent' | 'conversion';

// ---- 紧迫度 ----

/** 紧迫度等级 */
export type UrgencyLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

/** 紧迫度类型 */
export type UrgencyType = 'financial' | 'career_timing' | 'notice_period' | 'market_timing';

// ---- 偏好稳定性 ----

/** 稳定性分类 */
export type StabilityCategory = 'highly_stable' | 'stable' | 'evolving' | 'unstable';

/** 漂移方向 */
export type DriftDirection = 'converging' | 'diverging' | 'stable' | 'shifted';

/** 趋势方向 */
export type TrendDirection = 'increasing' | 'decreasing' | 'stable' | 'fluctuating';

// ---- 数字肢体语言信号 ----

/** DBL信号类别 */
export type DblSignalCategory =
  | 'profile_update'
  | 'activity_spike'
  | 'engagement_change'
  | 'social_signal'
  | 'content_interaction'
  | 'search_behavior'
  | 'application_pattern'
  | 'temporal_signal';

// ---- 会话相关 ----

/** 会话类型 */
export type SessionType = 'job_browse' | 'search' | 'application' | 'profile_edit' | 'ai_chat';

/** 会话结果 */
export type SessionOutcome = 'converted' | 'bounced' | 'explored' | 'abandoned';

// ============================================================
// 第二部分：接口定义
// ============================================================

/** 行为事件记录（v2 细粒度） */
export interface BehaviorEvent {
  id?: number;
  profileId: number;
  sessionId?: string;
  behaviorType: BehaviorTypeV2;
  behaviorCategory: BehaviorCategory;
  targetType?: TargetType;
  targetId?: number;
  targetTitle?: string;
  targetUrl?: string;
  referrer?: string;
  positionIndex?: number;
  listSource?: string;
  dwellTimeMs?: number;
  scrollDepth?: number;
  interactionIntensity: number;
  mouseMovements?: number;
  deviceType?: string;
  platform?: string;
  pageUrl?: string;
  queryParams?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

/** 用户会话 */
export interface UserSession {
  id?: number;
  profileId: number;
  sessionId: string;
  sessionType: SessionType;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  eventCount: number;
  searchQueryCount: number;
  jobViewCount: number;
  jobDetailViewCount: number;
  jobApplyCount: number;
  jobFavoriteCount: number;
  jobDismissCount: number;
  avgDwellTimeMs?: number;
  maxDwellTimeMs?: number;
  sessionOutcome?: SessionOutcome;
  endAction?: string;
}

/** 职业意向分类 */
export interface CareerIntentClassification {
  profileId: number;
  intentPrimary: CareerIntentPrimary;
  intentSecondary?: CareerIntentSecondary;
  intentStrength: number;       // 0.0 - 1.0
  confidence: number;           // 0.0 - 1.0
  signals: string[];            // 触发该意向的信号
  evidenceCount: number;
  intentSince?: Date;
  intentLastUpdate: Date;
  validFrom: Date;
  validUntil?: Date;
}

/** 用户生命周期阶段 */
export interface LifecycleStageRecord {
  profileId: number;
  stage: LifecycleStage;
  stageOrder: number;
  stageFeatures: Record<string, unknown>;
  stageMetrics: Record<string, unknown>;
  enteredAt: Date;
  exitedAt?: Date;
  durationDays?: number;
  entryTrigger?: string;
  exitTrigger?: string;
  predictedNextStage?: LifecycleStage;
  predictedTransitionDays?: number;
}

/** 活跃模式分类 */
export interface ActivityPattern {
  profileId: number;
  activeTimePattern: ActiveTimePattern;
  activeDaysPattern: ActiveDaysPattern;
  activityFrequency: ActivityFrequency;
  avgSessionPerWeek: number;
  engagementDepth: EngagementDepth;
  avgDwellTimeSeconds: number;
  avgInteractionIntensity: number;
  jobSearchStrategy: JobSearchStrategy;
  applicationConcentration: number;
  funnelPosition: FunnelPosition;
  confidence: number;
  patternFeatures: Record<string, unknown>;
  analysisWindowDays: number;
  calculatedAt: Date;
}

/** 紧迫度评分 */
export interface UrgencyScore {
  profileId: number;
  urgencyScore: number;       // 0.0 - 1.0
  urgencyLevel: UrgencyLevel;
  financialUrgency: number;
  careerTimingUrgency: number;
  noticePeriodUrgency: number;
  marketTimingUrgency: number;
  urgencySignals: string[];
  signalWeights: Record<string, number>;
  targetStartDate?: Date;
  urgencySince?: Date;
  expectedActionDate?: Date;
  predictedTransitionDate?: Date;
  predictionConfidence: number;
}

/** 偏好稳定性 */
export interface PreferenceStability {
  profileId: number;
  interestType: 'company' | 'position' | 'industry' | 'skill' | 'city';
  stabilityScore: number;     // 0.0 - 1.0
  stabilityCategory: StabilityCategory;
  driftDirection?: DriftDirection;
  driftSpeed: number;
  trend?: TrendDirection;
  trendStrength: number;
  changeHistory: Array<{ date: string; from: string; to: string }>;
  currentPeakValue?: string;
  currentPeakScore: number;
  observationStart?: Date;
  observationEnd?: Date;
  calculatedAt: Date;
}

/** 数字肢体语言信号 */
export interface DblSignal {
  profileId: number;
  signalCategory: DblSignalCategory;
  signalName: string;
  signalValue?: number;
  signalValueText?: string;
  signalValueBool?: boolean;
  signalStrength: number;     // 0 - 100
  signalFrequency: number;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
  activeDays?: number;
  deviationFromBaseline?: number;
  deviationFromPopulation?: number;
  predictivePower?: number;
  hazardRatio?: number;
  context: Record<string, unknown>;
  calculatedAt: Date;
}

/** 行为序列特征 */
export interface BehaviorSequenceFeatures {
  profileId: number;
  windowType: 'session' | 'daily' | 'weekly' | 'monthly';
  windowStart: Date;
  windowEnd: Date;
  // 计数特征
  viewCount: number;
  detailViewCount: number;
  searchCount: number;
  filterChangeCount: number;
  applyCount: number;
  applyStartCount: number;
  favoriteCount: number;
  unfavoriteCount: number;
  dismissCount: number;
  aiChatCount: number;
  profileViewCount: number;
  profileEditCount: number;
  // 比率特征
  browseToApplyRatio: number;
  browseToFavoriteRatio: number;
  searchToClickRatio: number;
  detailViewRate: number;
  // 时序特征
  morningActivityRatio: number;
  afternoonActivityRatio: number;
  eveningActivityRatio: number;
  lateNightActivityRatio: number;
  weekdayActivityRatio: number;
  weekendActivityRatio: number;
  activeHoursEntropy: number;
  activeDaysEntropy: number;
  // 深度特征
  avgDwellTimeMs: number;
  maxDwellTimeMs: number;
  medianDwellTimeMs: number;
  avgScrollDepth: number;
  avgInteractionIntensity: number;
  // 多样性特征
  uniqueCompaniesViewed: number;
  uniquePositionsViewed: number;
  uniqueCitiesExplored: number;
  uniqueIndustriesExplored: number;
  companiesConcentration: number;
  positionsConcentration: number;
  // 行为模式特征
  sessionCount: number;
  avgSessionLengthSeconds: number;
  avgEventsPerSession: number;
  sessionStartRate: number;
  // 行为转换概率
  viewToDetailProb: number;
  detailToApplyProb: number;
  browseToSearchProb: number;
  searchToApplyProb: number;
  favoriteToApplyProb: number;
  // 趋势特征
  viewTrend: number;
  applyTrend: number;
  favoriteTrend: number;
  engagementTrend: number;
  // 推荐质量
  recommendationCtr: number;
  recommendationConvertRate: number;
  searchResultCtr: number;
  // 聚合特征
  totalBehaviorScore: number;
  engagementLevel: 'low' | 'medium' | 'high' | 'very_high';
  activityLevel: 'low' | 'medium' | 'high' | 'very_high';
  mlFeatures: Record<string, number>;
  calculatedAt: Date;
}

/** 完整用户画像快照 */
export interface UserPersona {
  profileId: number;
  personaVersion: string;
  modelVersion?: string;
  // 核心标签
  primaryIntent?: CareerIntentPrimary;
  intentStrength: number;
  intentConfidence: number;
  lifecycleStage?: LifecycleStage;
  lifecycleDays: number;
  urgencyLevel?: UrgencyLevel;
  urgencyScore: number;
  engagementLevel: 'low' | 'medium' | 'high' | 'very_high';
  activityLevel: 'low' | 'medium' | 'high' | 'very_high';
  jobSeekingMaturity: 'beginner' | 'intermediate' | 'experienced' | 'expert';
  // 偏好维度
  topCompanies: Array<{ key: string; score: number; stability?: number }>;
  topPositions: Array<{ key: string; score: number; stability?: number }>;
  topCities: Array<{ key: string; score: number; stability?: number }>;
  topIndustries: Array<{ key: string; score: number; stability?: number }>;
  topSkills: Array<{ key: string; score: number; stability?: number }>;
  topDirections: Array<{ key: string; score: number; stability?: number }>;
  // 行为统计
  behaviorStats: Record<string, number>;
  // 序列特征摘要
  sequenceFeaturesSummary: Record<string, unknown>;
  // DBL信号摘要
  dblSignalsSummary: {
    topSignals: Array<{ name: string; category: string; strength: number }>;
    avgStrength: number;
  };
  // 偏好稳定性摘要
  stabilitySummary: {
    stableDims: string[];
    unstableDims: string[];
    evolvingDims: string[];
  };
  computedAt: Date;
  featuresTtlHours: number;
}

/** 兴趣评分（兼容旧接口） */
export interface InterestScore {
  interestType: 'company' | 'position' | 'industry' | 'skill' | 'city' | 'direction';
  interestKey: string;
  score: number;
  decayFactor: number;       // 衰减因子 v1.7 新增
  lastBehaviorAt: string | null;  // 最后行为时间 v1.7 新增
  behaviorCount: number;
  stability?: number;      // 稳定性评分 v1.6 新增
  driftDirection?: DriftDirection;  // 漂移方向 v1.6 新增
  trend?: TrendDirection;  // 趋势 v1.6 新增
}

// ============================================================
// 第三部分：行为采集（v2）
// ============================================================

/** 行为类别映射表 */
const BEHAVIOR_CATEGORY_MAP: Record<BehaviorTypeV2, BehaviorCategory> = {
  impression: 'exposure',
  recommendation_shown: 'exposure',
  search_result_shown: 'exposure',
  view: 'engagement',
  view_detail: 'engagement',
  view_company: 'engagement',
  view_JD: 'engagement',
  hover: 'engagement',
  scroll: 'engagement',
  search: 'engagement',
  filter_change: 'engagement',
  search_refine: 'engagement',
  click: 'action',
  apply: 'action',
  apply_start: 'action',
  favorite: 'action',
  unfavorite: 'action',
  share: 'action',
  save_draft: 'action',
  resume_download: 'action',
  resume_upload: 'action',
  dismiss: 'feedback',
  hide_company: 'feedback',
  report_spam: 'feedback',
  negative_feedback: 'feedback',
  ai_chat: 'action',
  ai_question: 'action',
  ai_recommendation: 'action',
  ai_profile_update: 'action',
  view_referral: 'social',
  use_referral: 'social',
  connect_recruiter: 'social',
  notification_open: 'notification',
  notification_click: 'notification',
  email_open: 'notification',
  email_click: 'notification',
  profile_view: 'profile',
  profile_edit: 'profile',
  resume_edit: 'profile',
  skill_add: 'profile',
  skill_remove: 'profile',
};

/**
 * 获取行为类型对应的类别
 */
export function getBehaviorCategory(type: BehaviorTypeV2): BehaviorCategory {
  return BEHAVIOR_CATEGORY_MAP[type] ?? 'engagement';
}

/**
 * 计算交互强度
 * 综合停留时长、滚动深度和行为类型
 */
function computeInteractionIntensity(
  behaviorType: BehaviorTypeV2,
  dwellTimeMs?: number,
  scrollDepth?: number
): number {
  // 行为类型权重
  const typeWeights: Record<string, number> = {
    apply: 1.00,
    apply_start: 0.70,
    ai_chat: 0.55,
    ai_question: 0.55,
    favorite: 0.60,
    view_JD: 0.50,
    view_detail: 0.40,
    view_company: 0.30,
    search: 0.35,
    dismiss: 0.20,
    filter_change: 0.25,
    search_refine: 0.25,
    view: 0.10,
    hover: 0.05,
    scroll: 0.05,
  };

  const typeScore = typeWeights[behaviorType] ?? 0.10;

  // 停留时长得分（基准：30秒=1分）
  const dwellScore = dwellTimeMs ? Math.min(1.0, dwellTimeMs / 30000) : 0;

  // 滚动深度得分
  const scrollScore = scrollDepth ?? 0;

  // 综合 = 类型*0.5 + 停留*0.3 + 滚动*0.2
  return Math.min(1.0, Math.max(0, typeScore * 0.5 + dwellScore * 0.3 + scrollScore * 0.2));
}

/**
 * 记录行为事件（v2 细粒度）
 */
export async function recordBehaviorEvent(event: BehaviorEvent): Promise<void> {
  const {
    profileId, sessionId, behaviorType, targetType, targetId, targetTitle,
    targetUrl, referrer, positionIndex, listSource, dwellTimeMs, scrollDepth,
    deviceType, platform, pageUrl, queryParams, metadata,
  } = event;

  const behaviorCategory = getBehaviorCategory(behaviorType);
  const interactionIntensity = computeInteractionIntensity(behaviorType, dwellTimeMs, scrollDepth);

  try {
    await execute(`
      INSERT INTO user_behavior_events (
        profile_id, session_id, behavior_type, behavior_category,
        target_type, target_id, target_title, target_url,
        referrer, position_index, list_source,
        dwell_time_ms, scroll_depth, interaction_intensity,
        device_type, platform, page_url, query_params, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    `, [
      profileId,
      sessionId ?? null,
      behaviorType,
      behaviorCategory,
      targetType ?? null,
      targetId ?? null,
      targetTitle ?? null,
      targetUrl ?? null,
      referrer ?? null,
      positionIndex ?? null,
      listSource ?? null,
      dwellTimeMs ?? null,
      scrollDepth ?? null,
      interactionIntensity,
      deviceType ?? null,
      platform ?? null,
      pageUrl ?? null,
      JSON.stringify(queryParams ?? {}),
      JSON.stringify(metadata ?? {}),
    ]);

    // 更新相关画像维度
    await updateProfileDimensions(event, interactionIntensity);

    // 更新会话统计（如有会话）
    if (sessionId) {
      await updateSessionStats(sessionId, behaviorType, dwellTimeMs);
    }

    // 触发数字肢体语言信号检测
    await detectDblSignals(profileId, behaviorType, behaviorCategory, metadata);

    log.debug({ profileId, behaviorType, behaviorCategory, interactionIntensity }, 'Behavior event recorded');
  } catch (err) {
    log.error({ err, event }, 'Failed to record behavior event');
  }
}

/**
 * 批量记录行为事件
 */
export async function recordBehaviorEvents(events: BehaviorEvent[]): Promise<void> {
  for (const event of events) {
    await recordBehaviorEvent(event);
  }
}

/**
 * 记录行为（兼容旧接口，自动转换为 v2）
 */
export async function recordBehavior(record: {
  profileId: number;
  behaviorType: string;
  targetType?: string;
  targetId?: number;
  targetTitle?: string;
  metadata?: Record<string, unknown>;
  dwellTimeMs?: number;
  scrollDepth?: number;
  referrer?: string;
  positionIndex?: number;
  listSource?: string;
  sessionId?: string;
}): Promise<void> {
  // 映射旧行为类型到新类型
  const typeMapping: Record<string, BehaviorTypeV2> = {
    view: 'view',
    search: 'search',
    apply: 'apply',
    favorite: 'favorite',
    click: 'click',
    ai_chat: 'ai_chat',
  };

  const behaviorType = typeMapping[record.behaviorType] ?? 'view';

  await recordBehaviorEvent({
    profileId: record.profileId,
    sessionId: record.sessionId,
    behaviorType,
    behaviorCategory: getBehaviorCategory(behaviorType),
    targetType: record.targetType as TargetType,
    targetId: record.targetId,
    targetTitle: record.targetTitle,
    referrer: record.referrer,
    positionIndex: record.positionIndex,
    listSource: record.listSource,
    dwellTimeMs: record.dwellTimeMs,
    scrollDepth: record.scrollDepth,
    interactionIntensity: 0.1,
    metadata: record.metadata,
  });
}

// ============================================================
// 第四部分：会话管理
// ============================================================

/**
 * 创建或获取当前会话
 */
export async function getOrCreateSession(
  profileId: number,
  sessionType: SessionType = 'job_browse'
): Promise<string> {
  const sessionId = `${profileId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await execute(`
    INSERT INTO user_sessions (profile_id, session_id, session_type, started_at, event_count)
    VALUES ($1, $2, $3, NOW(), 0)
    ON CONFLICT (profile_id, session_id) DO NOTHING
  `, [profileId, sessionId, sessionType]);

  return sessionId;
}

/**
 * 更新会话统计
 */
async function updateSessionStats(sessionId: string, behaviorType: BehaviorTypeV2, dwellTimeMs?: number): Promise<void> {
  let increment: Partial<Record<string, string>> = { event_count: '1' };

  switch (behaviorType) {
    case 'view':
      increment.job_view_count = '1';
      break;
    case 'view_detail':
    case 'view_JD':
      increment.job_view_count = '1';
      increment.job_detail_view_count = '1';
      break;
    case 'search':
      increment.search_query_count = '1';
      break;
    case 'apply':
      increment.job_apply_count = '1';
      break;
    case 'favorite':
      increment.job_favorite_count = '1';
      break;
    case 'dismiss':
    case 'negative_feedback':
    case 'hide_company':
      increment.job_dismiss_count = '1';
      break;
  }

  const sets = Object.entries(increment).map(([col, val]) => `${col} = ${col} + ${val}`).join(', ');

  await execute(`
    UPDATE user_sessions
    SET ${sets},
        avg_dwell_time_ms = CASE
          WHEN event_count = 0 THEN $2
          ELSE (avg_dwell_time_ms * event_count + $2) / (event_count + 1)
        END,
        max_dwell_time_ms = GREATEST(COALESCE(max_dwell_time_ms, 0), COALESCE($2, 0)),
        updated_at = NOW()
    WHERE session_id = $1
  `, [sessionId, dwellTimeMs ?? null]);
}

/**
 * 结束会话
 */
export async function endSession(
  sessionId: string,
  endAction?: string
): Promise<void> {
  const sessionRows = await query(`
    SELECT profile_id, started_at, event_count, job_view_count, job_detail_view_count,
           job_apply_count, job_favorite_count, job_dismiss_count, avg_dwell_time_ms
    FROM user_sessions WHERE session_id = $1
  `, [sessionId]);

  if (!sessionRows[0]) return;

  const s = sessionRows[0] as {
    started_at: Date;
    event_count: number;
    job_view_count: number;
    job_detail_view_count: number;
    job_apply_count: number;
    job_favorite_count: number;
    job_dismiss_count: number;
    avg_dwell_time_ms: number;
  };

  const now = new Date();
  const durationSeconds = Math.floor((now.getTime() - new Date(s.started_at).getTime()) / 1000);

  // 判定会话结果
  let outcome: SessionOutcome;
  if (s.job_apply_count > 0 || s.job_favorite_count > 0) {
    outcome = 'converted';
  } else if (s.job_view_count <= 2 && (s.avg_dwell_time_ms ?? 0) < 5000) {
    outcome = 'bounced';
  } else if (s.job_view_count > 5 && s.job_favorite_count === 0 && s.job_apply_count === 0) {
    outcome = 'explored';
  } else if (durationSeconds > 300 && s.job_favorite_count === 0 && s.job_apply_count === 0) {
    outcome = 'abandoned';
  } else {
    outcome = 'explored';
  }

  await execute(`
    UPDATE user_sessions SET
      ended_at = NOW(),
      duration_seconds = $2,
      session_outcome = $3,
      end_action = $4,
      updated_at = NOW()
    WHERE session_id = $1
  `, [sessionId, durationSeconds, outcome, endAction ?? null]);
}

// ============================================================
// 第五部分：画像维度更新
// ============================================================

/**
 * 更新用户画像维度（兴趣分数 + DBL信号 + 序列特征）
 */
async function updateProfileDimensions(event: BehaviorEvent, interactionIntensity: number): Promise<void> {
  const { profileId, behaviorType, targetType, targetId, targetTitle, dwellTimeMs, behaviorCategory } = event;

  // 1. 更新兴趣分数
  await updateInterestScoreV2(event, interactionIntensity);

  // 2. 记录基础兴趣分数（兼容旧接口）
  await updateLegacyInterestScore(event);

  // 3. 更新行为序列特征计数
  await incrementSequenceFeatureCount(profileId, behaviorType, dwellTimeMs);

  // 4. 更新职业意向信号
  await updateCareerIntentSignals(profileId, behaviorType, behaviorCategory);
}

/**
 * v2 兴趣分数更新（带稳定性追踪）
 */
async function updateInterestScoreV2(
  event: BehaviorEvent,
  interactionIntensity: number
): Promise<void> {
  const { profileId, behaviorType, targetType, targetId, targetTitle } = event;

  if (targetType !== 'job' || !targetId || !targetTitle) return;

  // 行为权重配置（比旧版更细致）
  const weights: Partial<Record<BehaviorTypeV2, number>> = {
    apply: 0.50, apply_start: 0.30, favorite: 0.20,
    view_JD: 0.12, view_detail: 0.08, view_company: 0.06,
    search: 0.08, search_refine: 0.05, filter_change: 0.03,
    view: 0.03, hover: 0.01, scroll: 0.01,
    dismiss: -0.15, negative_feedback: -0.20, hide_company: -0.10,
    ai_chat: 0.10, ai_question: 0.08, ai_recommendation: 0.12,
    ai_profile_update: 0.15,
    skill_add: 0.12, skill_remove: -0.08,
    profile_edit: 0.08, resume_edit: 0.08,
  };

  const weight = weights[behaviorType] ?? 0.02;

  try {
    // 获取职位信息
    const jobRows = await query(`
      SELECT j.city, c.name AS company_name, c.industry
      FROM jobs j
      JOIN companies c ON c.id = j.company_id
      WHERE j.id = $1
    `, [targetId]);

    if (!jobRows[0]) return;

    const { city, company_name, industry } = jobRows[0] as {
      city?: string;
      company_name?: string;
      industry?: string;
    };

    // 更新公司兴趣
    if (company_name) {
      await upsertInterestScoreV2(profileId, 'company', company_name, weight);
    }

    // 更新城市兴趣
    if (city) {
      await upsertInterestScoreV2(profileId, 'city', city, weight * 0.4);
    }

    // 更新行业兴趣
    if (industry) {
      await upsertInterestScoreV2(profileId, 'industry', industry, weight * 0.3);
    }

    // 更新职位方向
    await upsertInterestScoreV2(profileId, 'position', targetTitle, weight);

    // 更新技能标签
    const tagRows = await query(`
      SELECT t.label FROM job_tags jt
      JOIN tags t ON t.id = jt.tag_id
      WHERE jt.job_id = $1
    `, [targetId]);

    for (const tag of tagRows) {
      const label = (tag as { label: string }).label;
      await upsertInterestScoreV2(profileId, 'skill', label, weight * 0.25);
    }
  } catch (err) {
    log.error({ err, event }, 'Failed to update v2 interest score');
  }
}

/**
 * v2 UPSERT 兴趣分数（带稳定性计算）
 */
async function upsertInterestScoreV2(
  profileId: number,
  interestType: 'company' | 'position' | 'industry' | 'skill' | 'city' | 'direction',
  interestKey: string,
  delta: number
): Promise<void> {
  try {
    await execute(`
      INSERT INTO user_interest_scores (
        profile_id, interest_type, interest_key, score, behavior_count, last_behavior_at
      ) VALUES ($1, $2, $3, GREATEST(0, $4), 1, NOW())
      ON CONFLICT (profile_id, interest_type, interest_key)
      DO UPDATE SET
        score = GREATEST(0.0001, LEAST(1.0,
          CASE WHEN user_interest_scores.score + $4 > user_interest_scores.peak_score
               THEN user_interest_scores.score + $4
               ELSE user_interest_scores.peak_score * 0.9995 + $4 * 0.5
          END
        )),
        behavior_count = user_interest_scores.behavior_count + 1,
        last_behavior_at = NOW(),
        updated_at = NOW()
    `, [profileId, interestType, interestKey, delta]);
  } catch (err) {
    log.error({ err, profileId, interestType, interestKey }, 'Failed to upsert interest score v2');
  }
}

/**
 * 兼容旧接口的兴趣分数更新
 */
async function updateLegacyInterestScore(record: BehaviorEvent): Promise<void> {
  const { profileId, behaviorType, targetType, targetId, targetTitle } = record;

  const weights: Record<string, number> = {
    apply: 0.5, favorite: 0.2, ai_chat: 0.15,
    click: 0.1, search: 0.08, view: 0.05,
  };

  const weight = weights[behaviorType] ?? 0.05;

  if (targetType === 'job' && targetId && targetTitle) {
    const jobRows = await query(`
      SELECT j.city, c.name AS company_name, c.industry
      FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.id = $1
    `, [targetId]);

    if (jobRows[0]) {
      const { city, company_name, industry } = jobRows[0] as { city?: string; company_name?: string; industry?: string };
      if (company_name) {
        await execute(`SELECT upsert_legacy_interest($1, 'company', $2, $3)`, [profileId, company_name, weight]);
      }
      if (city) {
        await execute(`SELECT upsert_legacy_interest($1, 'city', $2, $3)`, [profileId, city, weight * 0.5]);
      }
      if (industry) {
        await execute(`SELECT upsert_legacy_interest($1, 'industry', $2, $3)`, [profileId, industry, weight * 0.3]);
      }
    }
  }
}

/**
 * 更新行为序列特征计数（增量更新）
 */
async function incrementSequenceFeatureCount(
  profileId: number,
  behaviorType: BehaviorTypeV2,
  dwellTimeMs?: number
): Promise<void> {
  // 计数字段映射
  const countFieldMap: Partial<Record<BehaviorTypeV2, string>> = {
    view: 'view_count',
    view_detail: 'detail_view_count',
    view_JD: 'detail_view_count',
    view_company: 'view_count',
    search: 'search_count',
    search_refine: 'search_count',
    filter_change: 'filter_change_count',
    apply: 'apply_count',
    apply_start: 'apply_start_count',
    favorite: 'favorite_count',
    unfavorite: 'unfavorite_count',
    dismiss: 'dismiss_count',
    negative_feedback: 'dismiss_count',
    hide_company: 'dismiss_count',
    ai_chat: 'ai_chat_count',
    ai_question: 'ai_chat_count',
    profile_view: 'profile_view_count',
    profile_edit: 'profile_edit_count',
    resume_edit: 'profile_edit_count',
    skill_add: 'profile_edit_count',
  };

  const field = countFieldMap[behaviorType];
  if (!field) return;

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setDate(windowEnd.getDate() + 1);

  try {
    await execute(`
      INSERT INTO behavior_sequence_features (
        profile_id, window_type, window_start, window_end, ${field}, avg_dwell_time_ms
      ) VALUES ($1, 'daily', $2, $3, 1, $4)
      ON CONFLICT (profile_id, window_type, window_start)
      DO UPDATE SET
        ${field} = behavior_sequence_features.${field} + 1,
        avg_dwell_time_ms = COALESCE(
          (behavior_sequence_features.avg_dwell_time_ms * behavior_sequence_features.view_count + $4)
          / (behavior_sequence_features.view_count + 1),
          $4
        )
    `, [profileId, windowStart, windowEnd, dwellTimeMs ?? 0]);
  } catch (err) {
    log.debug({ err, profileId, behaviorType }, 'Failed to increment sequence feature');
  }
}

/**
 * 更新职业意向信号
 */
async function updateCareerIntentSignals(
  profileId: number,
  behaviorType: BehaviorTypeV2,
  behaviorCategory: BehaviorCategory
): Promise<void> {
  // 关键行为信号
  const signalBehaviors: Partial<Record<BehaviorTypeV2, string>> = {
    apply: 'application_count',
    apply_start: 'application_started',
    favorite: 'favorites_added',
    dismiss: 'dismissals_count',
    negative_feedback: 'negative_feedback_count',
    profile_edit: 'profile_updates',
    resume_edit: 'resume_edits',
    skill_add: 'skills_added',
    skill_remove: 'skills_removed',
    ai_chat: 'ai_interactions',
    ai_profile_update: 'ai_profile_updates',
  };

  const signalName = signalBehaviors[behaviorType];
  if (!signalName) return;

  const signalCategoryMap: Record<string, DblSignalCategory> = {
    application_count: 'application_pattern',
    application_started: 'application_pattern',
    favorites_added: 'engagement_change',
    dismissals_count: 'engagement_change',
    negative_feedback_count: 'engagement_change',
    profile_updates: 'profile_update',
    resume_edits: 'profile_update',
    skills_added: 'profile_update',
    skills_removed: 'profile_update',
    ai_interactions: 'engagement_change',
    ai_profile_updates: 'profile_update',
  };

  const signalCategory = signalCategoryMap[signalName] ?? 'engagement_change';

  try {
    await execute(`
      INSERT INTO digital_body_language_signals (
        profile_id, signal_category, signal_name, signal_value, signal_strength,
        signal_frequency, first_seen_at, last_seen_at, calculated_at
      ) VALUES ($1, $2, $3, 1, 50, 1, NOW(), NOW(), NOW())
      ON CONFLICT (profile_id, signal_category, signal_name)
      DO UPDATE SET
        signal_value = digital_body_language_signals.signal_value + 1,
        signal_frequency = digital_body_language_signals.signal_frequency + 1,
        last_seen_at = NOW(),
        calculated_at = NOW()
    `, [profileId, signalCategory, signalName]);
  } catch (err) {
    log.debug({ err, profileId, signalName }, 'Failed to update DBL signal');
  }
}

/**
 * 检测数字肢体语言信号
 */
async function detectDblSignals(
  profileId: number,
  behaviorType: BehaviorTypeV2,
  behaviorCategory: BehaviorCategory,
  metadata?: Record<string, unknown>
): Promise<void> {
  // 时序检测：深夜活跃
  const hour = new Date().getHours();
  if (hour >= 22 || hour < 6) {
    try {
      await execute(`
        INSERT INTO digital_body_language_signals (
          profile_id, signal_category, signal_name, signal_value_text,
          signal_strength, signal_frequency, first_seen_at, last_seen_at, calculated_at
        ) VALUES ($1, 'temporal_signal', 'late_night_activity', $2, 40, 1, NOW(), NOW(), NOW())
        ON CONFLICT (profile_id, signal_category, signal_name)
        DO UPDATE SET
          signal_frequency = digital_body_language_signals.signal_frequency + 1,
          last_seen_at = NOW(),
          calculated_at = NOW()
      `, [profileId, `${hour}:00 active`]);
    } catch { /* ignore */ }
  }

  // 活跃激增检测（需要聚合计算，此处记录原始事件）
  if (behaviorCategory === 'action') {
    try {
      await execute(`
        INSERT INTO digital_body_language_signals (
          profile_id, signal_category, signal_name, signal_value,
          signal_strength, signal_frequency, first_seen_at, last_seen_at, calculated_at
        ) VALUES ($1, 'activity_spike', 'action_burst', 1, 30, 1, NOW(), NOW(), NOW())
        ON CONFLICT (profile_id, signal_category, signal_name)
        DO UPDATE SET
          signal_value = digital_body_language_signals.signal_value + 1,
          signal_frequency = digital_body_language_signals.signal_frequency + 1,
          last_seen_at = NOW(),
          calculated_at = NOW()
      `, [profileId]);
    } catch { /* ignore */ }
  }
}

// ============================================================
// 第六部分：用户画像分析
// ============================================================

/**
 * 获取用户完整画像
 */
export async function getUserPersona(profileId: number): Promise<UserPersona> {
  // 获取画像快照
  const snapshotRows = await query(`
    SELECT * FROM user_persona_summary WHERE profile_id = $1
  `, [profileId]);

  if (snapshotRows[0]) {
    return mapPersonaFromDb(snapshotRows[0]);
  }

  // 无快照，构建实时画像
  return await buildUserPersona(profileId);
}

/**
 * 从数据库映射用户画像
 */
function mapPersonaFromDb(row: unknown): UserPersona {
  const r = row as Record<string, unknown>;
  return {
    profileId: r.profile_id as number,
    personaVersion: r.persona_version as string,
    modelVersion: r.model_version as string | undefined,
    primaryIntent: r.primary_intent as CareerIntentPrimary | undefined,
    intentStrength: Number(r.intent_strength) || 0,
    intentConfidence: Number(r.intent_confidence) || 0,
    lifecycleStage: r.lifecycle_stage as LifecycleStage | undefined,
    lifecycleDays: Number(r.lifecycle_days) || 0,
    urgencyLevel: r.urgency_level as UrgencyLevel | undefined,
    urgencyScore: Number(r.urgency_score) || 0,
    engagementLevel: (r.engagement_level as string) as UserPersona['engagementLevel'],
    activityLevel: (r.activity_level as string) as UserPersona['activityLevel'],
    jobSeekingMaturity: (r.job_seeking_maturity as string) as UserPersona['jobSeekingMaturity'],
    topCompanies: JSON.parse((r.top_companies as string) || '[]'),
    topPositions: JSON.parse((r.top_positions as string) || '[]'),
    topCities: JSON.parse((r.top_cities as string) || '[]'),
    topIndustries: JSON.parse((r.top_industries as string) || '[]'),
    topSkills: JSON.parse((r.top_skills as string) || '[]'),
    topDirections: JSON.parse((r.top_directions as string) || '[]'),
    behaviorStats: JSON.parse((r.behavior_stats as string) || '{}'),
    sequenceFeaturesSummary: JSON.parse((r.sequence_features as string) || '{}'),
    dblSignalsSummary: JSON.parse((r.dbl_signals_summary as string) || '{}'),
    stabilitySummary: JSON.parse((r.stability_summary as string) || '{}'),
    computedAt: new Date(r.computed_at as string),
    featuresTtlHours: Number(r.features_ttl_hours) || 24,
  };
}

/**
 * 构建实时用户画像
 */
async function buildUserPersona(profileId: number): Promise<UserPersona> {
  // 并行获取各维度数据
  const [stats, topInterests, urgencyRows, lifecycleRows, sequenceRows, dblRows] = await Promise.all([
    getUserProfileStats(profileId),
    getTopInterests(profileId, 10),
    query(`SELECT * FROM job_urgency_score WHERE profile_id = $1`, [profileId]),
    query(`SELECT * FROM user_lifecycle_stage WHERE profile_id = $1 AND exited_at IS NULL ORDER BY entered_at DESC LIMIT 1`, [profileId]),
    query(`SELECT * FROM behavior_sequence_features WHERE profile_id = $1 AND window_type = 'daily' ORDER BY window_end DESC LIMIT 1`, [profileId]),
    query(`SELECT signal_category, signal_name, MAX(signal_strength) as max_strength, COUNT(*) as freq
           FROM digital_body_language_signals WHERE profile_id = $1
           GROUP BY signal_category, signal_name
           ORDER BY max_strength DESC LIMIT 10`, [profileId]),
  ]);

  // 推断主意向
  const primaryIntent = inferPrimaryIntent(stats, topInterests);
  const intentStrength = computeIntentStrength(stats, topInterests);

  // 推断生命周期阶段
  const lifecycleStage = inferLifecycleStage(stats, topInterests);

  // 推断紧迫度
  let urgencyLevel: UrgencyLevel = 'none';
  let urgencyScore = 0;
  if (urgencyRows[0]) {
    const u = urgencyRows[0] as { urgency_level: string; urgency_score: number };
    urgencyLevel = u.urgency_level as UrgencyLevel;
    urgencyScore = Number(u.urgency_score);
  }

  // 计算活跃度和互动深度
  const { engagementLevel, activityLevel } = computeEngagementActivityLevels(stats);

  // 获取 DBL 信号摘要
  const topDblSignals = (dblRows as Array<{
    signal_category: string;
    signal_name: string;
    max_strength: number;
    freq: number;
  }>).map(r => ({
    name: r.signal_name,
    category: r.signal_category,
    strength: Number(r.max_strength),
  }));

  const avgDblStrength = topDblSignals.length > 0
    ? topDblSignals.reduce((s, r) => s + r.strength, 0) / topDblSignals.length
    : 0;

  // 获取偏好稳定性
  const stabilityRows = await query(`
    SELECT interest_type, stability_category
    FROM preference_stability WHERE profile_id = $1
  `, [profileId]);

  const stableDims = (stabilityRows as Array<{ interest_type: string; stability_category: string }>)
    .filter(r => r.stability_category === 'highly_stable' || r.stability_category === 'stable')
    .map(r => r.interest_type);

  const unstableDims = (stabilityRows as Array<{ interest_type: string; stability_category: string }>)
    .filter(r => r.stability_category === 'unstable')
    .map(r => r.interest_type);

  const evolvingDims = (stabilityRows as Array<{ interest_type: string; stability_category: string }>)
    .filter(r => r.stability_category === 'evolving')
    .map(r => r.interest_type);

  return {
    profileId,
    personaVersion: 'v1.6',
    intentStrength,
    intentConfidence: computeIntentConfidence(stats, topInterests),
    primaryIntent,
    lifecycleStage,
    lifecycleDays: stats.totalBehaviors > 0 ? 1 : 0,
    urgencyLevel,
    urgencyScore,
    engagementLevel,
    activityLevel,
    jobSeekingMaturity: inferMaturity(stats),
    topCompanies: topInterests.companies.slice(0, 5).map(c => ({
      key: c.interestKey,
      score: c.score,
    })),
    topPositions: topInterests.positions.slice(0, 5).map(p => ({
      key: p.interestKey,
      score: p.score,
    })),
    topCities: topInterests.cities.slice(0, 5).map(c => ({
      key: c.interestKey,
      score: c.score,
    })),
    topIndustries: topInterests.industries.slice(0, 5).map(i => ({
      key: i.interestKey,
      score: i.score,
    })),
    topSkills: topInterests.skills.slice(0, 5).map(s => ({
      key: s.interestKey,
      score: s.score,
    })),
    topDirections: [],
    behaviorStats: {
      totalBehaviors: stats.totalBehaviors,
      viewCount: stats.viewCount,
      searchCount: stats.searchCount,
      applyCount: stats.applyCount,
      favoriteCount: stats.favoriteCount,
      aiInteractionCount: stats.aiInteractionCount,
    },
    sequenceFeaturesSummary: sequenceRows[0] ? JSON.parse(JSON.stringify(sequenceRows[0])) : {},
    dblSignalsSummary: {
      topSignals: topDblSignals,
      avgStrength: avgDblStrength,
    },
    stabilitySummary: {
      stableDims,
      unstableDims,
      evolvingDims,
    },
    computedAt: new Date(),
    featuresTtlHours: 24,
  };
}

/**
 * 推断主职业意向
 */
function inferPrimaryIntent(
  stats: Awaited<ReturnType<typeof getUserProfileStats>>,
  interests: Awaited<ReturnType<typeof getTopInterests>>
): CareerIntentPrimary {
  const { applyCount, favoriteCount, searchCount, viewCount, aiInteractionCount } = stats;

  // 高投递 + 高收藏 = 主动求职者
  if (applyCount >= 3) {
    return 'active_job_seeker';
  }

  // 高搜索 + 低投递 + 低收藏 = 探索型
  if (searchCount >= 5 && applyCount === 0 && favoriteCount <= 2) {
    return 'exploratory';
  }

  // 高浏览 + 高收藏 + 低投递 = 被动型人才
  if (viewCount >= 10 && favoriteCount >= 3 && applyCount <= 1) {
    return 'passive_talent';
  }

  // AI 交互频繁 = 市场调研/信息收集
  if (aiInteractionCount >= 5) {
    return 'information_gathering';
  }

  // 默认：被动浏览
  return 'passive_browsing';
}

/**
 * 计算意向强度（0-1）
 */
function computeIntentStrength(
  stats: Awaited<ReturnType<typeof getUserProfileStats>>,
  interests: Awaited<ReturnType<typeof getTopInterests>>
): number {
  const { applyCount, favoriteCount, searchCount, viewCount } = stats;

  // 加权得分
  const applyScore = Math.min(1.0, applyCount * 0.3);
  const favoriteScore = Math.min(0.5, favoriteCount * 0.15);
  const searchScore = Math.min(0.3, searchCount * 0.05);
  const viewScore = Math.min(0.2, viewCount * 0.01);

  // 兴趣集中度加成
  const totalInterestScore = [
    ...interests.companies,
    ...interests.positions,
    ...interests.skills,
  ].reduce((sum, i) => sum + i.score, 0);

  const interestBonus = Math.min(0.3, totalInterestScore * 0.05);

  return Math.min(1.0, applyScore + favoriteScore + searchScore + viewScore + interestBonus);
}

/**
 * 计算意向置信度（0-1）
 */
function computeIntentConfidence(
  stats: Awaited<ReturnType<typeof getUserProfileStats>>,
  interests: Awaited<ReturnType<typeof getTopInterests>>
): number {
  const totalBehaviors = stats.totalBehaviors;
  const totalInterestCount = [
    ...interests.companies,
    ...interests.positions,
    ...interests.industries,
    ...interests.skills,
    ...interests.cities,
  ].length;

  // 行为数量置信度
  const behaviorConfidence = Math.min(1.0, totalBehaviors / 50);

  // 兴趣覆盖度置信度
  const interestConfidence = Math.min(1.0, totalInterestCount / 10);

  return (behaviorConfidence * 0.6 + interestConfidence * 0.4);
}

/**
 * 推断生命周期阶段
 */
function inferLifecycleStage(
  stats: Awaited<ReturnType<typeof getUserProfileStats>>,
  interests: Awaited<ReturnType<typeof getTopInterests>>
): LifecycleStage {
  const { applyCount, favoriteCount, totalBehaviors, active7d } = stats;

  if (totalBehaviors === 0) return 'cold_start';

  if (active7d === 0 && totalBehaviors > 0) return 'dormant';

  if (applyCount >= 5) return 'application_tracking';
  if (applyCount >= 1) return 'active_application';
  if (favoriteCount >= 3) return 'intent_formation';
  if (totalBehaviors >= 5) return 'active_browsing';

  return 'early_exploration';
}

/**
 * 计算活跃度和互动深度等级
 */
function computeEngagementActivityLevels(stats: Awaited<ReturnType<typeof getUserProfileStats>>): {
  engagementLevel: UserPersona['engagementLevel'];
  activityLevel: UserPersona['activityLevel'];
} {
  const { viewCount, applyCount, favoriteCount, searchCount, aiInteractionCount } = stats;

  // 活跃度 = 总行为数
  const activityScore = viewCount + searchCount * 2 + favoriteCount * 3 + applyCount * 5;
  let activityLevel: UserPersona['activityLevel'] = 'low';
  if (activityScore >= 100) activityLevel = 'very_high';
  else if (activityScore >= 30) activityLevel = 'high';
  else if (activityScore >= 10) activityLevel = 'medium';

  // 互动深度 = 收藏/投递相对于浏览的比率
  const engagementScore = favoriteCount * 2 + applyCount * 5 + aiInteractionCount;
  let engagementLevel: UserPersona['engagementLevel'] = 'low';
  if (engagementScore >= 20) engagementLevel = 'very_high';
  else if (engagementScore >= 8) engagementLevel = 'high';
  else if (engagementScore >= 3) engagementLevel = 'medium';

  return { engagementLevel, activityLevel };
}

/**
 * 推断求职成熟度
 */
function inferMaturity(stats: Awaited<ReturnType<typeof getUserProfileStats>>): UserPersona['jobSeekingMaturity'] {
  const { applyCount, favoriteCount, searchCount, aiInteractionCount } = stats;
  const total = applyCount + favoriteCount + searchCount + aiInteractionCount;

  if (total >= 50) return 'expert';
  if (total >= 15) return 'experienced';
  if (total >= 3) return 'intermediate';
  return 'beginner';
}

// ============================================================
// 第七部分：兼容旧接口
// ============================================================

/**
 * 获取用户行为历史（兼容旧接口）
 */
export async function getUserBehaviors(
  profileId: number,
  options: {
    type?: string;
    limit?: number;
    since?: Date;
  } = {}
): Promise<unknown[]> {
  const { type, limit = 50, since } = options;

  const conditions: string[] = ['profile_id = $1'];
  const params: unknown[] = [profileId];
  let paramIdx = 2;

  if (type) {
    conditions.push(`behavior_type = $${paramIdx}`);
    params.push(type);
    paramIdx++;
  }

  if (since) {
    conditions.push(`created_at >= $${paramIdx}`);
    params.push(since);
    paramIdx++;
  }

  return query(`
    SELECT * FROM user_behavior_events
    WHERE ${conditions.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT $${paramIdx}
  `, [...params, limit]);
}

/**
 * 获取用户兴趣标签（兼容旧接口 + 增强字段）
 */
export async function getUserInterests(
  profileId: number,
  options: {
    type?: InterestScore['interestType'];
    minScore?: number;
    limit?: number;
  } = {}
): Promise<InterestScore[]> {
  const { type, minScore = 0, limit = 50 } = options;

  const conditions: string[] = ['profile_id = $1', 'score >= $2'];
  const params: unknown[] = [profileId, minScore];
  let paramIdx = 3;

  if (type) {
    conditions.push(`interest_type = $${paramIdx}`);
    params.push(type);
    paramIdx++;
  }

  const rows = await query(`
    SELECT interest_type, interest_key, score, behavior_count,
           decay_factor, peak_score, last_behavior_at
    FROM user_interest_scores
    WHERE ${conditions.join(' AND ')}
    ORDER BY score DESC
    LIMIT $${paramIdx}
  `, [...params, limit]);

  return (rows as Array<{
    interest_type: string;
    interest_key: string;
    score: number;
    behavior_count: number;
    decay_factor?: number;
    peak_score?: number;
    last_behavior_at?: string;
  }>).map(r => ({
    interestType: r.interest_type as InterestScore['interestType'],
    interestKey: r.interest_key,
    score: Number(r.score),
    decayFactor: r.decay_factor ?? 1,
    lastBehaviorAt: r.last_behavior_at ?? null,
    behaviorCount: Number(r.behavior_count),
  }));
}

/**
 * 获取用户 Top N 兴趣（兼容旧接口）
 */
export async function getTopInterests(
  profileId: number,
  n: number = 10
): Promise<{
  companies: InterestScore[];
  positions: InterestScore[];
  cities: InterestScore[];
  industries: InterestScore[];
  skills: InterestScore[];
  directions: InterestScore[];
}> {
  const interests = await getUserInterests(profileId, { limit: n * 5 });

  const grouped = {
    companies: interests.filter((i) => i.interestType === 'company').slice(0, n),
    positions: interests.filter((i) => i.interestType === 'position').slice(0, n),
    cities: interests.filter((i) => i.interestType === 'city').slice(0, n),
    industries: interests.filter((i) => i.interestType === 'industry').slice(0, n),
    skills: interests.filter((i) => i.interestType === 'skill').slice(0, n),
    directions: interests.filter((i) => i.interestType === 'direction').slice(0, n),
  };

  return grouped;
}

/**
 * 获取用户画像统计（兼容旧接口）
 */
export async function getUserProfileStats(profileId: number): Promise<{
  totalBehaviors: number;
  viewCount: number;
  searchCount: number;
  favoriteCount: number;
  applyCount: number;
  searchHistoryCount: number;
  aiInteractionCount: number;
  interestCount: number;
  active7d: number;
  topInterests: Awaited<ReturnType<typeof getTopInterests>>;
}> {
  const statsRows = await query(`
    SELECT
      COALESCE((SELECT COUNT(*) FROM user_behavior_events WHERE profile_id = $1), 0) AS total_behaviors,
      COALESCE((SELECT COUNT(*) FROM user_behavior_events WHERE profile_id = $1 AND behavior_type = 'view'), 0) AS view_count,
      COALESCE((SELECT COUNT(*) FROM user_behavior_events WHERE profile_id = $1 AND behavior_type = 'search'), 0) AS search_count,
      COALESCE((SELECT COUNT(*) FROM user_behavior_events WHERE profile_id = $1 AND behavior_type = 'favorite'), 0) AS favorite_count,
      COALESCE((SELECT COUNT(*) FROM user_behavior_events WHERE profile_id = $1 AND behavior_type = 'apply'), 0) AS apply_count,
      COALESCE((SELECT COUNT(*) FROM user_behavior_events WHERE profile_id = $1 AND behavior_type = 'ai_chat'), 0) AS ai_interaction_count,
      COALESCE((SELECT COUNT(*) FROM user_behavior_events WHERE profile_id = $1 AND created_at > NOW() - INTERVAL '7 days'), 0) AS active_7d
  `, [profileId]);

  const searchHistoryCount = await query<{ count: string }>(`
    SELECT COUNT(*) FROM search_history WHERE profile_id = $1
  `, [profileId]);

  const interestCount = await query<{ count: string }>(`
    SELECT COUNT(*) FROM user_interest_scores WHERE profile_id = $1
  `, [profileId]);

  const r = statsRows[0] as {
    total_behaviors: number;
    view_count: number;
    search_count: number;
    favorite_count: number;
    apply_count: number;
    ai_interaction_count: number;
    active_7d: number;
  };

  return {
    totalBehaviors: Number(r.total_behaviors),
    viewCount: Number(r.view_count),
    searchCount: Number(r.search_count),
    favoriteCount: Number(r.favorite_count),
    applyCount: Number(r.apply_count),
    searchHistoryCount: Number(searchHistoryCount[0]?.count ?? 0),
    aiInteractionCount: Number(r.ai_interaction_count),
    interestCount: Number(interestCount[0]?.count ?? 0),
    active7d: Number(r.active_7d),
    topInterests: await getTopInterests(profileId),
  };
}

/**
 * 计算用户活跃度得分（兼容旧接口）
 */
export async function calculateActivityScore(profileId: number): Promise<number> {
  const stats = await getUserProfileStats(profileId);

  const weights = {
    apply: 5,
    favorite: 3,
    search: 2,
    view: 1,
  };

  const weightedBehaviors =
    stats.applyCount * weights.apply +
    stats.favoriteCount * weights.favorite +
    stats.searchCount * weights.search +
    stats.viewCount * weights.view;

  const activeBonus = stats.active7d > 0 ? Math.min(stats.active7d * 2, 20) : 0;

  return Math.min(100, Math.round(Math.log1p(weightedBehaviors) * 15 + activeBonus));
}

/**
 * 获取相似用户（兼容旧接口）
 */
export async function findSimilarUsers(
  profileId: number,
  limit: number = 10
): Promise<number[]> {
  const userInterests = await query(`
    SELECT interest_type, interest_key
    FROM user_interest_scores
    WHERE profile_id = $1 AND score >= 0.3
  `, [profileId]);

  if (userInterests.length === 0) return [];

  const similarProfiles = await query(`
    SELECT uis.profile_id,
           SUM(uis.score * (
             SELECT MAXuis.score FROM user_interest_scores MAXuis
             WHERE MAXuis.profile_id = $1
               AND MAXuis.interest_type = uis.interest_type
               AND MAXuis.interest_key = uis.interest_key
           )) AS similarity
    FROM user_interest_scores uis
    WHERE uis.profile_id <> $1
      AND EXISTS (
        SELECT 1 FROM user_interest_scores myuis
        WHERE myuis.profile_id = $1
          AND myuis.interest_type = uis.interest_type
          AND myuis.interest_key = uis.interest_key
          AND myuis.score >= 0.3
      )
    GROUP BY uis.profile_id
    ORDER BY similarity DESC
    LIMIT $2
  `, [profileId, limit]);

  return similarProfiles.map((row) => (row as { profile_id: number }).profile_id);
}

// ============================================================
// 第八部分：搜索历史（兼容旧接口）
// ============================================================

export async function recordSearch(
  profileId: number,
  searchQuery: string,
  searchType: 'jobs' | 'companies' | 'all',
  resultCount: number
): Promise<void> {
  try {
    await execute(`
      INSERT INTO search_history (profile_id, search_query, search_type, result_count)
      VALUES ($1, $2, $3, $4)
    `, [profileId, searchQuery, searchType, resultCount]);

    // 同时记录行为事件
    await recordBehaviorEvent({
      profileId,
      behaviorType: 'search',
      behaviorCategory: 'engagement',
      targetType: 'search',
      targetTitle: searchQuery,
      interactionIntensity: 0.1,
      metadata: { searchType, resultCount },
    });
  } catch (err) {
    log.error({ err, profileId, searchQuery }, 'Failed to record search');
  }
}

export async function getSearchHistory(
  profileId: number,
  limit: number = 20
): Promise<{ query: string; type: string; count: number; timestamp: Date }[]> {
  const rows = await query(`
    SELECT search_query, search_type, result_count, MAX(created_at) AS timestamp
    FROM search_history
    WHERE profile_id = $1
    GROUP BY search_query, search_type, result_count
    ORDER BY timestamp DESC
    LIMIT $2
  `, [profileId, limit]);

  return rows.map((row) => {
    const r = row as { search_query: string; search_type: string; result_count: number; timestamp: Date };
    return {
      query: r.search_query,
      type: r.search_type,
      count: r.result_count,
      timestamp: r.timestamp,
    };
  });
}

export async function clearSearchHistory(profileId: number): Promise<void> {
  await execute('DELETE FROM search_history WHERE profile_id = $1', [profileId]);
}

// ============================================================
// 第九部分：职业意向分类（新增）
// ============================================================

/**
 * 获取用户当前职业意向
 */
export async function getCareerIntent(profileId: number): Promise<CareerIntentClassification | null> {
  const rows = await query(`
    SELECT * FROM career_intent_classification
    WHERE profile_id = $1
      AND (valid_until IS NULL OR valid_until > NOW())
    ORDER BY intent_strength DESC
    LIMIT 1
  `, [profileId]);

  if (!rows[0]) return null;

  const r = rows[0] as Record<string, unknown>;
  return {
    profileId: r.profile_id as number,
    intentPrimary: r.intent_primary as CareerIntentPrimary,
    intentSecondary: r.intent_secondary as CareerIntentSecondary | undefined,
    intentStrength: Number(r.intent_strength),
    confidence: Number(r.confidence),
    signals: JSON.parse((r.signals as string) || '[]'),
    evidenceCount: Number(r.evidence_count),
    intentSince: r.intent_since ? new Date(r.intent_since as string) : undefined,
    intentLastUpdate: new Date(r.intent_last_update as string),
    validFrom: new Date(r.valid_from as string),
    validUntil: r.valid_until ? new Date(r.valid_until as string) : undefined,
  };
}

/**
 * 更新用户职业意向
 */
export async function updateCareerIntent(
  profileId: number,
  classification: Partial<CareerIntentClassification>
): Promise<void> {
  const {
    intentPrimary,
    intentSecondary,
    intentStrength,
    confidence,
    signals = [],
    evidenceCount = 1,
  } = classification;

  try {
    await execute(`
      INSERT INTO career_intent_classification (
        profile_id, intent_primary, intent_secondary,
        intent_strength, confidence, signals, evidence_count,
        intent_since, intent_last_update, valid_from
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW())
      ON CONFLICT (profile_id, intent_primary)
      DO UPDATE SET
        intent_secondary = COALESCE($3, career_intent_classification.intent_secondary),
        intent_strength = $4,
        confidence = $5,
        signals = $6,
        evidence_count = career_intent_classification.evidence_count + $7,
        intent_last_update = NOW(),
        updated_at = NOW()
    `, [
      profileId,
      intentPrimary,
      intentSecondary ?? null,
      intentStrength,
      confidence,
      JSON.stringify(signals),
      evidenceCount,
    ]);
  } catch (err) {
    log.error({ err, profileId, classification }, 'Failed to update career intent');
  }
}

// ============================================================
// 第十部分：生命周期阶段（新增）
// ============================================================

/**
 * 获取用户当前生命周期阶段
 */
export async function getCurrentLifecycleStage(profileId: number): Promise<LifecycleStageRecord | null> {
  const rows = await query(`
    SELECT * FROM user_lifecycle_stage
    WHERE profile_id = $1 AND exited_at IS NULL
    ORDER BY entered_at DESC
    LIMIT 1
  `, [profileId]);

  if (!rows[0]) return null;

  const r = rows[0] as Record<string, unknown>;
  return {
    profileId: r.profile_id as number,
    stage: r.stage as LifecycleStage,
    stageOrder: Number(r.stage_order),
    stageFeatures: JSON.parse((r.stage_features as string) || '{}'),
    stageMetrics: JSON.parse((r.stage_metrics as string) || '{}'),
    enteredAt: new Date(r.entered_at as string),
    exitedAt: r.exited_at ? new Date(r.exited_at as string) : undefined,
    durationDays: r.duration_days ? Number(r.duration_days) : undefined,
    entryTrigger: r.entry_trigger as string | undefined,
    exitTrigger: r.exit_trigger as string | undefined,
    predictedNextStage: r.predicted_next_stage as LifecycleStage | undefined,
    predictedTransitionDays: r.predicted_transition_days ? Number(r.predicted_transition_days) : undefined,
  };
}

/**
 * 推进生命周期阶段
 */
export async function advanceLifecycleStage(
  profileId: number,
  newStage: LifecycleStage,
  exitTrigger?: string,
  stageFeatures?: Record<string, unknown>
): Promise<void> {
  const stageOrderMap: Record<LifecycleStage, number> = {
    onboarding: 0, cold_start: 1, profile_setup: 2, early_exploration: 3,
    active_browsing: 4, intent_formation: 5, active_application: 6,
    application_tracking: 7, offer_evaluation: 8, hired_success: 9,
    dormant: 10, churned: 11,
  };

  const currentStage = await getCurrentLifecycleStage(profileId);

  // 退出当前阶段
  if (currentStage) {
    await execute(`
      UPDATE user_lifecycle_stage SET
        exited_at = NOW(),
        duration_days = EXTRACT(EPOCH FROM (NOW() - entered_at)) / 86400,
        exit_trigger = $2
      WHERE id = (SELECT id FROM user_lifecycle_stage
                  WHERE profile_id = $1 AND exited_at IS NULL
                  ORDER BY entered_at DESC LIMIT 1)
    `, [profileId, exitTrigger ?? null]);
  }

  // 进入新阶段
  await execute(`
    INSERT INTO user_lifecycle_stage (
      profile_id, stage, stage_order, entered_at, stage_features, entry_trigger
    ) VALUES ($1, $2, $3, NOW(), $4, $5)
  `, [
    profileId,
    newStage,
    stageOrderMap[newStage],
    JSON.stringify(stageFeatures ?? {}),
    exitTrigger ?? null,
  ]);
}

// ============================================================
// 第十一部分：紧迫度评估（新增）
// ============================================================

/**
 * 获取用户紧迫度评分
 */
export async function getUrgencyScore(profileId: number): Promise<UrgencyScore | null> {
  const rows = await query(`
    SELECT * FROM job_urgency_score WHERE profile_id = $1
  `, [profileId]);

  if (!rows[0]) return null;

  const r = rows[0] as Record<string, unknown>;
  return {
    profileId: r.profile_id as number,
    urgencyScore: Number(r.urgency_score),
    urgencyLevel: r.urgency_level as UrgencyLevel,
    financialUrgency: Number(r.financial_urgency),
    careerTimingUrgency: Number(r.career_timing_urgency),
    noticePeriodUrgency: Number(r.notice_period_urgency),
    marketTimingUrgency: Number(r.market_timing_urgency),
    urgencySignals: JSON.parse((r.urgency_signals as string) || '[]'),
    signalWeights: JSON.parse((r.signal_weights as string) || '{}'),
    targetStartDate: r.target_start_date ? new Date(r.target_start_date as string) : undefined,
    urgencySince: r.urgency_since ? new Date(r.urgency_since as string) : undefined,
    expectedActionDate: r.expected_action_date ? new Date(r.expected_action_date as string) : undefined,
    predictedTransitionDate: r.predicted_transition_date ? new Date(r.predicted_transition_date as string) : undefined,
    predictionConfidence: Number(r.prediction_confidence),
  };
}

/**
 * 计算并更新紧迫度评分
 */
export async function calculateAndUpdateUrgencyScore(profileId: number): Promise<UrgencyScore> {
  // 获取行为统计
  const stats = await getUserProfileStats(profileId);

  // 计算各维度紧迫度
  const { applyCount, viewCount, active7d } = stats;

  // 投递紧迫度：投递频率高 = 紧迫
  const applyUrgency = Math.min(1.0, applyCount / 20);

  // 活跃紧迫度：近期活跃度高 = 紧迫
  const activityUrgency = Math.min(1.0, active7d / 14);

  // 浏览紧迫度：浏览但少投递 = 中等紧迫
  const browseUrgency = viewCount > 0 && applyCount === 0
    ? Math.min(0.5, viewCount / 30)
    : 0;

  // 综合紧迫度
  const urgencyScore = Math.min(1.0, applyUrgency * 0.5 + activityUrgency * 0.3 + browseUrgency * 0.2);

  // 紧迫度等级
  let urgencyLevel: UrgencyLevel = 'none';
  if (urgencyScore >= 0.75) urgencyLevel = 'critical';
  else if (urgencyScore >= 0.5) urgencyLevel = 'high';
  else if (urgencyScore >= 0.25) urgencyLevel = 'medium';
  else if (urgencyScore >= 0.05) urgencyLevel = 'low';

  // 生成紧迫度信号
  const signals: string[] = [];
  if (applyCount >= 5) signals.push('high_application_frequency');
  if (active7d >= 7) signals.push('consecutive_daily_active');
  if (viewCount >= 20 && applyCount === 0) signals.push('high_browse_no_apply');

  await execute(`
    INSERT INTO job_urgency_score (
      profile_id, urgency_score, urgency_level,
      financial_urgency, career_timing_urgency,
      notice_period_urgency, market_timing_urgency,
      urgency_signals, calculated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (profile_id)
    DO UPDATE SET
      urgency_score = $2,
      urgency_level = $3,
      financial_urgency = $4,
      career_timing_urgency = $5,
      urgency_since = CASE
        WHEN job_urgency_score.urgency_level = 'none' AND $3 != 'none' THEN NOW()
        ELSE job_urgency_score.urgency_since
      END,
      updated_at = NOW()
  `, [
    profileId,
    urgencyScore,
    urgencyLevel,
    applyUrgency,       // financial
    activityUrgency,    // career timing
    0,                  // notice period
    browseUrgency,      // market timing
    JSON.stringify(signals),
  ]);

  return {
    profileId,
    urgencyScore,
    urgencyLevel,
    financialUrgency: applyUrgency,
    careerTimingUrgency: activityUrgency,
    noticePeriodUrgency: 0,
    marketTimingUrgency: browseUrgency,
    urgencySignals: signals,
    signalWeights: {},
    urgencySince: urgencyLevel !== 'none' ? new Date() : undefined,
    predictionConfidence: 0.5,
  };
}

// ============================================================
// 第十二部分：偏好稳定性（新增）
// ============================================================

/**
 * 计算兴趣维度稳定性
 */
export async function calculatePreferenceStability(
  profileId: number,
  interestType: 'company' | 'position' | 'industry' | 'skill' | 'city'
): Promise<PreferenceStability> {
  // 获取该维度的历史兴趣变化
  const historyRows = await query(`
    SELECT interest_key, score, behavior_count, updated_at
    FROM user_interest_scores
    WHERE profile_id = $1 AND interest_type = $2
    ORDER BY updated_at DESC
    LIMIT 20
  `, [profileId, interestType]);

  if (historyRows.length < 2) {
    return {
      profileId,
      interestType,
      stabilityScore: 0.5,
      stabilityCategory: 'evolving',
      driftSpeed: 0,
      trendStrength: 0,
      changeHistory: [],
      currentPeakScore: 0,
      calculatedAt: new Date(),
    };
  }

  const items = historyRows as Array<{
    interest_key: string;
    score: number;
    behavior_count: number;
    updated_at: Date;
  }>;

  // 计算当前峰值
  const currentPeak = items[0];
  const currentPeakScore = Number(currentPeak.score);
  const currentPeakValue = currentPeak.interest_key;

  // 计算历史得分变化的标准差（稳定性）
  const scores = items.map(i => Number(i.score));
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // 稳定性得分（标准差越小越稳定）
  const stabilityScore = Math.max(0, 1 - stdDev * 5);

  // 稳定性分类
  let stabilityCategory: StabilityCategory;
  if (stabilityScore >= 0.8) stabilityCategory = 'highly_stable';
  else if (stabilityScore >= 0.5) stabilityCategory = 'stable';
  else if (stabilityScore >= 0.2) stabilityCategory = 'evolving';
  else stabilityCategory = 'unstable';

  // 计算漂移方向（兴趣项是否在变化）
  const uniqueKeys = new Set(items.map(i => i.interest_key));
  const driftDirection: DriftDirection = uniqueKeys.size === 1
    ? 'stable'
    : uniqueKeys.size <= 2 ? 'converging'
    : 'diverging';

  // 趋势（最近是否在增加）
  const recentScores = scores.slice(0, Math.ceil(scores.length / 2));
  const olderScores = scores.slice(Math.floor(scores.length / 2));
  const recentMean = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
  const olderMean = olderScores.reduce((a, b) => a + b, 0) / olderScores.length;
  const trend: TrendDirection = recentMean > olderMean * 1.1 ? 'increasing'
    : recentMean < olderMean * 0.9 ? 'decreasing'
    : 'stable';

  const trendStrength = Math.abs(recentMean - olderMean) / mean;

  // 记录变化历史
  const changeHistory: Array<{ date: string; from: string; to: string }> = [];
  for (let i = 0; i < Math.min(5, items.length - 1); i++) {
    if (items[i].interest_key !== items[i + 1].interest_key) {
      changeHistory.push({
        date: items[i + 1].updated_at.toISOString(),
        from: items[i + 1].interest_key,
        to: items[i].interest_key,
      });
    }
  }

  try {
    await execute(`
      INSERT INTO preference_stability (
        profile_id, interest_type, stability_score, stability_category,
        drift_direction, drift_speed, trend, trend_strength,
        change_history, current_peak_value, current_peak_score, calculated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (profile_id, interest_type)
      DO UPDATE SET
        stability_score = $3,
        stability_category = $4,
        drift_direction = COALESCE($5, preference_stability.drift_direction),
        drift_speed = $6,
        trend = COALESCE($7, preference_stability.trend),
        trend_strength = $8,
        change_history = $9,
        current_peak_value = COALESCE($10, preference_stability.current_peak_value),
        current_peak_score = $11,
        updated_at = NOW()
    `, [
      profileId,
      interestType,
      stabilityScore,
      stabilityCategory,
      driftDirection,
      Math.abs(recentMean - olderMean) * 100,
      trend,
      trendStrength,
      JSON.stringify(changeHistory),
      currentPeakValue,
      currentPeakScore,
    ]);
  } catch (err) {
    log.debug({ err, profileId, interestType }, 'Failed to calculate stability');
  }

  return {
    profileId,
    interestType,
    stabilityScore,
    stabilityCategory,
    driftDirection,
    driftSpeed: Math.abs(recentMean - olderMean) * 100,
    trend,
    trendStrength,
    changeHistory,
    currentPeakValue,
    currentPeakScore,
    calculatedAt: new Date(),
  };
}

// ============================================================
// 第十三部分：画像刷新（定时任务调用）
// ============================================================

/**
 * 刷新用户画像快照（每小时调用）
 */
export async function refreshUserPersonaSnapshot(profileId: number): Promise<void> {
  const persona = await buildUserPersona(profileId);

  try {
    await execute(`
      INSERT INTO user_persona_summary (
        profile_id, persona_version, model_version,
        primary_intent, intent_strength, intent_confidence,
        lifecycle_stage, lifecycle_days,
        urgency_level, urgency_score,
        engagement_level, activity_level, job_seeking_maturity,
        top_companies, top_positions, top_cities, top_industries,
        top_skills, top_directions,
        behavior_stats, sequence_features, dbl_signals_summary,
        stability_summary, computed_at, features_ttl_hours
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      ON CONFLICT (profile_id)
      DO UPDATE SET
        primary_intent = $4,
        intent_strength = $5,
        intent_confidence = $6,
        lifecycle_stage = $7,
        lifecycle_days = $8,
        urgency_level = $9,
        urgency_score = $10,
        engagement_level = $11,
        activity_level = $12,
        job_seeking_maturity = $13,
        top_companies = $14,
        top_positions = $15,
        top_cities = $16,
        top_industries = $17,
        top_skills = $18,
        top_directions = $19,
        behavior_stats = $20,
        sequence_features = $21,
        dbl_signals_summary = $22,
        stability_summary = $23,
        computed_at = $24,
        updated_at = NOW()
    `, [
      profileId,
      persona.personaVersion,
      persona.modelVersion ?? null,
      persona.primaryIntent ?? null,
      persona.intentStrength,
      persona.intentConfidence,
      persona.lifecycleStage ?? null,
      persona.lifecycleDays,
      persona.urgencyLevel ?? null,
      persona.urgencyScore,
      persona.engagementLevel,
      persona.activityLevel,
      persona.jobSeekingMaturity,
      JSON.stringify(persona.topCompanies),
      JSON.stringify(persona.topPositions),
      JSON.stringify(persona.topCities),
      JSON.stringify(persona.topIndustries),
      JSON.stringify(persona.topSkills),
      JSON.stringify(persona.topDirections),
      JSON.stringify(persona.behaviorStats),
      JSON.stringify(persona.sequenceFeaturesSummary),
      JSON.stringify(persona.dblSignalsSummary),
      JSON.stringify(persona.stabilitySummary),
      persona.computedAt,
      persona.featuresTtlHours,
    ]);
  } catch (err) {
    log.error({ err, profileId }, 'Failed to refresh persona snapshot');
  }
}

/**
 * 批量刷新多个用户的画像（供定时任务调用）
 */
export async function refreshPersonaBatch(profileIds: number[]): Promise<void> {
  for (const profileId of profileIds) {
    await refreshUserPersonaSnapshot(profileId);
  }
}
