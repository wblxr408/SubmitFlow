-- ============================================================
-- 修复基础数据完整性
-- ============================================================

-- 确保默认 profile 存在（id=1 是系统默认值）
INSERT INTO profiles (id, mode, created_at, updated_at)
VALUES (1, 'default', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 为默认 profile 初始化用户标签偏好（所有预设标签，权重为0）
INSERT INTO tags (slug, label, group_name, color_hex, is_preset)
SELECT slug, label, group_name, color_hex, TRUE
FROM (
  VALUES
    ('python', 'Python', '编程语言', '#3572A5'),
    ('java', 'Java', '编程语言', '#B07219'),
    ('javascript', 'JavaScript', '编程语言', '#F1E05A'),
    ('typescript', 'TypeScript', '编程语言', '#3178C6'),
    ('cpp', 'C/C++', '编程语言', '#F34B7D'),
    ('go', 'Go', '编程语言', '#00ADD8'),
    ('rust', 'Rust', '编程语言', '#DEA584'),
    ('scala', 'Scala', '编程语言', '#DC322F'),
    ('sql', 'SQL', '编程语言', '#E38C00'),
    ('react', 'React', '前端框架', '#61DAFB'),
    ('vue', 'Vue', '前端框架', '#41B883'),
    ('nextjs', 'Next.js', '前端框架', '#000000'),
    ('css', 'CSS / SCSS', '前端工具', '#563D7C'),
    ('tailwind', 'Tailwind CSS', '前端工具', '#38B2AC'),
    ('spring', 'Spring', '后端框架', '#6DB33F'),
    ('springboot', 'Spring Boot', '后端框架', '#6DB33F'),
    ('django', 'Django', '后端框架', '#092E20'),
    ('flask', 'Flask', '后端框架', '#000000'),
    ('fastapi', 'FastAPI', '后端框架', '#009688'),
    ('gin', 'Gin', '后端框架', '#00ADD8'),
    ('nodejs', 'Node.js', '后端框架', '#339933'),
    ('express', 'Express', '后端框架', '#000000'),
    ('kafka', 'Kafka', '中间件', '#231F20'),
    ('rabbitmq', 'RabbitMQ', '中间件', '#FF6600'),
    ('redis', 'Redis', '数据库', '#DC382D'),
    ('postgresql', 'PostgreSQL', '数据库', '#336791'),
    ('mysql', 'MySQL', '数据库', '#4479A1'),
    ('mongodb', 'MongoDB', '数据库', '#47A248'),
    ('elasticsearch', 'Elasticsearch', '数据库', '#005571'),
    ('docker', 'Docker', 'DevOps', '#2496ED'),
    ('kubernetes', 'Kubernetes', 'DevOps', '#326CE5'),
    ('jenkins', 'Jenkins', 'DevOps', '#D33833'),
    ('git', 'Git', 'DevOps', '#F05032'),
    ('aws', 'AWS', '云服务', '#FF9900'),
    ('azure', 'Azure', '云服务', '#0078D4'),
    ('gcp', 'GCP', '云服务', '#4285F4'),
    ('pytorch', 'PyTorch', 'AI框架', '#EE4C2C'),
    ('tensorflow', 'TensorFlow', 'AI框架', '#FF6F00'),
    ('huggingface', 'HuggingFace', 'AI框架', '#FFD21E'),
    ('langchain', 'LangChain', 'AI应用', '#1A4B84'),
    ('llm', 'LLM / 大模型', 'AI应用', '#7C3AED'),
    ('nlp', 'NLP', 'AI方向', '#4B8BBE'),
    ('cv', '计算机视觉', 'AI方向', '#CC0000'),
    ('ml', '机器学习', 'AI方向', '#FF6F00'),
    ('dl', '深度学习', 'AI方向', '#00A1D0'),
    ('rl', '强化学习', 'AI方向', '#9B59B6'),
    ('gnn', '图神经网络', 'AI方向', '#E53527'),
    ('mm', '多模态', 'AI方向', '#F59E0B'),
    ('rlhf', 'RLHF', 'AI方向', '#10B981'),
    ('agi', 'AGI / 通用人工智能', 'AI方向', '#EF4444')
) AS t(slug, label, group_name, color_hex)
ON CONFLICT (slug) DO NOTHING;

-- 确保 user_ranking_prefs 存在
INSERT INTO user_ranking_prefs (profile_id, fame_weight, match_weight, city_weight, deadline_weight, conversion_weight, created_at, updated_at)
VALUES (1, 0.2, 0.2, 0.2, 0.2, 0.2, NOW(), NOW())
ON CONFLICT (profile_id) DO NOTHING;
