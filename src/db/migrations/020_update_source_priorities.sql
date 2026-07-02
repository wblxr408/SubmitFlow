-- ============================================================
-- Migration 020: Update source priorities (tiered crawl order)
-- Tier 1 (优先抓取): 官网直接投递=10, 内推鸭=9
-- Tier 2 (次优先):   高校就业网=8, 牛客网=7
-- Tier 3 (标准):     实习僧=6, 应届生求职网=6, 前程无忧=5, BOSS直聘=5
-- Tier 4 (补充):     脉脉=4, 天眼查=3, 小红书=2
-- ============================================================

UPDATE job_sources SET priority = 10 WHERE source_name = '官网直接投递';
UPDATE job_sources SET priority = 9  WHERE source_name = '内推鸭';
UPDATE job_sources SET priority = 8  WHERE source_name = '高校就业网';
UPDATE job_sources SET priority = 7  WHERE source_name = '牛客网';
UPDATE job_sources SET priority = 6  WHERE source_name = '实习僧';
UPDATE job_sources SET priority = 6  WHERE source_name = '应届生求职网';
UPDATE job_sources SET priority = 5  WHERE source_name = '前程无忧';
UPDATE job_sources SET priority = 5  WHERE source_name = 'BOSS直聘';
UPDATE job_sources SET priority = 4  WHERE source_name = '脉脉';
UPDATE job_sources SET priority = 3  WHERE source_name = '天眼查';
UPDATE job_sources SET priority = 2  WHERE source_name = '小红书';

-- Verify
DO $$
DECLARE
  src_count INT;
BEGIN
  SELECT COUNT(*) INTO src_count FROM job_sources WHERE is_enabled = TRUE;
  RAISE NOTICE 'job_sources enabled count: %', src_count;
END $$;
