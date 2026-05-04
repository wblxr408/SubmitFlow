-- ============================================================
-- v1.4 增强搜索与用户画像
-- 1. 全文搜索索引（tsvector）
-- 2. 模糊匹配索引（pg_trgm）
-- 3. 用户行为记录表
-- 4. 用户画像标签增强
-- ============================================================

-- 1. 启用扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- 2. 为 jobs 表添加全文搜索向量（增量更新，无需重建整个表）
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE jobs ADD COLUMN search_vector tsvector;
  END IF;
END $$;

-- 创建 GIN 索引用于全文搜索
CREATE INDEX IF NOT EXISTS idx_jobs_search_vector ON jobs USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm ON jobs USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_jd_trgm ON jobs USING GIN(jd_text gin_trgm_ops);

-- 创建函数：自动更新 search_vector
CREATE OR REPLACE FUNCTION jobs_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.direction, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.city, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.jd_text, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器（仅当 search_vector 列存在时）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'search_vector'
  ) THEN
    DROP TRIGGER IF EXISTS jobs_search_vector_trigger ON jobs;
    CREATE TRIGGER jobs_search_vector_trigger
      BEFORE INSERT OR UPDATE ON jobs
      FOR EACH ROW EXECUTE FUNCTION jobs_search_vector_update();
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Trigger creation skipped: %', SQLERRM;
END $$;

-- 回填现有数据的 search_vector
UPDATE jobs SET search_vector =
  setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(direction, '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(city, '')), 'C') ||
  setweight(to_tsvector('simple', COALESCE(jd_text, '')), 'D')
WHERE search_vector IS NULL;

-- ============================================================
-- 3. 为 companies 表添加模糊匹配索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_companies_name_trgm ON companies USING GIN(name gin_trgm_ops);
-- Note: alias_names is JSONB array, cannot use UNNEST in index expression
-- Use jsonb_path_ops or text_pattern_ops instead

-- ============================================================
-- 4. 用户行为记录表（用于用户画像）
-- ============================================================
CREATE TABLE IF NOT EXISTS user_behaviors (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  behavior_type VARCHAR(30) NOT NULL,  -- 'view', 'search', 'apply', 'favorite', 'click', 'ai_chat'
  target_type VARCHAR(30),              -- 'job', 'company', 'tag', null
  target_id BIGINT,                     -- job_id, company_id, tag_id
  target_title VARCHAR(255),            -- 冗余存储，便于分析
  metadata JSONB DEFAULT '{}',           -- 扩展数据：搜索词、停留时间等
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_behaviors_profile ON user_behaviors(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_behaviors_type ON user_behaviors(profile_id, behavior_type);
CREATE INDEX IF NOT EXISTS idx_user_behaviors_target ON user_behaviors(target_type, target_id) WHERE target_id IS NOT NULL;

-- ============================================================
-- 5. 用户兴趣标签增强表
-- ============================================================
CREATE TABLE IF NOT EXISTS user_interest_scores (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  interest_type VARCHAR(30) NOT NULL,  -- 'company', 'position', 'industry', 'skill', 'city'
  interest_key VARCHAR(255) NOT NULL,   -- 公司名、岗位方向、行业、技能、城市
  score NUMERIC(5, 3) NOT NULL DEFAULT 0,  -- 0.000 - 1.000
  behavior_count INT NOT NULL DEFAULT 0,    -- 触发次数
  last_behavior_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, interest_type, interest_key)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_interest_profile ON user_interest_scores(profile_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_user_interest_type ON user_interest_scores(profile_id, interest_type, score DESC);

-- ============================================================
-- 6. 搜索历史表
-- ============================================================
CREATE TABLE IF NOT EXISTS search_history (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  search_query VARCHAR(500) NOT NULL,
  search_type VARCHAR(20) NOT NULL,  -- 'jobs', 'companies', 'all'
  result_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_search_history_profile ON search_history(profile_id, created_at DESC);

-- ============================================================
-- 7. AI 对话画像记录
-- ============================================================
CREATE TABLE IF NOT EXISTS user_ai_interactions (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id VARCHAR(100) NOT NULL,
  interaction_type VARCHAR(30) NOT NULL,  -- 'question', 'recommendation', 'profile_update'
  content TEXT,
  extracted_interests JSONB DEFAULT '[]',  -- 提取出的兴趣标签
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_ai_profile ON user_ai_interactions(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_ai_session ON user_ai_interactions(session_id);

-- ============================================================
-- 8. 用户画像统计视图
-- ============================================================
CREATE OR REPLACE VIEW user_profile_stats AS
SELECT
  p.id AS profile_id,
  -- 行为统计
  (SELECT COUNT(*) FROM user_behaviors ub WHERE ub.profile_id = p.id) AS total_behaviors,
  (SELECT COUNT(*) FROM user_behaviors ub WHERE ub.profile_id = p.id AND ub.behavior_type = 'view') AS view_count,
  (SELECT COUNT(*) FROM user_behaviors ub WHERE ub.profile_id = p.id AND ub.behavior_type = 'search') AS search_count,
  (SELECT COUNT(*) FROM user_behaviors ub WHERE ub.profile_id = p.id AND ub.behavior_type = 'favorite') AS favorite_count,
  (SELECT COUNT(*) FROM user_behaviors ub WHERE ub.profile_id = p.id AND ub.behavior_type = 'apply') AS apply_count,
  -- 搜索历史
  (SELECT COUNT(*) FROM search_history sh WHERE sh.profile_id = p.id) AS search_history_count,
  -- AI 交互
  (SELECT COUNT(*) FROM user_ai_interactions uai WHERE uai.profile_id = p.id) AS ai_interaction_count,
  -- 兴趣标签数
  (SELECT COUNT(*) FROM user_interest_scores uis WHERE uis.profile_id = p.id) AS interest_count,
  -- 活跃度（最近7天行为数）
  (SELECT COUNT(*) FROM user_behaviors ub
   WHERE ub.profile_id = p.id
   AND ub.created_at > NOW() - INTERVAL '7 days') AS active_7d
FROM profiles p;

COMMENT ON VIEW user_profile_stats IS '用户画像统计视图，包含行为计数和活跃度';
