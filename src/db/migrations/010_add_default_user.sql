-- ============================================================
-- 迁移 010: 创建默认管理员用户
-- 在完成所有迁移后执行
-- 注意：生产环境请删除此用户
-- ============================================================

-- 创建默认管理员用户（密码：admin123）
-- 密码哈希使用 bcrypt，成本因子 12
-- 实际部署时请修改密码
INSERT INTO users (id, email, password_hash, nickname, role, is_active, email_verified, created_at, updated_at)
VALUES (
  1,
  'admin@submitflow.local',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyDAoyMTqg.fee',
  '管理员',
  'admin',
  TRUE,
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- 将 profile 1 关联到管理员用户
UPDATE profiles SET user_id = 1 WHERE user_id IS NULL AND id = 1;

-- 同步自增序列（显式插入 id=1 后必须执行，否则新用户注册会与 id=1 冲突）
SELECT setval(
  pg_get_serial_sequence('users', 'id'),
  COALESCE((SELECT MAX(id) FROM users), 1),
  true
);
SELECT setval(
  pg_get_serial_sequence('profiles', 'id'),
  COALESCE((SELECT MAX(id) FROM profiles), 1),
  true
);
