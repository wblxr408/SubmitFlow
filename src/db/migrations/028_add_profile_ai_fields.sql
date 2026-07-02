-- ============================================================
-- 为 profiles 表添加 AI 建档相关字段
-- ============================================================

-- 添加感兴趣/不感兴趣方向字段
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interested_directions TEXT[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS uninterested_directions TEXT[] DEFAULT '{}';

-- 添加 AI 建档结果 JSON 字段
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_profile_result JSONB DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_profile_version VARCHAR(20) DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_profile_updated_at TIMESTAMPTZ DEFAULT NULL;
