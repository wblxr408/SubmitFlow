-- ============================================================
-- v1.6 用户画像精细化（精确可匹配版）
-- 核心设计原则：每个标签 = 精确值 + 可 join + 可排序
--
-- 三层设计：
--   L1 原始事件层：原始行为记录（不可变）
--   L2 特征聚合层：周期聚合（供查询）
--   L3 画像快照层：最新画像（供推荐）
--
-- 三类标签：
--   正向偏好 (+score)：用户想要 X
--   负向偏好 (neg_score)：用户不想要 X
--   精确意图 (+intent_score)：用户当前想做 Y
-- ============================================================

-- ============================================================
-- 枚举类型
-- ============================================================

DO $$ BEGIN
  CREATE TYPE profile_pref_sign AS ENUM ('positive', 'negative');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE match_strength AS ENUM ('strong', 'medium', 'weak', 'neutral');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE pref_status AS ENUM ('active', 'decayed', 'explicit_removed', 'obsolete');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE event_session_status AS ENUM ('active', 'ended', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 第一层：L1 原始事件层（不可变日志）
-- ============================================================

-- 会话表（30分钟超时边界）
CREATE TABLE IF NOT EXISTS profile_sessions (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_key VARCHAR(100) NOT NULL,
  session_type VARCHAR(30) NOT NULL DEFAULT 'job_browse',  -- 'job_browse', 'search', 'application', 'profile_edit', 'ai_chat', 'notification'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  -- 会话内行为计数
  event_count INT NOT NULL DEFAULT 0,
  unique_target_count INT NOT NULL DEFAULT 0,
  -- 会话结果（会话结束时计算）
  session_result VARCHAR(50),  -- 'converted', 'bounced', 'explored', 'abandoned'
  exit_action VARCHAR(50),  -- 'applied', 'favorited', 'dismissed', 'navigated', 'timeout', 'page_close'
  -- 会话特征
  has_searched BOOLEAN NOT NULL DEFAULT FALSE,
  has_applied BOOLEAN NOT NULL DEFAULT FALSE,
  has_favorited BOOLEAN NOT NULL DEFAULT FALSE,
  has_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  avg_dwell_ms INT DEFAULT 0,
  max_dwell_ms INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, session_key)
);

