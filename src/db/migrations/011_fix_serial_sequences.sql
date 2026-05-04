-- ============================================================
-- 迁移 011: 修复 users / profiles 的 SERIAL 序列
-- seed.sql 与 010 使用显式 id 插入后，序列未前进，下一笔自增仍会占用 id=1，
-- 导致注册新用户时出现 duplicate key value violates unique constraint "users_pkey"
-- ============================================================

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
