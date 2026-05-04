-- ============================================================
-- v1.5 用户画像与推荐系统增强
-- 1. 负反馈表（dismissed_jobs）：用户明确不感兴趣的岗位
-- 2. 用户-岗位交互表（user_job_interactions）：细粒度交互记录
-- 3. 兴趣衰减配置表（interest_decay_config）
-- 4. 协同过滤辅助表（user_similarity）
-- ============================================================

-- ============================================================
-- 1. 负反馈表：存储用户明确不感兴趣的岗位
-- ============================================================
CREATE TABLE IF NOT EXISTS dismissed_jobs (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  reason VARCHAR(50),  -- 'not_interested', 'wrong_location', 'wrong_skills', 'expired', 'other'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, job_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_dismissed_jobs_profile ON dismissed_jobs(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dismissed_jobs_job ON dismissed_jobs(job_id) WHERE job_id IS NOT NULL;

COMMENT ON TABLE dismissed_jobs IS '用户负反馈表，记录用户明确不感兴趣的岗位';
COMMENT ON COLUMN dismissed_jobs.reason IS '负反馈原因：not_interested(不感兴趣), wrong_location(地点不符), wrong_skills(技能不符), expired(已过期), other(其他)';

-- ============================================================
-- 2. 用户-岗位细粒度交互表
-- ============================================================
CREATE TABLE IF NOT EXISTS user_job_interactions (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  interaction_type VARCHAR(30) NOT NULL,  -- 'view', 'view_detail', 'search_result', 'recommendation_shown', 'recommendation_click', 'apply', 'favorite', 'dismiss'
  interaction_score NUMERIC(3, 2) NOT NULL DEFAULT 0.00,  -- 交互强度 0.00-1.00
  session_id VARCHAR(100),
  referrer VARCHAR(50),  -- 'search', 'recommendation', 'favorite', 'direct'
  position_index INT,    -- 在列表中的位置（用于计算位置偏差）
  dwell_time_ms INT,     -- 停留时间（毫秒）
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, job_id, interaction_type, created_at)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_job_interactions_profile ON user_job_interactions(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_job_interactions_job ON user_job_interactions(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_job_interactions_type ON user_job_interactions(profile_id, interaction_type, created_at DESC);

COMMENT ON TABLE user_job_interactions IS '用户-岗位细粒度交互表，记录所有与岗位相关的交互行为';
COMMENT ON COLUMN user_job_interactions.interaction_score IS '交互强度评分：0.00-1.00，基于停留时间、点击位置等计算';

-- ============================================================
-- 3. 兴趣衰减配置表
-- ============================================================
CREATE TABLE IF NOT EXISTS interest_decay_config (
  id BIGSERIAL PRIMARY KEY,
  interest_type VARCHAR(30) NOT NULL,  -- 'company', 'position', 'industry', 'skill', 'city'
  decay_rate_daily NUMERIC(5, 4) NOT NULL DEFAULT 0.0100,  -- 每日衰减率（默认 1%）
  min_score NUMERIC(5, 4) NOT NULL DEFAULT 0.0001,          -- 最低分数阈值
  half_life_days INT NOT NULL DEFAULT 60,                   -- 半衰期天数
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(interest_type)
);

-- 插入默认配置
INSERT INTO interest_decay_config (interest_type, decay_rate_daily, min_score, half_life_days) VALUES
  ('company', 0.0080, 0.0010, 90),    -- 公司：较慢衰减，半衰期 90 天
  ('position', 0.0100, 0.0010, 70),   -- 职位方向：中等衰减
  ('industry', 0.0060, 0.0010, 120),  -- 行业：缓慢衰减
  ('skill', 0.0120, 0.0010, 60),      -- 技能：较快衰减
  ('city', 0.0050, 0.0010, 180)       -- 城市：最慢衰减（偏好稳定）
ON CONFLICT (interest_type) DO NOTHING;

COMMENT ON TABLE interest_decay_config IS '兴趣衰减配置表，定义不同类型兴趣的自然衰减率';

-- ============================================================
-- 4. 用户相似度表（协同过滤辅助）
-- ============================================================
CREATE TABLE IF NOT EXISTS user_similarity (
  id BIGSERIAL PRIMARY KEY,
  profile_id_1 BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  profile_id_2 BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  similarity_score NUMERIC(5, 4) NOT NULL DEFAULT 0.0000,  -- 0.0000-1.0000
  common_interests JSONB DEFAULT '[]',  -- 共同兴趣列表
  common_count INT NOT NULL DEFAULT 0,   -- 共同兴趣数
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id_1, profile_id_2)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_similarity_profile1 ON user_similarity(profile_id_1, similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_similarity_profile2 ON user_similarity(profile_id_2, similarity_score DESC);

COMMENT ON TABLE user_similarity IS '用户相似度表，用于协同过滤推荐';

-- ============================================================
-- 5. 增强 user_interest_scores 表：添加衰减相关字段
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_interest_scores' AND column_name = 'decay_factor'
  ) THEN
    ALTER TABLE user_interest_scores ADD COLUMN decay_factor NUMERIC(5, 4) NOT NULL DEFAULT 1.0000;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_interest_scores' AND column_name = 'peak_score'
  ) THEN
    ALTER TABLE user_interest_scores ADD COLUMN peak_score NUMERIC(5, 4) NOT NULL DEFAULT 0.0000;
  END IF;
END $$;

COMMENT ON COLUMN user_interest_scores.decay_factor IS '衰减因子：0.0001-1.0000，基于时间衰减和兴趣类型';
COMMENT ON COLUMN user_interest_scores.peak_score IS '历史最高分，用于计算衰减后的相对强度';

-- ============================================================
-- 6. 推荐多样性配置表
-- ============================================================
CREATE TABLE IF NOT EXISTS recommendation_diversity_config (
  id BIGSERIAL PRIMARY KEY,
  preset_name VARCHAR(50) NOT NULL UNIQUE,
  exploration_ratio NUMERIC(3, 2) NOT NULL DEFAULT 0.20,  -- 探索比例（长尾/新机会）
  popularity_ratio NUMERIC(3, 2) NOT NULL DEFAULT 0.30,    -- 热门比例
  diversity_penalty NUMERIC(3, 2) NOT NULL DEFAULT 0.10,   -- 多样性惩罚系数
  min_company_distance INT NOT NULL DEFAULT 2,            -- 同公司岗位最小间隔
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 插入默认配置
INSERT INTO recommendation_diversity_config (preset_name, exploration_ratio, popularity_ratio, diversity_penalty, min_company_distance) VALUES
  ('保守型', 0.10, 0.40, 0.15, 3),   -- 少探索，多热门
  ('平衡型', 0.20, 0.30, 0.10, 2),   -- 平衡
  ('探索型', 0.35, 0.20, 0.05, 1)    -- 多探索，少热门
ON CONFLICT (preset_name) DO NOTHING;

COMMENT ON TABLE recommendation_diversity_config IS '推荐多样性配置，控制探索/热门/长尾比例';

-- ============================================================
-- 7. 创建兴趣衰减函数
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_interest_decay(
  p_interest_type VARCHAR,
  p_last_behavior_at TIMESTAMPTZ,
  p_current_score NUMERIC
) RETURNS NUMERIC(5, 4) AS $$
DECLARE
  v_decay_rate NUMERIC(5, 4);
  v_days_elapsed INT;
  v_decay_factor NUMERIC(5, 4);
BEGIN
  -- 获取衰减率配置
  SELECT decay_rate_daily INTO v_decay_rate
  FROM interest_decay_config
  WHERE interest_type = p_interest_type;

  -- 默认衰减率
  IF v_decay_rate IS NULL THEN
    v_decay_rate := 0.0100;
  END IF;

  -- 计算天数
  v_days_elapsed := GREATEST(0, EXTRACT(EPOCH FROM (NOW() - p_last_behavior_at)) / 86400);

  -- 指数衰减
  v_decay_factor := POWER((1 - v_decay_rate), v_days_elapsed);

  RETURN GREATEST(0.0001, v_decay_factor);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_interest_decay IS '计算兴趣衰减因子，使用指数衰减模型';

-- ============================================================
-- 8. 定时任务：批量更新兴趣衰减（建议每日执行）
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_interest_decay() RETURNS void AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id, interest_type, last_behavior_at, score, peak_score
    FROM user_interest_scores
    WHERE score > 0.0001
  LOOP
    UPDATE user_interest_scores
    SET
      decay_factor = calculate_interest_decay(rec.interest_type, rec.last_behavior_at, rec.score),
      score = GREATEST(0.0001, rec.peak_score * calculate_interest_decay(rec.interest_type, rec.last_behavior_at, rec.score)),
      updated_at = NOW()
    WHERE id = rec.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 9. 创建用户相似度计算函数
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_user_similarity(
  p_profile_id_1 BIGINT,
  p_profile_id_2 BIGINT
) RETURNS NUMERIC(5, 4) AS $$
DECLARE
  v_common_interests JSONB;
  v_common_count INT;
  v_similarity NUMERIC(5, 4);
  v_cosine1 NUMERIC;
  v_cosine2 NUMERIC;
BEGIN
  -- 找出共同兴趣
  SELECT
    jsonb_agg(jsonb_build_object(
      'interest_type', i1.interest_type,
      'interest_key', i1.interest_key,
      'score1', i1.score,
      'score2', i2.score
    )),
    COUNT(*)
  INTO v_common_interests, v_common_count
  FROM user_interest_scores i1
  JOIN user_interest_scores i2
    ON i1.interest_type = i2.interest_type
    AND i1.interest_key = i2.interest_key
    AND i2.profile_id = p_profile_id_2
  WHERE i1.profile_id = p_profile_id_1
    AND i1.score > 0.1
    AND i2.score > 0.1;

  IF v_common_count = 0 THEN
    RETURN 0.0000;
  END IF;

  -- 计算余弦相似度
  SELECT
    SQRT(SUM(POWER(i1.score, 2))),
    SQRT(SUM(POWER(i2.score, 2)))
  INTO v_cosine1, v_cosine2
  FROM user_interest_scores i1
  JOIN user_interest_scores i2
    ON i1.interest_type = i2.interest_type
    AND i1.interest_key = i2.interest_key
  WHERE i1.profile_id = p_profile_id_1
    AND i2.profile_id = p_profile_id_2;

  IF v_cosine1 = 0 OR v_cosine2 = 0 THEN
    RETURN 0.0000;
  END IF;

  -- 计算加权余弦相似度（考虑共同兴趣数量）
  SELECT
    SUM(i1.score * i2.score) / (v_cosine1 * v_cosine2) * LEAST(1.0, v_common_count / 10.0)
  INTO v_similarity
  FROM user_interest_scores i1
  JOIN user_interest_scores i2
    ON i1.interest_type = i2.interest_type
    AND i1.interest_key = i2.interest_key
  WHERE i1.profile_id = p_profile_id_1
    AND i2.profile_id = p_profile_id_2;

  RETURN GREATEST(0.0000, LEAST(1.0000, COALESCE(v_similarity, 0.0000)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- 10. 创建相似用户岗位推荐函数
-- ============================================================
CREATE OR REPLACE FUNCTION get_similar_users_jobs(
  p_profile_id BIGINT,
  p_limit INT DEFAULT 20,
  p_min_similarity NUMERIC DEFAULT 0.1000
) RETURNS TABLE (
  job_id BIGINT,
  company_id BIGINT,
  title VARCHAR,
  city VARCHAR,
  score NUMERIC(5, 4)
) AS $$
BEGIN
  RETURN QUERY
  WITH similar_users AS (
    SELECT profile_id_2 AS profile_id, similarity_score
    FROM user_similarity
    WHERE profile_id_1 = p_profile_id
      AND similarity_score >= p_min_similarity
    UNION
    SELECT profile_id_1 AS profile_id, similarity_score
    FROM user_similarity
    WHERE profile_id_2 = p_profile_id
      AND similarity_score >= p_min_similarity
    ORDER BY similarity_score DESC
    LIMIT 20
  ),
  applied_jobs AS (
    SELECT job_id FROM applications WHERE profile_id = p_profile_id
  ),
  dismissed_job_ids AS (
    SELECT job_id FROM dismissed_jobs WHERE profile_id = p_profile_id
  ),
  user_job_scores AS (
    SELECT
      a.job_id,
      su.similarity_score,
      ROW_NUMBER() OVER (PARTITION BY a.job_id ORDER BY su.similarity_score DESC) AS rn
    FROM applications a
    JOIN similar_users su ON a.profile_id = su.profile_id
    WHERE a.job_id NOT IN (SELECT job_id FROM applied_jobs)
      AND a.job_id NOT IN (SELECT job_id FROM dismissed_job_ids)
      AND a.status NOT IN ('rejected', 'withdrawn')
  )
  SELECT
    ujs.job_id,
    j.company_id,
    j.title,
    j.city,
    MAX(ujs.similarity_score) AS score
  FROM user_job_scores ujs
  JOIN jobs j ON j.id = ujs.job_id
  WHERE ujs.rn = 1
  GROUP BY ujs.job_id, j.company_id, j.title, j.city
  ORDER BY score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 11. 创建热门岗位函数（用于冷启动）
-- ============================================================
CREATE OR REPLACE FUNCTION get_popular_jobs(
  p_profile_id BIGINT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_days INT DEFAULT 30
) RETURNS TABLE (
  job_id BIGINT,
  company_id BIGINT,
  title VARCHAR,
  city VARCHAR,
  popularity_score BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.id AS job_id,
    j.company_id,
    j.title,
    j.city,
    COALESCE(application_count.cnt, 0) + COALESCE(favorite_count.cnt, 0) AS popularity_score
  FROM jobs j
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::BIGINT AS cnt
    FROM applications a
    WHERE a.job_id = j.id
      AND a.created_at > NOW() - (p_days || ' days')::INTERVAL
  ) application_count ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::BIGINT AS cnt
    FROM job_favorites jf
    WHERE jf.job_id = j.id
      AND jf.created_at > NOW() - (p_days || ' days')::INTERVAL
  ) favorite_count ON TRUE
  WHERE j.status = 'active'
    AND (j.deadline IS NULL OR j.deadline > NOW())
    AND j.id NOT IN (
      SELECT job_id FROM dismissed_jobs WHERE profile_id = COALESCE(p_profile_id, 0)
    )
  ORDER BY popularity_score DESC, j.first_seen_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 12. 创建多样性推荐函数
-- ============================================================
CREATE OR REPLACE FUNCTION get_diverse_recommendations(
  p_profile_id BIGINT,
  p_limit INT DEFAULT 20,
  p_exploration_ratio NUMERIC DEFAULT 0.20,
  p_popularity_ratio NUMERIC DEFAULT 0.30
) RETURNS TABLE (
  job_id BIGINT,
  score NUMERIC(5, 4),
  source VARCHAR(20)
) AS $$
DECLARE
  v_explore_count INT;
  v_popular_count INT;
  v_collab_count INT;
BEGIN
  -- 计算各类别数量
  v_explore_count := GREATEST(1, (p_limit * p_exploration_ratio)::INT);
  v_popular_count := GREATEST(1, (p_limit * p_popularity_ratio)::INT);
  v_collab_count := p_limit - v_explore_count - v_popular_count;

  -- 探索型：长尾/新岗位
  RETURN QUERY
  SELECT
    j.id AS job_id,
    0.5 AS score,
    'exploration'::VARCHAR AS source
  FROM jobs j
  WHERE j.status = 'active'
    AND (j.deadline IS NULL OR j.deadline > NOW())
    AND j.id NOT IN (
      SELECT job_id FROM applications WHERE profile_id = p_profile_id
    )
    AND j.id NOT IN (
      SELECT job_id FROM dismissed_jobs WHERE profile_id = p_profile_id
    )
    AND j.first_seen_at > NOW() - INTERVAL '7 days'  -- 新发布
  ORDER BY RANDOM()
  LIMIT v_explore_count;

  -- 热门型
  RETURN QUERY
  SELECT
    pj.job_id,
    0.7 AS score,
    'popularity'::VARCHAR AS source
  FROM get_popular_jobs(p_profile_id, v_popular_count * 2, 30) pj
  ORDER BY pj.popularity_score DESC
  LIMIT v_popular_count;

  -- 协同过滤型
  RETURN QUERY
  SELECT
    sqj.job_id,
    sqj.score,
    'collaborative'::VARCHAR AS source
  FROM get_similar_users_jobs(p_profile_id, v_collab_count * 2, 0.15) sqj
  ORDER BY sqj.score DESC
  LIMIT v_collab_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 13. 更新 user_interest_scores 触发器：自动计算衰减
-- ============================================================
CREATE OR REPLACE FUNCTION update_interest_with_decay() RETURNS TRIGGER AS $$
DECLARE
  v_decay_factor NUMERIC(5, 4);
  v_new_score NUMERIC(5, 4);
BEGIN
  -- 计算衰减因子
  v_decay_factor := calculate_interest_decay(
    NEW.interest_type,
    NEW.last_behavior_at,
    NEW.score
  );

  -- 更新衰减因子和峰值
  IF NEW.score > NEW.peak_score THEN
    NEW.peak_score := NEW.score;
  END IF;

  NEW.decay_factor := v_decay_factor;
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS user_interest_scores_decay_trigger ON user_interest_scores;
CREATE TRIGGER user_interest_scores_decay_trigger
  BEFORE UPDATE ON user_interest_scores
  FOR EACH ROW
  WHEN (OLD.last_behavior_at IS DISTINCT FROM NEW.last_behavior_at OR OLD.score IS DISTINCT FROM NEW.score)
  EXECUTE FUNCTION update_interest_with_decay();