CREATE INDEX IF NOT EXISTS idx_profile_sessions_profile ON profile_sessions(profile_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_sessions_status ON profile_sessions(profile_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_sessions_active ON profile_sessions(profile_id, status, last_active_at DESC)
  WHERE status = 'active';

COMMENT ON TABLE profile_sessions IS '用户会话表，以30分钟超时为边界，每次会话独立记录';

-- 原始行为事件表（L1 不可变日志）
CREATE TABLE IF NOT EXISTS profile_behavior_events (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_key VARCHAR(100),
  event_id VARCHAR(64) NOT NULL,  -- 全局唯一事件ID (uuid)，用于幂等去重

  -- 行为类型
  event_type VARCHAR(50) NOT NULL,  -- 见 event_type_enum
  event_category VARCHAR(30) NOT NULL,  -- exposure / engagement / action / feedback / social / notification / profile

  -- 目标对象（精确引用）
  target_type VARCHAR(30) NOT NULL,  -- 'job', 'company', 'tag', 'resume', 'search_query', 'recommendation', 'profile', 'ai'
  target_id BIGINT,                  -- job.id / company.id / tag.id / null
  target_text VARCHAR(500),          -- 冗余文本，用于精确匹配关键词搜索

  -- 引用表名（用于精确 join）
  target_table VARCHAR(30),  -- 'jobs', 'companies', 'tags'
  target_pk BIGINT,         -- target_table 的主键

  -- 上下文
  referrer VARCHAR(50),      -- 'search', 'recommendation', 'favorite', 'direct', 'notification', 'email'
  position_index INT,       -- 在列表中的展示位置（从1开始）
  page_url TEXT,             -- 来源页面

  -- 时序
  dwell_time_ms INT,        -- 停留时长（毫秒）
  scroll_depth NUMERIC(3,2) DEFAULT 0,  -- 滚动深度 0.00-1.00

  -- 交互强度（0.00-1.00）
  interaction_score NUMERIC(3,2) NOT NULL DEFAULT 0,

  -- 附加属性（JSONB，完全可查询）
  attributes JSONB NOT NULL DEFAULT '{}',

  -- 来源信息
  source VARCHAR(30),  -- 'web', 'app', 'email', 'feishu'
  ip_hash VARCHAR(64),  -- 脱敏IP（用于地域推断）

  -- 精确时间
  event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 幂等约束
  UNIQUE(profile_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_behavior_events_profile ON profile_behavior_events(profile_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_events_session ON profile_behavior_events(session_key) WHERE session_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_behavior_events_type ON profile_behavior_events(profile_id, event_type, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_events_category ON profile_behavior_events(profile_id, event_category, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_events_target_type ON profile_behavior_events(target_type, target_id) WHERE target_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_behavior_events_target_text ON profile_behavior_events USING GIN(to_tsvector('simple', target_text)) WHERE target_text IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_behavior_events_referrer ON profile_behavior_events(profile_id, referrer, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_events_time ON profile_behavior_events(profile_id, event_time DESC);

COMMENT ON TABLE profile_behavior_events IS '用户行为事件L1表（不可变），记录所有原始行为，供精确匹配和特征计算';

-- 行为类型枚举
DO $$ BEGIN
  CREATE TYPE event_type_enum AS ENUM (
    -- 曝光
    'impression',             -- 职位/公司曝光展示
    'rec_shown',              -- 推荐卡片展示
    'search_result_shown',   -- 搜索结果展示
    -- 互动浏览
    'job_view',              -- 职位列表项浏览
    'job_detail_view',        -- 职位详情页浏览
    'jd_view',               -- 查看JD内容
    'company_view',           -- 查看公司页
    'job_scroll',             -- 职位列表滚动
    -- 搜索
    'search_query',           -- 搜索词输入
    'search_refine',          -- 搜索词修改
    'filter_change',          -- 筛选条件变更
    'sort_change',            -- 排序变更
    -- 行动
    'job_click',              -- 职位点击
    'job_apply',              -- 职位投递（成功）
    'job_apply_start',        -- 职位投递开始（未完成）
    'job_favorite',            -- 职位收藏
    'job_unfavorite',          -- 职位取消收藏
    'job_share',              -- 职位分享
    'resume_download',         -- 下载简历
    'resume_upload',           -- 上传简历
    'draft_save',              -- 保存草稿
    -- 负向反馈
    'job_dismiss',            -- 职位划掉/不感兴趣
    'company_hide',           -- 隐藏公司
    'negative_feedback',       -- 负向反馈
    'report_spam',            -- 举报
    -- AI交互
    'ai_chat',               -- AI对话
    'ai_question',             -- 向AI提问
    'ai_response_received',   -- AI响应接收
    'ai_profile_update',      -- AI资料更新建议接受
    -- 社交
    'referral_view',         -- 查看内推
    'referral_use',           -- 使用内推
    'recruiter_connect',      -- 联系recruiter
    -- 通知
    'notification_open',       -- 打开通知
    'notification_click',       -- 点击通知
    'email_open',             -- 打开邮件
    'email_click',            -- 点击邮件链接
    -- 资料编辑
    'profile_view',           -- 查看个人资料
    'profile_edit',           -- 编辑个人资料
    'resume_edit',            -- 编辑简历
    'skill_add',             -- 添加技能标签
    'skill_remove',           -- 删除技能标签
    -- 求职相关
    'offer_received',         -- 收到offer
    'offer_accepted',         -- 接受offer
    'offer_rejected',         -- 拒绝offer
    'interview_scheduled',    -- 面试预约
    'interview_completed',    -- 面试完成
    'assessment_completed'     -- 测评完成
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 行为类别
DO $$ BEGIN
  CREATE TYPE event_category_enum AS ENUM (
    'exposure',
    'engagement',
    'action',
    'feedback',
    'social',
    'notification',
    'profile',
    'milestone'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

COMMENT ON TABLE profile_behavior_events IS 'L1原始事件表，target_text/target_id 支持精确join，attributes支持精确过滤';

-- ============================================================
-- 第二层：L2 精确偏好表（精确值 + 可 join）
-- ============================================================

-- 核心偏好表：profile_id + 精确target（company_id / tag_id / city_text / ...）+ 正负分数
CREATE TABLE IF NOT EXISTS profile_preferences (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- 精确目标维度（每一行只填一类）
  pref_type VARCHAR(30) NOT NULL,  -- 'company' / 'position' / 'city' / 'industry' / 'skill' / 'internship_type' / 'work_mode' / 'company_size' / 'fame_range' / 'salary_range' / 'direction' / 'recruiter_response'

  -- 精确引用（可 join 到业务表）
  target_id BIGINT,           -- 可join到 companies.id / tags.id / null
  target_text VARCHAR(255),   -- 精确值：'字节跳动' / '北京' / '后端' / '5000-10000'

  -- 精确 join 支持（指定来源表）
  target_table VARCHAR(30),   -- 'companies' / 'tags' / null
  target_pk BIGINT,           -- target_table 的主键

  -- 分数体系（精确值）
  pos_score NUMERIC(6,4) NOT NULL DEFAULT 0,    -- 正向偏好强度 0.0000-1.0000
  neg_score NUMERIC(6,4) NOT NULL DEFAULT 0,    -- 负向偏好强度 0.0000-1.0000
  net_score NUMERIC(7,4) GENERATED ALWAYS AS (pos_score - neg_score) STORED,  -- 净偏好

  -- 行为证据计数
  pos_behavior_count INT NOT NULL DEFAULT 0,  -- 正向行为次数（浏览/收藏/投递）
  neg_behavior_count INT NOT NULL DEFAULT 0,  -- 负向行为次数（划掉/隐藏）

  -- 精确证据来源（可追溯）
  evidence_event_ids TEXT[] DEFAULT '{}',   -- 触发此偏好的事件ID列表

  -- 时间信息
  first_expressed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- 首次表达时间
  last_expressed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- 最近表达时间
  last_decay_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),     -- 最近衰减计算时间

  -- 衰减状态
  decay_factor NUMERIC(5,4) NOT NULL DEFAULT 1.0000,  -- 衰减因子
  pref_status VARCHAR(20) NOT NULL DEFAULT 'active',  -- 'active' / 'decayed' / 'explicit_removed' / 'obsolete'

  -- 精确属性（用于范围查询）
  attributes JSONB NOT NULL DEFAULT '{}',  -- {fame_score: 85, size_range: '2000+'}

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(profile_id, pref_type, target_text)
);

CREATE INDEX IF NOT EXISTS idx_profile_prefs_profile ON profile_preferences(profile_id, pref_type, net_score DESC);
CREATE INDEX IF NOT EXISTS idx_profile_prefs_type ON profile_preferences(profile_id, pref_type, target_text);
CREATE INDEX IF NOT EXISTS idx_profile_prefs_target_id ON profile_preferences(target_id) WHERE target_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profile_prefs_target_pk ON profile_preferences(target_table, target_pk) WHERE target_table IS NOT NULL AND target_pk IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profile_prefs_score ON profile_preferences(profile_id, pref_type, net_score DESC);
CREATE INDEX IF NOT EXISTS idx_profile_prefs_status ON profile_preferences(profile_id, pref_status, pref_type);

COMMENT ON TABLE profile_preferences IS '用户精确偏好表，支持正负分数，target_text/target_id可精确join业务表';
COMMENT ON COLUMN profile_preferences.pref_type IS '偏好类型：company(公司名)/position(职位)/city(城市)/industry(行业)/skill(技能)/internship_type(实习类型)/work_mode(工作模式)/company_size(公司规模)/fame_range(知名度)/salary_range(薪资)/direction(方向)/recruiter_response(recruiter响应)';
COMMENT ON COLUMN profile_preferences.target_text IS '精确值：''字节跳动''/''北京''/''后端开发''/''日常实习''/''remote''';

-- 精确意向表：profile_id + 精确意图类别（不是模糊标签，而是具体意图关键词）
CREATE TABLE IF NOT EXISTS profile_intents (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- 意图维度
  intent_dimension VARCHAR(30) NOT NULL,  -- 'job_level' / 'timing' / 'search_focus' / 'application_style' / 'response_priority'

  -- 精确意图值（枚举或精确字符串）
  intent_key VARCHAR(100) NOT NULL,

  -- 意向强度（精确分数）
  intent_score NUMERIC(5,4) NOT NULL DEFAULT 0,  -- 0.0000-1.0000

  -- 置信度
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0,

  -- 精确证据
  evidence JSONB NOT NULL DEFAULT '{}',  -- {events: [...], behaviors: {...}, text_matches: [...]}
  evidence_count INT NOT NULL DEFAULT 0,

  -- 来源行为
  source_behavior_ids TEXT[] DEFAULT '{}',

  -- 时间
  intent_started_at TIMESTAMPTZ,
  intent_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(profile_id, intent_dimension, intent_key)
);

CREATE INDEX IF NOT EXISTS idx_profile_intents_profile ON profile_intents(profile_id, intent_dimension, intent_score DESC);
CREATE INDEX IF NOT EXISTS idx_profile_intents_key ON profile_intents(profile_id, intent_key, intent_score DESC);

-- 意图维度枚举
DO $$ BEGIN
  CREATE TYPE intent_dimension_enum AS ENUM (
    'job_level',           -- 职位级别：'intern' / 'entry' / 'mid' / 'senior' / 'lead'
    'timing',              -- 时机：'immediately' / 'within_1month' / 'within_3months' / 'exploring'
    'search_focus',        -- 搜索焦点：'company_name' / 'position_title' / 'skill' / 'salary' / 'location'
    'application_style',   -- 投递风格：'targeted' / 'selective' / 'broad' / 'defensive'
    'response_priority',  -- 响应优先级：'speed' / 'quality' / 'brand' / 'compensation'
    'work_mode',          -- 工作模式：'remote' / 'hybrid' / 'onsite'
    'location_flexibility', -- 地点灵活度：'fixed_city' / 'multiple_cities' / 'anywhere'
    'industry_preference',  -- 行业偏好：精确行业名
    'company_stage',       -- 公司阶段：'startup' / 'mid_stage' / 'large_company' / 'state_owned'
    'compensation_focus',  -- 薪资关注度：'primary' / 'secondary' / 'not_important'
    'growth_focus',       -- 成长关注度：'skill_growth' / 'career_path' / 'team_quality' / 'project_impact'
    'culture_fit'         -- 文化匹配：'fast_paced' / 'stable' / 'innovative' / 'collaborative'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 意图 key 枚举（按维度）
DO $$ BEGIN
  CREATE TYPE intent_job_level AS ENUM ('intern', 'entry_level', 'mid_level', 'senior', 'staff', 'lead');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE intent_timing AS ENUM ('immediately', 'within_1month', 'within_3months', 'within_6months', 'exploring', 'passive');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE intent_app_style AS ENUM ('highly_targeted', 'selective', 'broad', 'defensive', 'opportunistic');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE intent_work_mode AS ENUM ('remote', 'hybrid', 'onsite', 'flexible');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE intent_location_flex AS ENUM ('fixed_city', 'multiple_cities', 'relocation_ok', 'anywhere');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

COMMENT ON TABLE profile_intents IS '用户精确意图表，每个维度 = 精确枚举值或精确字符串，用于精确匹配职位属性';

-- ============================================================
-- 第三层：L3 特征快照表（周期性聚合，供快速查询）
-- ============================================================

-- 行为统计快照（按天/周/月聚合）
CREATE TABLE IF NOT EXISTS profile_stats_snapshot (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  snapshot_type VARCHAR(20) NOT NULL,  -- 'daily' / 'weekly' / 'monthly'
  snapshot_date DATE NOT NULL,          -- 快照日期

  -- 精确计数（所有维度都有独立列）
  impression_count INT DEFAULT 0,
  rec_shown_count INT DEFAULT 0,
  job_view_count INT DEFAULT 0,
  job_detail_view_count INT DEFAULT 0,
  jd_view_count INT DEFAULT 0,
  company_view_count INT DEFAULT 0,
  job_click_count INT DEFAULT 0,
  search_query_count INT DEFAULT 0,
  filter_change_count INT DEFAULT 0,
  job_apply_count INT DEFAULT 0,
  job_apply_start_count INT DEFAULT 0,
  job_favorite_count INT DEFAULT 0,
  job_unfavorite_count INT DEFAULT 0,
  job_dismiss_count INT DEFAULT 0,
  ai_chat_count INT DEFAULT 0,
  ai_question_count INT DEFAULT 0,
  profile_edit_count INT DEFAULT 0,
  skill_add_count INT DEFAULT 0,
  skill_remove_count INT DEFAULT 0,
  notification_open_count INT DEFAULT 0,
  referral_view_count INT DEFAULT 0,
  referral_use_count INT DEFAULT 0,

  -- 精确比率
  detail_view_rate NUMERIC(5,4) DEFAULT 0,   -- job_detail_view / job_view
  apply_rate NUMERIC(5,4) DEFAULT 0,        -- job_apply / job_view
  favorite_rate NUMERIC(5,4) DEFAULT 0,     -- job_favorite / job_view
  dismiss_rate NUMERIC(5,4) DEFAULT 0,       -- job_dismiss / job_view
  search_ctr NUMERIC(5,4) DEFAULT 0,        -- job_click / search_query
  rec_ctr NUMERIC(5,4) DEFAULT 0,           -- job_click / rec_shown

  -- 精确深度指标
  total_dwell_ms BIGINT DEFAULT 0,
  avg_dwell_ms INT DEFAULT 0,
  max_dwell_ms INT DEFAULT 0,
  median_dwell_ms INT DEFAULT 0,
  total_scroll_depth NUMERIC(5,2) DEFAULT 0,
  avg_scroll_depth NUMERIC(3,2) DEFAULT 0,

  -- 会话统计
  session_count INT DEFAULT 0,
  avg_session_duration_sec INT DEFAULT 0,
  converted_session_count INT DEFAULT 0,
  bounced_session_count INT DEFAULT 0,

  -- 多样性指标（精确值）
  unique_companies_viewed INT DEFAULT 0,
  unique_positions_viewed INT DEFAULT 0,
  unique_cities_viewed INT DEFAULT 0,
  unique_industries_viewed INT DEFAULT 0,
  unique_skills_interacted INT DEFAULT 0,
  companies_concentration NUMERIC(5,4) DEFAULT 0,  -- top1公司占比
  positions_concentration NUMERIC(5,4) DEFAULT 0,   -- top1职位占比

  -- TopN 精确列表（JSONB 存具体值）
  top_companies JSONB DEFAULT '[]',    -- [{id, name, view_count, score}]
  top_positions JSONB DEFAULT '[]',   -- [{title, view_count, score}]
  top_cities JSONB DEFAULT '[]',      -- [{city, view_count, score}]
  top_industries JSONB DEFAULT '[]',   -- [{industry, view_count, score}]
  top_skills JSONB DEFAULT '[]',      -- [{tag_id, label, score}]
  top_search_queries JSONB DEFAULT '[]', -- [{query, count, matched_jobs}]

  -- 时序精确特征
  morning_count INT DEFAULT 0,     -- 6-12点
  afternoon_count INT DEFAULT 0,   -- 12-18点
  evening_count INT DEFAULT 0,     -- 18-24点
  latenight_count INT DEFAULT 0,  -- 0-6点
  weekday_count INT DEFAULT 0,
  weekend_count INT DEFAULT 0,

  -- 趋势（相比上一周期）
  view_change_pct NUMERIC(6,2) DEFAULT 0,
  apply_change_pct NUMERIC(6,2) DEFAULT 0,
  favorite_change_pct NUMERIC(6,2) DEFAULT 0,
  engagement_change_pct NUMERIC(6,2) DEFAULT 0,

  -- 综合得分
  activity_score NUMERIC(6,2) DEFAULT 0,   -- 活跃度综合分
  engagement_score NUMERIC(6,2) DEFAULT 0, -- 互动深度综合分

  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(profile_id, snapshot_type, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_stats_snapshot_profile ON profile_stats_snapshot(profile_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_stats_snapshot_type ON profile_stats_snapshot(profile_id, snapshot_type, snapshot_date DESC);

COMMENT ON TABLE profile_stats_snapshot IS '用户行为统计快照（精确计数），每个维度都是独立数值列，支持精确过滤和排序';

-- 偏好特征快照（当前精确偏好，用于实时匹配）
CREATE TABLE IF NOT EXISTS profile_preference_snapshot (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  snapshot_version VARCHAR(20) NOT NULL DEFAULT 'v1',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ===== 精确公司偏好（可join到companies表）=====
  top_companies JSONB NOT NULL DEFAULT '[]',  -- [{id, name, net_score, pos_score, neg_score}]
  neg_companies JSONB NOT NULL DEFAULT '[]',  -- [{id, name, neg_score}]

  -- ===== 精确城市偏好 =====
  top_cities JSONB NOT NULL DEFAULT '[]',  -- [{city, net_score}]
  neg_cities JSONB NOT NULL DEFAULT '[]',

  -- ===== 精确职位方向偏好 =====
  top_positions JSONB NOT NULL DEFAULT '[]',  -- [{direction, net_score}]
  neg_positions JSONB NOT NULL DEFAULT '[]',

  -- ===== 精确行业偏好（可join到companies.industry）=====
  top_industries JSONB NOT NULL DEFAULT '[]',  -- [{industry, net_score}]
  neg_industries JSONB NOT NULL DEFAULT '[]',

  -- ===== 精确技能偏好（可join到tags表）=====
  top_skills JSONB NOT NULL DEFAULT '[]',  -- [{tag_id, label, net_score}]
  neg_skills JSONB NOT NULL DEFAULT '[]',

  -- ===== 精确实习类型偏好 =====
  top_internship_types JSONB NOT NULL DEFAULT '[]',  -- [{type, net_score}]
  neg_internship_types JSONB NOT NULL DEFAULT '[]',

  -- ===== 精确工作模式偏好 =====
  top_work_modes JSONB NOT NULL DEFAULT '[]',  -- [{mode, net_score}]

  -- ===== 精确公司规模偏好 =====
  top_company_sizes JSONB NOT NULL DEFAULT '[]',  -- [{size, net_score}]

  -- ===== 精确知名度偏好 =====
  top_fame_ranges JSONB NOT NULL DEFAULT '[]',  -- [{min_fame, max_fame, net_score}]

  -- ===== 精确职位级别偏好 =====
  top_job_levels JSONB NOT NULL DEFAULT '[]',  -- [{level, net_score}]

  -- ===== 精确意图快照（每个维度一个精确key）=====
  current_timing JSONB NOT NULL DEFAULT '{}',   -- {key, score, confidence}
  current_app_style JSONB NOT NULL DEFAULT '{}',
  current_work_mode JSONB NOT NULL DEFAULT '{}',
  current_location_flex JSONB NOT NULL DEFAULT '{}',
  current_industry_focus JSONB NOT NULL DEFAULT '{}',
  current_growth_focus JSONB NOT NULL DEFAULT '{}',
  current_culture_fit JSONB NOT NULL DEFAULT '{}',

  -- ===== 综合评分 =====
  overall_match_score NUMERIC(5,4) DEFAULT 0,  -- 综合匹配度
  match_confidence NUMERIC(3,2) DEFAULT 0,       -- 置信度

  -- ===== 精确统计摘要 =====
  total_pref_count INT DEFAULT 0,
  pos_pref_count INT DEFAULT 0,
  neg_pref_count INT DEFAULT 0,
  last_behavior_at TIMESTAMPTZ,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(profile_id)
);

CREATE INDEX IF NOT EXISTS idx_pref_snapshot_profile ON profile_preference_snapshot(profile_id);

COMMENT ON TABLE profile_preference_snapshot IS '用户偏好快照（精确值列表），JSONB内含可join的ID和精确分数，用于实时精确匹配';

-- ============================================================
-- 辅助表：精确意图推断规则表（可配置）
-- ============================================================

CREATE TABLE IF NOT EXISTS intent_inference_rules (
  id BIGSERIAL PRIMARY KEY,
  intent_dimension VARCHAR(30) NOT NULL,
  intent_key VARCHAR(100) NOT NULL,
  rule_type VARCHAR(20) NOT NULL,  -- 'behavior_pattern' / 'threshold' / 'keyword' / 'text_match'

  -- 规则条件（精确配置）
  conditions JSONB NOT NULL DEFAULT '{}',  -- {min_apply_count: 3, min_favorite_count: 2}
  keywords TEXT[] DEFAULT '{}',            -- ['急', '马上', '立即']
  text_patterns TEXT[] DEFAULT '{}',      -- ['求职', '找实习', '春招']

  -- 触发条件
  trigger_event_types TEXT[] DEFAULT '{}',  -- 触发的事件类型
  min_evidence_count INT DEFAULT 1,
  score_boost NUMERIC(5,4) DEFAULT 0,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(intent_dimension, intent_key, rule_type)
);

-- 插入默认推断规则
INSERT INTO intent_inference_rules (intent_dimension, intent_key, rule_type, conditions, trigger_event_types, min_evidence_count, score_boost, priority) VALUES
  -- 时机推断
  ('timing', 'immediately', 'threshold', '{"min_apply_count": 5, "within_days": 7}', '{"job_apply"}', 3, 0.5, 10),
  ('timing', 'within_1month', 'threshold', '{"min_apply_count": 3, "within_days": 14}', '{"job_apply", "job_apply_start"}', 2, 0.3, 9),
  ('timing', 'within_3months', 'threshold', '{"min_apply_count": 1, "within_days": 30}', '{"job_apply"}', 1, 0.2, 8),
  ('timing', 'exploring', 'threshold', '{"max_apply_count": 0, "min_view_count": 5}', '{"job_view"}', 5, 0.1, 5),
  ('timing', 'passive', 'threshold', '{"max_apply_count": 0, "max_view_count": 3, "max_favorite_count": 1}', '{}', 1, 0.0, 3),

  -- 投递风格推断
  ('application_style', 'highly_targeted', 'threshold', '{"min_apply_rate": 0.3, "max_unique_companies": 10}', '{"job_apply", "job_view"}', 10, 0.5, 10),
  ('application_style', 'selective', 'threshold', '{"min_apply_rate": 0.1, "max_unique_companies": 30}', '{"job_apply", "job_view"}', 10, 0.3, 8),
  ('application_style', 'broad', 'threshold', '{"min_apply_count": 20, "max_apply_rate": 0.05}', '{"job_apply"}', 10, 0.2, 6),
  ('application_style', 'defensive', 'keyword', '{"keywords": ["骑驴找马", "保底", "备选"]}', '{"ai_chat", "ai_question"}', 1, 0.3, 9),

  -- 工作模式推断
  ('work_mode', 'remote', 'behavior_pattern', '{"remote_job_view_count": 3}', '{"job_view"}', 3, 0.3, 7),
  ('work_mode', 'hybrid', 'behavior_pattern', '{"hybrid_job_view_count": 3}', '{"job_view"}', 3, 0.3, 7),
  ('work_mode', 'onsite', 'behavior_pattern', '{"onsite_job_view_count": 3}', '{"job_view"}', 3, 0.3, 7),

  -- 地点灵活度推断
  ('location_flexibility', 'fixed_city', 'threshold', '{"min_city_count": 1, "max_city_count": 1}', '{}', 10, 0.3, 7),
  ('location_flexibility', 'multiple_cities', 'threshold', '{"min_city_count": 2, "max_city_count": 5}', '{}', 5, 0.2, 5),
  ('location_flexibility', 'relocation_ok', 'behavior_pattern', '{"city_change_search_count": 3}', '{"search_query"}', 3, 0.3, 6),

  -- 职位级别推断
  ('job_level', 'intern', 'keyword', '{"keywords": ["实习", "intern"]}', '{"search_query", "job_view"}', 2, 0.3, 8),
  ('job_level', 'entry_level', 'keyword', '{"keywords": ["校招", "初级", "entry"]}', '{"search_query"}', 2, 0.3, 7),
  ('job_level', 'senior', 'keyword', '{"keywords": ["资深", "senior", "3-5年"]}', '{"search_query"}', 2, 0.2, 6),

  -- 成长关注度推断
  ('growth_focus', 'skill_growth', 'keyword', '{"keywords": ["成长", "学习", "技术"]}', '{"search_query", "ai_question"}', 2, 0.2, 6),
  ('growth_focus', 'compensation', 'keyword', '{"keywords": ["薪资", "工资", "薪酬"]}', '{"search_query", "ai_question"}', 2, 0.2, 6)
ON CONFLICT (intent_dimension, intent_key, rule_type) DO NOTHING;

COMMENT ON TABLE intent_inference_rules IS '意图推断规则表，支持阈值/关键词/行为模式三种规则类型';

-- ============================================================
-- 辅助函数
-- ============================================================

-- 交互强度计算
CREATE OR REPLACE FUNCTION calc_interaction_score(
  p_event_type VARCHAR,
  p_dwell_ms INT,
  p_scroll_depth NUMERIC
) RETURNS NUMERIC(3,2) AS $$
DECLARE
  v_type_score NUMERIC(3,2);
  v_dwell_score NUMERIC(3,2);
  v_scroll_score NUMERIC(3,2);
BEGIN
  CASE p_event_type
    WHEN 'job_apply' THEN v_type_score := 1.00;
    WHEN 'job_apply_start' THEN v_type_score := 0.70;
    WHEN 'jd_view' THEN v_type_score := 0.55;
    WHEN 'job_detail_view' THEN v_type_score := 0.45;
    WHEN 'job_favorite' THEN v_type_score := 0.50;
    WHEN 'company_view' THEN v_type_score := 0.30;
    WHEN 'search_query' THEN v_type_score := 0.35;
    WHEN 'search_refine' THEN v_type_score := 0.30;
    WHEN 'ai_chat', 'ai_question' THEN v_type_score := 0.45;
    WHEN 'filter_change' THEN v_type_score := 0.20;
    WHEN 'job_dismiss' THEN v_type_score := 0.15;
    WHEN 'job_view' THEN v_type_score := 0.10;
    WHEN 'impression', 'rec_shown' THEN v_type_score := 0.02;
    ELSE v_type_score := 0.05;
  END CASE;

  v_dwell_score := LEAST(1.00, COALESCE(p_dwell_ms, 0)::NUMERIC / 30000.0);
  v_scroll_score := COALESCE(p_scroll_depth, 0);

  RETURN LEAST(1.00, GREATEST(0.00,
    v_type_score * 0.50 + v_dwell_score * 0.30 + v_scroll_score * 0.20
  ));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 偏好衰减
CREATE OR REPLACE FUNCTION calc_preference_decay(
  p_last_expressed TIMESTAMPTZ,
  p_decay_rate_daily NUMERIC DEFAULT 0.01
) RETURNS NUMERIC(5,4) AS $$
DECLARE
  v_days INT;
BEGIN
  v_days := GREATEST(0, EXTRACT(EPOCH FROM (NOW() - p_last_expressed)) / 86400)::INT;
  RETURN GREATEST(0.0001, POWER((1 - p_decay_rate_daily), v_days));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 会话超时应计
CREATE OR REPLACE FUNCTION close_expired_sessions() RETURNS INT AS $$
DECLARE
  v_count INT := 0;
BEGIN
  UPDATE profile_sessions
  SET status = 'expired', ended_at = NOW(), updated_at = NOW(),
      session_result = 'timeout'
  WHERE status = 'active'
    AND last_active_at < NOW() - INTERVAL '30 minutes'
    AND id IN (
      SELECT id FROM profile_sessions
      WHERE status = 'active'
      AND last_active_at < NOW() - INTERVAL '30 minutes'
      LIMIT 1000
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 精确偏好更新（支持正负）
CREATE OR REPLACE FUNCTION upsert_exact_preference(
  p_profile_id BIGINT,
  p_pref_type VARCHAR,
  p_target_text VARCHAR,
  p_target_id BIGINT DEFAULT NULL,
  p_target_table VARCHAR DEFAULT NULL,
  p_target_pk BIGINT DEFAULT NULL,
  p_delta NUMERIC DEFAULT 0.05,
  p_is_negative BOOLEAN DEFAULT FALSE,
  p_event_id VARCHAR DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_decay_rate NUMERIC := CASE p_pref_type
    WHEN 'company' THEN 0.008  -- 公司偏好衰减慢
    WHEN 'city' THEN 0.005     -- 城市偏好稳定
    WHEN 'industry' THEN 0.006 -- 行业偏好慢衰减
    WHEN 'skill' THEN 0.012    -- 技能偏好较快衰减
    WHEN 'direction' THEN 0.01 -- 方向偏好
    ELSE 0.01
  END;
  v_decay NUMERIC;
  v_new_score NUMERIC;
BEGIN
  v_decay := calc_preference_decay(NOW(), v_decay_rate);

  IF p_is_negative THEN
    UPDATE profile_preferences SET
      neg_score = LEAST(1.0, neg_score + p_delta),
      neg_behavior_count = neg_behavior_count + 1,
      evidence_event_ids = CASE WHEN p_event_id IS NOT NULL THEN array_append(evidence_event_ids, p_event_id) ELSE evidence_event_ids END,
      last_expressed_at = NOW(),
      updated_at = NOW()
    WHERE profile_id = p_profile_id AND pref_type = p_pref_type AND target_text = p_target_text;

    IF NOT FOUND THEN
      INSERT INTO profile_preferences (
        profile_id, pref_type, target_id, target_text, target_table, target_pk,
        neg_score, neg_behavior_count, evidence_event_ids, first_expressed_at, last_expressed_at
      ) VALUES (p_profile_id, p_pref_type, p_target_id, p_target_text, p_target_table, p_target_pk,
        p_delta, 1, ARRAY[p_event_id]::TEXT[], NOW(), NOW());
    END IF;
  ELSE
    UPDATE profile_preferences SET
      pos_score = LEAST(1.0, pos_score * decay_factor + p_delta),
      decay_factor = v_decay,
      pos_behavior_count = pos_behavior_count + 1,
      evidence_event_ids = CASE WHEN p_event_id IS NOT NULL THEN array_append(evidence_event_ids, p_event_id) ELSE evidence_event_ids END,
      last_expressed_at = NOW(),
      last_decay_at = NOW(),
      updated_at = NOW()
    WHERE profile_id = p_profile_id AND pref_type = p_pref_type AND target_text = p_target_text;

    IF NOT FOUND THEN
      INSERT INTO profile_preferences (
        profile_id, pref_type, target_id, target_text, target_table, target_pk,
        pos_score, decay_factor, pos_behavior_count, evidence_event_ids, first_expressed_at, last_expressed_at
      ) VALUES (p_profile_id, p_pref_type, p_target_id, p_target_text, p_target_table, p_target_pk,
        p_delta, v_decay, 1, ARRAY[p_event_id]::TEXT[], NOW(), NOW());
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 精确匹配：计算 profile 和 job 的匹配分数
CREATE OR REPLACE FUNCTION calc_job_profile_match(
  p_job_id BIGINT,
  p_profile_id BIGINT
) RETURNS TABLE (
  match_score NUMERIC(5,4),
  company_match NUMERIC(5,4),
  city_match NUMERIC(5,4),
  direction_match NUMERIC(5,4),
  skill_match NUMERIC(5,4),
  industry_match NUMERIC(5,4),
  match_details JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH job_info AS (
    SELECT j.id, j.title, j.direction, j.city, j.is_remote, j.internship_type, j.fame_score,
           c.name AS company_name, c.industry, c.size AS company_size, c.fame_score AS company_fame_score,
           ARRAY_AGG(t.label) FILTER (WHERE t.label IS NOT NULL) AS skill_labels,
           ARRAY_AGG(t.id) FILTER (WHERE t.id IS NOT NULL) AS skill_ids
    FROM jobs j
    JOIN companies c ON c.id = j.company_id
    LEFT JOIN job_tags jt ON jt.job_id = j.id
    LEFT JOIN tags t ON t.id = jt.tag_id
    WHERE j.id = p_job_id
    GROUP BY j.id, j.title, j.direction, j.city, j.is_remote, j.internship_type, j.fame_score,
             c.name, c.industry, c.size, c.fame_score
  ),
  profile_prefs AS (
    SELECT pref_type, target_text, target_id, net_score
    FROM profile_preferences
    WHERE profile_id = p_profile_id
      AND pref_status = 'active'
  ),
  company_match_calc AS (
    SELECT COALESCE(MAX(net_score), 0) AS s
    FROM profile_prefs WHERE pref_type = 'company' AND target_text = (SELECT company_name FROM job_info)
  ),
  city_match_calc AS (
    SELECT COALESCE(MAX(net_score), 0) AS s
    FROM profile_prefs WHERE pref_type = 'city' AND target_text = (SELECT city FROM job_info)
  ),
  direction_match_calc AS (
    SELECT COALESCE(MAX(net_score), 0) AS s
    FROM profile_prefs WHERE pref_type = 'direction' AND target_text = (SELECT direction FROM job_info)
  ),
  skill_match_calc AS (
    SELECT
      CASE WHEN COUNT(*) = 0 THEN 0
      ELSE SUM(net_score) / GREATEST(1, (SELECT COUNT(*) FROM unnest(ARRAY(
        SELECT skill_labels FROM job_info
      )) AS sl)) END AS s
    FROM profile_prefs
    WHERE pref_type = 'skill' AND target_text = ANY(SELECT skill_labels FROM job_info)
  ),
  industry_match_calc AS (
    SELECT COALESCE(MAX(net_score), 0) AS s
    FROM profile_prefs WHERE pref_type = 'industry' AND target_text = (SELECT industry FROM job_info)
  )
  SELECT
    COALESCE(cm.s, 0) * 0.20 +
    COALESCE(ci.s, 0) * 0.15 +
    COALESCE(cd.s, 0) * 0.25 +
    COALESCE(cs.s, 0) * 0.30 +
    COALESCE(ind.s, 0) * 0.10 AS match_score,
    COALESCE(cm.s, 0) AS company_match,
    COALESCE(ci.s, 0) AS city_match,
    COALESCE(cd.s, 0) AS direction_match,
    COALESCE(cs.s, 0) AS skill_match,
    COALESCE(ind.s, 0) AS industry_match,
    jsonb_build_object(
      'job_id', p_job_id,
      'profile_id', p_profile_id,
      'matched_companies', ARRAY(SELECT target_text FROM profile_prefs WHERE pref_type = 'company' AND target_text = (SELECT company_name FROM job_info)),
      'matched_cities', ARRAY(SELECT target_text FROM profile_prefs WHERE pref_type = 'city' AND target_text = (SELECT city FROM job_info)),
      'matched_skills', ARRAY(SELECT target_text FROM profile_prefs WHERE pref_type = 'skill' AND target_text = ANY(SELECT skill_labels FROM job_info)),
      'matched_industries', ARRAY(SELECT target_text FROM profile_prefs WHERE pref_type = 'industry' AND target_text = (SELECT industry FROM job_info))
    ) AS match_details
  FROM company_match_calc cm, city_match_calc ci, direction_match_calc cd, skill_match_calc cs, industry_match_calc ind;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calc_job_profile_match IS '精确计算profile和job的匹配分数，返回各维度分数和详细匹配列表';

-- ============================================================
-- 定时任务 SQL（供 cron 调用）
-- ============================================================

-- 1. 关闭超时会话（每5分钟）
-- SELECT close_expired_sessions();

-- 2. 刷新日统计快照（每日凌晨）
-- INSERT INTO profile_stats_snapshot (...) SELECT ... FROM profile_behavior_events WHERE event_time >= CURRENT_DATE - 1;

-- 3. 刷新偏好快照（每小时）
-- SELECT refresh_profile_preference_snapshot(profile_id);

-- 4. 批量衰减偏好（每日）
-- UPDATE profile_preferences
-- SET pos_score = pos_score * decay_factor,
--     decay_factor = decay_factor * 0.99,
--     updated_at = NOW()
-- WHERE pref_status = 'active' AND pos_score > 0.001;
