-- ============================================================
-- 岗位收藏功能迁移
-- v1.3: 新增 job_favorites 表
-- ============================================================

-- 收藏状态枚举
DO $$ BEGIN
  CREATE TYPE favorite_status AS ENUM (
    'active', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- job_favorites - 岗位收藏表
-- ============================================================
CREATE TABLE IF NOT EXISTS job_favorites (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  note TEXT,
  status VARCHAR(10) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, job_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_job_favorites_profile_status ON job_favorites(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_job_favorites_job ON job_favorites(job_id);
CREATE INDEX IF NOT EXISTS idx_job_favorites_created ON job_favorites(created_at DESC);

-- ============================================================
-- 注释
-- ============================================================
COMMENT ON TABLE job_favorites IS '用户收藏的岗位列表';
COMMENT ON COLUMN job_favorites.note IS '用户对收藏岗位的备注';
COMMENT ON COLUMN job_favorites.status IS '收藏状态: active=活跃, archived=归档';
