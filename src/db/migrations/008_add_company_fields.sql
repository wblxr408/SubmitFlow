-- ============================================================
-- 迁移 008: 扩展公司表字段
-- 支持更丰富的公司信息和筛选能力
-- ============================================================

-- 二级行业分类
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sub_industry VARCHAR(100);

-- 是否热点公司（用于推荐加权）
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_hot BOOLEAN NOT NULL DEFAULT FALSE;

-- 转正率等级（替代精确百分比，便于用户理解）
ALTER TABLE companies ADD COLUMN IF NOT EXISTS conversion_level VARCHAR(20);

-- 员工规模范围
ALTER TABLE companies ADD COLUMN IF NOT EXISTS headcount_range VARCHAR(50);

-- 成立年份
ALTER TABLE companies ADD COLUMN IF NOT EXISTS established_year INT;

-- 总部城市
ALTER TABLE companies ADD COLUMN IF NOT EXISTS headquarters VARCHAR(100);

-- 补充公司规模枚举值
COMMENT ON COLUMN companies.size IS '巨头|大型|中型|小型';
COMMENT ON COLUMN companies.conversion_level IS '极高|高|中|低';
COMMENT ON COLUMN companies.headcount_range IS '10000+|5000-9999|1000-4999|500-999|100-499|<100';
