-- ============================================================
-- 迁移 009: 性能优化索引
-- 针对大数据量查询场景优化
-- ============================================================

-- 复合索引：按状态和时间排序（热门城市优先）
CREATE INDEX IF NOT EXISTS idx_jobs_status_last_seen ON jobs(status, last_seen_at DESC);

-- 复合索引：按状态和截止日期排序
CREATE INDEX IF NOT EXISTS idx_jobs_status_deadline ON jobs(status, deadline);

-- 复合索引：按公司和状态（用于公司维度筛选）
CREATE INDEX IF NOT EXISTS idx_jobs_company_status ON jobs(company_id, status);

-- 热门城市部分索引（高频城市优化查询性能）
CREATE INDEX IF NOT EXISTS idx_jobs_city_hot ON jobs(city)
  WHERE city IN ('北京', '上海', '深圳', '杭州', '广州', '成都', '南京', '武汉', '西安', '苏州');

-- 公司知名度降序索引（用于榜单排序）
CREATE INDEX IF NOT EXISTS idx_companies_fame ON companies(fame_score DESC);

-- 标签组合查询优化（反向索引，加速标签筛选）
CREATE INDEX IF NOT EXISTS idx_job_tags_tag_job ON job_tags(tag_id, job_id);

-- 应用投递状态索引（加速投递看板查询）
CREATE INDEX IF NOT EXISTS idx_applications_status_applied ON applications(status, applied_at DESC NULLS LAST);
