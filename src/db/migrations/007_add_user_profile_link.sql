-- ============================================================
-- 迁移 007: 建立用户与 Profile 关联
-- profiles 表添加 user_id 外键，实现多用户数据隔离
-- ============================================================

-- 添加 user_id 字段
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id) ON DELETE CASCADE;

-- 创建唯一索引（一个用户只能有一个 profile）
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id) WHERE user_id IS NOT NULL;

-- 更新现有 profile 关联到预留的管理员账户（后续迁移脚本会创建管理员）
-- 这里只添加约束，不迁移数据，由专门的迁移脚本处理 v1.2 兼容
