-- ============================================================
-- Migration 019: Clean up dirty crawl data
-- Removes: 社招 jobs, obvious non-tech job titles
-- Policy: Keep ALL tech-related job titles (company industry doesn't matter)
--         Only remove pure non-tech titles (经纪人/置业顾问/etc.)
-- ============================================================

-- Step 1: Mark 社招 jobs as invalid
UPDATE jobs
SET    status = 'invalid',
       updated_at = NOW()
WHERE  internship_type = '社招'
   AND status = 'valid';

-- Step 2: Mark obvious non-tech titles as invalid
-- Keep any job that has even ONE tech keyword in the title
-- Only remove jobs with purely non-tech titles
UPDATE jobs
SET    status = 'invalid',
       updated_at = NOW()
WHERE  status = 'valid'
  AND  (
    -- Obvious non-tech role patterns
    title ~* '经纪人|置业顾问|房产中介|房产销售|楼盘销售|房产经纪人'
    OR
    title ~* '销售代表|客户经理|电话销售|网络销售|商务代表'
    OR
    title ~* '行政专员|行政助理|前台接待|文员|文秘'
    OR
    title ~* '人事专员|人事助理|招聘专员|HR专员|人力资源专员'
    OR
    title ~* '财务专员|会计|出纳|审计专员|税务专员'
    OR
    title ~* '店员|营业员|收银员|导购|服务员|厨工|厨师'
    OR
    title ~* '保安|保洁|绿化工|物业管理员|仓库管理员'
    OR
    title ~* '普工|操作工|装配工|焊工|车工|钳工|叉车司机'
    OR
    title ~* '快递员|外卖员|配送员|货运司机|出租车司机'
    OR
    title ~* '投顾|理财经理|柜员|银行柜员|客户经理.*银行'
  )
  -- BUT always keep if title contains any tech keyword
  AND  title !~* '算法|开发|测试|安全|数据|运营|产品|运维|研发|前端|后端|全栈|客户端|服务端|AI|人工智能|机器学习|深度学习|云计算|云原生|大模型|NLP|推荐|搜索|架构|性能|游戏|策划|美术|发行|渠道|电商|自动驾驶|芯片|半导体|嵌入式|物联网|智能硬件|网络|通信|数据库|缓存|中间件|微服务|DevOps|SRE|ERP|SAP|Unity|Unreal|图形|渲染|量化|策略|因子|交易'
RETURNING id, title, internship_type;

-- Step 3: Remove orphaned job_entrypoints for invalid jobs
DELETE FROM job_entrypoints je
USING jobs j
WHERE  je.job_id = j.id
  AND  j.status = 'invalid';

-- Step 4: Print summary
DO $$
DECLARE
  total_jobs     INT;
  total_valid   INT;
  total_invalid INT;
  shezha_count  INT;
  feitech_count INT;
BEGIN
  SELECT COUNT(*) INTO total_jobs     FROM jobs;
  SELECT COUNT(*) INTO total_valid   FROM jobs WHERE status = 'valid';
  SELECT COUNT(*) INTO total_invalid FROM jobs WHERE status = 'invalid';
  SELECT COUNT(*) INTO shezha_count  FROM jobs WHERE internship_type = '社招' AND status = 'invalid';
  SELECT COUNT(*) INTO feitech_count FROM jobs
    WHERE status = 'invalid' AND COALESCE(internship_type,'') != '社招';

  RAISE NOTICE '';
  RAISE NOTICE '=== Job Cleanup Summary ===';
  RAISE NOTICE 'Total jobs in DB:  %', total_jobs;
  RAISE NOTICE 'Valid jobs kept:   %', total_valid;
  RAISE NOTICE 'Invalid jobs:      %', total_invalid;
  RAISE NOTICE '  - from 社招:     %', shezha_count;
  RAISE NOTICE '  - from non-tech: %', feitech_count;
  RAISE NOTICE '==========================';
END $$;
