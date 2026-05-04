-- ============================================================
-- 种子数据
-- ============================================================

-- 默认 profile
INSERT INTO profiles (id, mode, created_at, updated_at)
VALUES (1, 'default', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- AI 服务商
-- ============================================================
INSERT INTO ai_providers (provider_key, display_name, adapter_type, is_system_enabled)
VALUES
  ('openai', 'OpenAI / GPT', 'openai', TRUE),
  ('anthropic', 'Anthropic / Claude', 'anthropic', TRUE),
  ('zhipu', '智谱 AI / GLM', 'zhipuai', TRUE),
  ('qwen', '阿里通义 / Qwen', 'qwen', TRUE),
  ('minimax', 'MiniMax', 'minimax', TRUE),
  ('moonshot', '月之暗面 / Kimi', 'moonshot', TRUE),
  ('mimo', '字节 Mimo', 'mimo', TRUE),
  ('deepseek', 'DeepSeek', 'deepseek', TRUE)
ON CONFLICT (provider_key) DO NOTHING;

-- ============================================================
-- 预设标签（按 group_name 分组）
-- ============================================================
INSERT INTO tags (slug, label, group_name, color_hex, is_preset) VALUES
  -- 编程语言
  ('python', 'Python', '编程语言', '#3572A5', TRUE),
  ('java', 'Java', '编程语言', '#B07219', TRUE),
  ('javascript', 'JavaScript', '编程语言', '#F1E05A', TRUE),
  ('typescript', 'TypeScript', '编程语言', '#3178C6', TRUE),
  ('cpp', 'C/C++', '编程语言', '#F34B7D', TRUE),
  ('go', 'Go', '编程语言', '#00ADD8', TRUE),
  ('rust', 'Rust', '编程语言', '#DEA584', TRUE),
  ('scala', 'Scala', '编程语言', '#DC322F', TRUE),
  ('sql', 'SQL', '编程语言', '#E38C00', TRUE),

  -- 前端
  ('react', 'React', '前端框架', '#61DAFB', TRUE),
  ('vue', 'Vue', '前端框架', '#41B883', TRUE),
  ('nextjs', 'Next.js', '前端框架', '#000000', TRUE),
  ('css', 'CSS / SCSS', '前端工具', '#563D7C', TRUE),
  ('tailwind', 'Tailwind CSS', '前端工具', '#38B2AC', TRUE),

  -- 后端
  ('spring', 'Spring', '后端框架', '#6DB33F', TRUE),
  ('springboot', 'Spring Boot', '后端框架', '#6DB33F', TRUE),
  ('django', 'Django', '后端框架', '#092E20', TRUE),
  ('flask', 'Flask', '后端框架', '#000000', TRUE),
  ('gin', 'Gin', '后端框架', '#00ADD8', TRUE),
  ('nodejs', 'Node.js', '后端框架', '#339933', TRUE),
  ('fastapi', 'FastAPI', '后端框架', '#009688', TRUE),

  -- 数据库
  ('mysql', 'MySQL', '数据库', '#4479A1', TRUE),
  ('postgresql', 'PostgreSQL', '数据库', '#336791', TRUE),
  ('mongodb', 'MongoDB', '数据库', '#47A248', TRUE),
  ('redis', 'Redis', '数据库', '#DC382D', TRUE),
  ('elasticsearch', 'Elasticsearch', '数据库', '#005571', TRUE),

  -- 机器学习
  ('pytorch', 'PyTorch', '机器学习', '#EE4C2C', TRUE),
  ('tensorflow', 'TensorFlow', '机器学习', '#FF6F00', TRUE),
  ('sklearn', 'Scikit-learn', '机器学习', '#F7931E', TRUE),
  ('ml', '机器学习', 'AI方向', '#4B0082', TRUE),
  ('cv', '计算机视觉', 'AI方向', '#4B0082', TRUE),
  ('nlp', 'NLP / 大模型', 'AI方向', '#4B0082', TRUE),
  ('llm', 'LLM / AIGC', 'AI方向', '#4B0082', TRUE),
  ('rl', '强化学习', 'AI方向', '#4B0082', TRUE),

  -- 数据
  ('spark', 'Spark', '大数据', '#E25A1C', TRUE),
  ('hadoop', 'Hadoop', '大数据', '#CC0000', TRUE),
  ('flink', 'Flink', '大数据', '#E6526F', TRUE),
  ('kafka', 'Kafka', '大数据', '#231F20', TRUE),

  -- 基础设施
  ('docker', 'Docker', '基础设施', '#2496ED', TRUE),
  ('k8s', 'Kubernetes', '基础设施', '#326CE5', TRUE),
  ('aws', 'AWS', '云服务', '#FF9900', TRUE),
  ('gcp', 'GCP', '云服务', '#4285F4', TRUE),
  ('azure', 'Azure', '云服务', '#0078D4', TRUE),
  ('linux', 'Linux', '基础设施', '#FCC624', TRUE),
  ('cicd', 'CI/CD', 'DevOps', '#40B9C4', TRUE),

  -- 安全
  ('security', '安全', '安全方向', '#D71A1B', TRUE),
  ('reverse', '逆向工程', '安全方向', '#D71A1B', TRUE),
  ('crypto', '密码学', '安全方向', '#D71A1B', TRUE),

  -- 产品
  ('pm', '产品经理', '产品方向', '#E91E63', TRUE),
  ('design', 'UI/UX设计', '产品方向', '#9C27B0', TRUE);

-- ============================================================
-- 知识图谱种子数据
-- ============================================================
INSERT INTO graph_nodes (id, parent_id, level, label, sort_order)
VALUES (1, NULL, 1, '技术方向', 1)
ON CONFLICT DO NOTHING;

-- Level 2 nodes
INSERT INTO graph_nodes (id, parent_id, level, label, sort_order)
VALUES
  (10, 1, 2, '后端开发', 1),
  (11, 1, 2, '前端开发', 2),
  (12, 1, 2, '算法/AI', 3),
  (13, 1, 2, '基础架构', 4)
ON CONFLICT DO NOTHING;

-- Level 3 nodes
INSERT INTO graph_nodes (parent_id, level, label, sort_order)
VALUES
  -- 后端
  (10, 3, 'Java / Spring', 1),
  (10, 3, 'Go / Gin', 2),
  (10, 3, 'Python / FastAPI', 3),
  (10, 3, 'Node.js', 4),
  -- 前端
  (11, 3, 'React / Next.js', 1),
  (11, 3, 'Vue / Nuxt', 2),
  (11, 3, '移动端开发', 3),
  -- 算法/AI
  (12, 3, '机器学习', 1),
  (12, 3, 'NLP / 大模型', 2),
  (12, 3, '计算机视觉', 3),
  (12, 3, '推荐/搜索', 4),
  (12, 3, '强化学习', 5),
  -- 基础架构
  (13, 3, '云原生 / K8s', 1),
  (13, 3, '大数据', 2),
  (13, 3, 'DevOps / SRE', 3),
  (13, 3, '数据库内核', 4);

-- ============================================================
-- 首批公司种子
-- ============================================================
INSERT INTO companies (name, fame_score, size, industry)
VALUES
  ('字节跳动', 95, '大型', '互联网'),
  ('阿里巴巴', 93, '大型', '互联网'),
  ('腾讯', 92, '大型', '互联网'),
  ('美团', 88, '大型', '互联网'),
  ('小米', 85, '大型', '互联网/硬件'),
  ('华为', 90, '大型', '科技'),
  ('京东', 86, '大型', '互联网'),
  ('百度', 84, '大型', '互联网'),
  ('网易', 82, '大型', '互联网'),
  ('快手', 83, '大型', '互联网'),
  ('B站', 80, '中型', '互联网'),
  ('滴滴', 81, '大型', '互联网'),
  ('商汤科技', 78, '中型', 'AI'),
  ('旷视科技', 76, '中型', 'AI'),
  ('大疆', 83, '中型', '硬件/AI')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 抓取来源种子
-- ============================================================
INSERT INTO job_sources (source_name, source_type, priority)
VALUES
  ('官网直接投递', 'public', 10),
  ('牛客网', 'public', 8),
  ('脉脉', 'public_referral', 7),
  ('小红书', 'private_import', 5),
  ('内推鸭', 'public_referral', 6)
ON CONFLICT (source_name) DO NOTHING;
