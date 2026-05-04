-- ============================================================
-- 用户画像增强迁移
-- v1.6: 新增画像方向字段 & 完善索引
-- ============================================================

-- profiles: 添加感兴趣/不感兴趣方向
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS interested_directions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS uninterested_directions TEXT[] DEFAULT '{}';

COMMENT ON COLUMN profiles.interested_directions IS '感兴趣方向（来自 AI 建档结果）';
COMMENT ON COLUMN profiles.uninterested_directions IS '不感兴趣方向（来自 AI 建档结果）';

-- resumes: 添加完整性约束
ALTER TABLE resumes
  ADD COLUMN IF NOT EXISTS profile_id BIGINT REFERENCES profiles(id) ON DELETE CASCADE;

-- 确保所有索引已创建
CREATE INDEX IF NOT EXISTS idx_profiles_graduation ON profiles(graduation_year);
CREATE INDEX IF NOT EXISTS idx_user_tag_prefs_weight ON user_tag_prefs(weight DESC);
