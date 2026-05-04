/**
 * TypeScript 类型定义
 * 与 PostgreSQL schema 一一对应
 */

// ============================================================
// 枚举
// ============================================================
export type ApplicationStatus =
  | 'screening'
  | 'written_test'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export type EntryType =
  | 'official'
  | 'public_referral'
  | 'private_referral'
  | 'internal';

export type SourceType =
  | 'public'
  | 'public_referral'
  | 'private_import'
  | 'auth_required';

export type CrawlStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ParseStatus = 'pending' | 'processed' | 'failed';
export type ParseResolution = 'auto_updated' | 'pending' | 'ignored';
export type SessionStatus = 'active' | 'reauth_required' | 'expired';
export type NotificationChannel = 'feishu' | 'email';
export type NotificationStatus = 'active' | 'inactive';
export type AiTaskType =
  | 'agent_chat'
  | 'jd_tagging'
  | 'email_parse'
  | 'job_summary';
export type AgentRole = 'user' | 'assistant' | 'system';
export type UserRole = 'user' | 'admin';

// ============================================================
// users (v1.3 新增)
// ============================================================
export interface User {
  id: number;
  email: string;
  nickname: string | null;
  role: UserRole;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// profiles
// ============================================================
export interface Profile {
  id: number;
  user_id: number | null;  // v1.3: 关联到 users 表
  school: string | null;
  major: string | null;
  graduation_year: number | null;
  target_cities: string[];
  internship_types: string[];
  mode: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// user_tag_prefs
// ============================================================
export interface UserTagPref {
  id: number;
  profile_id: number;
  tag_id: number;
  weight: number;
  created_at: string;
  updated_at: string;
}

// ============================================================
// user_ranking_prefs (v1.3: 新增 freshness_weight)
// ============================================================
export interface UserRankingPref {
  id: number;
  profile_id: number;
  fame_weight: number;
  match_weight: number;
  city_weight: number;
  deadline_weight: number;
  conversion_weight: number;
  freshness_weight: number;  // v1.3: 新鲜度权重
  preset_name: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// tags
// ============================================================
export interface Tag {
  id: number;
  slug: string;
  label: string;
  group_name: string | null;
  color_hex: string;
  is_preset: boolean;
  created_at: string;
}

// ============================================================
// graph_nodes
// ============================================================
export interface GraphNode {
  id: number;
  parent_id: number | null;
  level: 1 | 2 | 3;
  label: string;
  tag_id: number | null;
  sort_order: number;
  created_at: string;
  children?: GraphNode[];
}

// ============================================================
// companies (v1.3: 扩展字段)
// ============================================================
export interface Company {
  id: number;
  name: string;
  alias_names: string[];
  brand_names: string[];
  parent_company_id: number | null;
  fame_score: number;
  size: string | null;
  industry: string | null;
  sub_industry: string | null;   // v1.3: 细分行业
  is_hot: boolean;              // v1.3: 是否热点公司
  conversion_level: string | null;  // v1.3: 转正率等级
  headcount_range: string | null;  // v1.3: 员工规模
  established_year: number | null; // v1.3: 成立年份
  headquarters: string | null;      // v1.3: 总部城市
  created_at: string;
  updated_at: string;
}

// ============================================================
// jobs
// ============================================================
export interface Job {
  id: number;
  company_id: number;
  title: string;
  direction: string | null;
  jd_text: string | null;
  city: string | null;
  is_remote: boolean;
  internship_type: string | null;
  deadline: string | null;
  conversion_rate: number | null;
  status: string;
  canonical_source: string | null;
  created_at: string;
  updated_at: string;
  first_seen_at: string;
  last_seen_at: string;
  // 关联字段（JOIN 后填充）
  company?: Company;
  tags?: Tag[];
  entrypoints?: JobEntrypoint[];
  composite_score?: number;
  match_score?: number;
}

// ============================================================
// job_tags
// ============================================================
export interface JobTag {
  job_id: number;
  tag_id: number;
  source: 'manual' | 'ai';
}

// ============================================================
// job_entrypoints
// ============================================================
export interface JobEntrypoint {
  id: number;
  job_id: number;
  entry_type: EntryType;
  entry_url: string;
  visibility: 'public' | 'private';
  requires_auth: boolean;
  referrer_name: string | null;
  owner_user_id: number | null;
  source_name: string | null;
  source_job_id: string | null;
  valid_until: string | null;
  status: string;
  created_at: string;
}

// ============================================================
// job_sources
// ============================================================
export interface JobSource {
  id: number;
  source_name: string;
  source_type: SourceType;
  industry_scope: string[];
  is_enabled: boolean;
  priority: number;
  last_crawled_at: string | null;
  created_at: string;
}

// ============================================================
// source_accounts
// ============================================================
export interface SourceAccount {
  id: number;
  profile_id: number;
  source_id: number;
  account_label: string | null;
  auth_payload_encrypted: string | null;
  session_status: SessionStatus;
  last_auth_at: string | null;
  last_valid_at: string | null;
  created_at: string;
}

// ============================================================
// crawl_runs
// ============================================================
export interface CrawlRun {
  id: number;
  source_id: number;
  run_type: 'full' | 'incremental';
  status: CrawlStatus;
  started_at: string | null;
  finished_at: string | null;
  stats_json: Record<string, unknown>;
  created_at: string;
}

// ============================================================
// applications
// ============================================================
export interface Application {
  id: number;
  profile_id: number;
  job_id: number;
  job_entrypoint_id: number | null;
  status: ApplicationStatus;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
  // 关联字段
  job?: Job;
  private_tags?: ApplicationPrivateTag[];
  events?: ApplicationEvent[];
}

// ============================================================
// application_private_tags
// ============================================================
export interface ApplicationPrivateTag {
  id: number;
  application_id: number;
  label: string;
  created_at: string;
}

// ============================================================
// application_events
// ============================================================
export interface ApplicationEvent {
  id: number;
  application_id: number;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  source: 'manual' | 'email' | 'manual_feishu';
  source_ref: string | null;
  created_at: string;
}

// ============================================================
// user_email_connections
// ============================================================
export interface UserEmailConnection {
  id: number;
  profile_id: number;
  provider: 'gmail';
  auth_payload_encrypted: string | null;
  token_expires_at: string | null;
  last_synced_at: string | null;
  status: SessionStatus;
  created_at: string;
}

// ============================================================
// email_parse_logs
// ============================================================
export interface EmailParseLog {
  id: number;
  profile_id: number;
  message_id: string;
  parsed_company: string | null;
  parsed_role: string | null;
  parsed_status: string | null;
  confidence: number | null;
  matched_application_id: number | null;
  resolution: ParseResolution;
  created_at: string;
}

// ============================================================
// user_notifications
// ============================================================
export interface UserNotification {
  id: number;
  profile_id: number;
  channel: NotificationChannel;
  config_encrypted: string | null;
  status: NotificationStatus;
  created_at: string;
}

// ============================================================
// AI 域
// ============================================================
export interface AiProvider {
  id: number;
  provider_key: string;
  display_name: string;
  adapter_type: string;
  is_system_enabled: boolean;
  created_at: string;
}

export interface AiModelCatalog {
  id: number;
  provider_id: number;
  model_name: string;
  supports_chat: boolean;
  supports_structured_output: boolean;
  supports_streaming: boolean;
  supports_vision: boolean;
  created_at: string;
}

export interface UserAiProviderConfig {
  id: number;
  profile_id: number;
  provider_id: number;
  base_url: string | null;
  api_key_encrypted: string | null;
  is_enabled: boolean;
  display_alias: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserAiTaskRoute {
  id: number;
  profile_id: number;
  task_type: AiTaskType;
  primary_provider_id: number | null;
  primary_model_name: string | null;
  fallback_chain_json: string[];
  created_at: string;
  updated_at: string;
}

export interface AiRequestLog {
  id: number;
  profile_id: number | null;
  task_type: AiTaskType | null;
  provider_id: number | null;
  model_name: string | null;
  status: 'success' | 'failed';
  latency_ms: number | null;
  token_usage_json: Record<string, number> | null;
  estimated_cost: number | null;
  error_code: string | null;
  created_at: string;
}

// ============================================================
// agent
// ============================================================
export interface AgentSession {
  id: number;
  profile_id: number;
  provider_id: number | null;
  model_name: string | null;
  summary: string | null;
  result_json: AgentProfileResult;
  created_at: string;
  updated_at: string;
  messages?: AgentMessage[];
}

export interface AgentMessage {
  id: number;
  session_id: number;
  role: AgentRole;
  content: string;
  created_at: string;
}

export interface AgentProfileResult {
  summary?: string;
  tag_weights?: Array<{ tag_id: number; weight: number }>;
  target_cities?: string[];
  internship_types?: string[];
  interested_directions?: string[];
  uninterested_directions?: string[];
}

// ============================================================
// API 请求/响应类型
// ============================================================
export interface JobFilterParams {
  keyword?: string;
  city?: string;
  internship_type?: string;
  tag_ids?: number[];
  tag_mode?: 'or' | 'and';
  source_type?: SourceType;
  has_referral?: boolean;
  page?: number;
  page_size?: number;
}

export interface RecommendationParams {
  tier?: 'top20' | 'top50' | 'top100' | 'top200' | 'all';
  has_referral?: boolean;
  fame_weight?: number;
  match_weight?: number;
  city_weight?: number;
  deadline_weight?: number;
  conversion_weight?: number;
}

export interface ApplicationFilterParams {
  status?: ApplicationStatus | ApplicationStatus[];
  page?: number;
  page_size?: number;
}

// ============================================================
// job_favorites - 岗位收藏
// ============================================================
export interface JobFavorite {
  id: number;
  profile_id: number;
  job_id: number;
  note: string | null;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
  // 关联字段
  job?: Job;
}

// ============================================================
// referrals - 内推信息
// ============================================================
export type ReferralSource = 'manual' | 'import' | 'feishu';
export type ReferralStatus = 'active' | 'archived';

export interface Referral {
  id: number;
  profile_id: number;
  company_name: string;
  job_title: string | null;
  referrer_name: string | null;
  referrer_contact: string | null;
  referral_code: string | null;
  entry_url: string | null;
  notes: string | null;
  source: ReferralSource;
  source_ref: string | null;
  status: ReferralStatus;
  created_at: string;
  updated_at: string;
  // 关联字段
  usage_count?: number;
  last_used_at?: string | null;
}

export interface ReferralUsageLog {
  id: number;
  referral_id: number;
  job_id: number | null;
  application_id: number | null;
  used_at: string;
  notes: string | null;
}

// ============================================================
// reminders - 投递提醒
// ============================================================
export type ReminderType = 'deadline';
export type ReminderChannel = 'email' | 'feishu' | 'both';

export interface Reminder {
  id: number;
  profile_id: number;
  reminder_type: ReminderType;
  days_before: number | null;
  job_id: number | null;
  channel: ReminderChannel;
  is_enabled: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReminderLog {
  id: number;
  reminder_id: number;
  job_id: number;
  channel: ReminderChannel;
  status: 'sent' | 'failed';
  sent_at: string;
  error_message: string | null;
}

// ============================================================
// resumes - 简历管理
// ============================================================
export interface Resume {
  id: number;
  profile_id: number;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  tags: string[];
  notes: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// v1.6 用户画像细化分类类型
// ============================================================

/** 行为类别 */
export type BehaviorCategory =
  | 'exposure'
  | 'engagement'
  | 'action'
  | 'feedback'
  | 'social'
  | 'notification'
  | 'profile';

/** 细粒度行为类型（v2） */
export type BehaviorTypeV2 =
  | 'impression'
  | 'recommendation_shown'
  | 'search_result_shown'
  | 'view'
  | 'view_detail'
  | 'view_company'
  | 'view_JD'
  | 'hover'
  | 'scroll'
  | 'search'
  | 'filter_change'
  | 'search_refine'
  | 'click'
  | 'apply'
  | 'apply_start'
  | 'favorite'
  | 'unfavorite'
  | 'share'
  | 'save_draft'
  | 'resume_download'
  | 'resume_upload'
  | 'dismiss'
  | 'hide_company'
  | 'report_spam'
  | 'negative_feedback'
  | 'ai_chat'
  | 'ai_question'
  | 'ai_recommendation'
  | 'ai_profile_update'
  | 'view_referral'
  | 'use_referral'
  | 'connect_recruiter'
  | 'notification_open'
  | 'notification_click'
  | 'email_open'
  | 'email_click'
  | 'profile_view'
  | 'profile_edit'
  | 'resume_edit'
  | 'skill_add'
  | 'skill_remove';

/** 职业主意向 */
export type CareerIntentPrimary =
  | 'active_job_seeker'
  | 'passive_talent'
  | 'exploratory'
  | 'internship_seeker'
  | 'career_changer'
  | 'new_grad'
  | 'returning_professional'
  | 'information_gathering'
  | 'market_research'
  | 'passive_browsing'
  | 'idle_curiosity'
  | 'network_builder'
  | 'content_consumer';

/** 职业次意向 */
export type CareerIntentSecondary =
  | 'urgent_apply'
  | 'selective_apply'
  | 'bulk_apply'
  | 'defensive_apply'
  | 'last_mile'
  | 'window_shopping'
  | 'opportunity_aware'
  | 'recruiter_responsive'
  | 'salary_conscious'
  | 'growth_oriented'
  | 'trend_tracking'
  | 'benchmarking'
  | 'option_exploration';

/** 用户生命周期阶段 */
export type LifecycleStage =
  | 'onboarding'
  | 'cold_start'
  | 'profile_setup'
  | 'early_exploration'
  | 'active_browsing'
  | 'intent_formation'
  | 'active_application'
  | 'application_tracking'
  | 'offer_evaluation'
  | 'hired_success'
  | 'dormant'
  | 'churned';

/** 紧迫度等级 */
export type UrgencyLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

/** 稳定性分类 */
export type StabilityCategory = 'highly_stable' | 'stable' | 'evolving' | 'unstable';

/** 漂移方向 */
export type DriftDirection = 'converging' | 'diverging' | 'stable' | 'shifted';

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

/** 活跃时间模式 */
export type ActiveTimePattern = 'morning' | 'afternoon' | 'evening' | 'late_night' | 'mixed';

/** 求职策略 */
export type JobSearchStrategy = 'focused_narrow' | 'focused_broad' | 'scattered' | 'opportunistic';

/** 漏斗位置 */
export type FunnelPosition = 'awareness' | 'interest' | 'consideration' | 'intent' | 'conversion';
