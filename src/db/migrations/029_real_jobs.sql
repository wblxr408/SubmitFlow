-- ============================================================
-- 029: 旧版种子数据迁移（已废弃）
-- 官网岗位改由 CompanyCareersAdapter 爬虫实时抓取（见 030）
-- 此迁移仅清理旧数据
-- ============================================================

DO $$
BEGIN
  -- 清理任何残留的 real_seed 数据（由早期迁移残留）
  DELETE FROM job_entrypoints WHERE job_entrypoints.job_id IN (
    SELECT id FROM jobs WHERE jobs.canonical_source = 'real_seed'
  );
  DELETE FROM jobs WHERE jobs.canonical_source = 'real_seed';
  RAISE NOTICE 'Migration 029: cleaned up legacy real_seed data';
END $$;
