-- ============================================================
-- 内推管理功能迁移
-- v1.4: 新增 referrals 表
-- ============================================================

-- ============================================================
-- referrals - 内推信息表
-- ============================================================
CREATE TABLE IF NOT EXISTS referrals (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  job_title VARCHAR(255),
  referrer_name VARCHAR(255),
  referrer_contact VARCHAR(255),
  referral_code VARCHAR(255),
  entry_url TEXT,
  notes TEXT,
  source VARCHAR(50) DEFAULT 'manual',
  source_ref VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_referrals_profile ON referrals(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_company ON referrals(company_name);
CREATE INDEX IF NOT EXISTS idx_referrals_created ON referrals(created_at DESC);

-- ============================================================
-- referral_usage_logs - 内推使用记录
-- ============================================================
CREATE TABLE IF NOT EXISTS referral_usage_logs (
  id BIGSERIAL PRIMARY KEY,
  referral_id BIGINT NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  job_id BIGINT REFERENCES jobs(id) ON DELETE SET NULL,
  application_id BIGINT REFERENCES applications(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_referral_usage_referral ON referral_usage_logs(referral_id);

-- ============================================================
-- 注释
-- ============================================================
COMMENT ON TABLE referrals IS '内推信息管理';
COMMENT ON COLUMN referrals.source IS '来源: manual=手动添加, import=批量导入, feishu=飞书';
COMMENT ON COLUMN referrals.status IS '状态: active=活跃, archived=归档';
