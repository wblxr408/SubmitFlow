import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/graph/taxonomy');

interface TagRow {
  id: number;
  slug: string;
  label: string;
  group_name: string | null;
}

interface StackItem {
  tag_id: number;
  slug: string;
  label: string;
  group_name: string;
  children?: StackItem[];
}

interface Track {
  id: string;
  label: string;
  stacks: StackItem[];
}

interface Direction {
  id: string;
  label: string;
  tracks: Track[];
}

function classifyTag(tag: TagRow): { direction: string; track: string } {
  const group = (tag.group_name ?? '').toLowerCase();
  const slug = tag.slug.toLowerCase();
  const label = tag.label.toLowerCase();
  const groupMap: Record<string, { direction: string; track: string }> = {
    编程语言: { direction: 'backend', track: 'programming_language' },
    前端框架: { direction: 'frontend', track: 'web_framework' },
    前端工具: { direction: 'frontend', track: 'web_framework' },
    前端工程化: { direction: 'frontend', track: 'web_framework' },
    客户端开发: { direction: 'frontend', track: 'web_framework' },
    后端框架: { direction: 'backend', track: 'backend_framework' },
    服务治理: { direction: 'backend', track: 'backend_framework' },
    数据库: { direction: 'backend', track: 'data_storage' },
    中间件: { direction: 'backend', track: 'data_storage' },
    机器学习: { direction: 'ai', track: 'ml_llm' },
    ai方向: { direction: 'ai', track: 'ml_llm' },
    大数据: { direction: 'data', track: 'bigdata' },
    基础设施: { direction: 'infra', track: 'cloud_devops' },
    云服务: { direction: 'infra', track: 'cloud_devops' },
    devops: { direction: 'infra', track: 'cloud_devops' },
    安全方向: { direction: 'security', track: 'security_core' },
    测试工程: { direction: 'qa', track: 'qa_testing' },
  };
  const normalizedGroup = group.trim();
  if (groupMap[normalizedGroup]) return groupMap[normalizedGroup];

  if (['react', 'vue', 'nextjs', 'javascript', 'typescript', 'css', 'tailwind'].includes(slug)) {
    return { direction: 'frontend', track: 'web_framework' };
  }
  if (['spring', 'springboot', 'django', 'flask', 'gin', 'nodejs', 'fastapi'].includes(slug)) {
    return { direction: 'backend', track: 'backend_framework' };
  }
  if (['mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'sql'].includes(slug)) {
    return { direction: 'backend', track: 'data_storage' };
  }
  if (
    ['pytorch', 'tensorflow', 'sklearn', 'ml', 'cv', 'nlp', 'llm', 'rl', 'rag', 'agent', 'langchain', 'llamaindex', 'vllm', 'ollama', 'tgi'].includes(
      slug,
    )
  ) {
    return { direction: 'ai', track: 'ml_llm' };
  }
  if (['spark', 'hadoop', 'flink', 'kafka'].includes(slug)) {
    return { direction: 'data', track: 'bigdata' };
  }
  if (['docker', 'k8s', 'linux', 'cicd', 'aws', 'gcp', 'azure'].includes(slug)) {
    return { direction: 'infra', track: 'cloud_devops' };
  }
  if (['security', 'reverse', 'crypto'].includes(slug)) {
    return { direction: 'security', track: 'security_core' };
  }
  if (group.includes('编程语言') || ['python', 'java', 'go', 'rust', 'scala', 'cpp'].includes(slug)) {
    return { direction: 'backend', track: 'programming_language' };
  }
  if (group.includes('前端')) {
    return { direction: 'frontend', track: 'web_framework' };
  }
  if (group.includes('后端')) {
    return { direction: 'backend', track: 'backend_framework' };
  }
  if (group.includes('机器学习') || group.includes('ai') || label.includes('模型')) {
    return { direction: 'ai', track: 'ml_llm' };
  }
  if (group.includes('大数据')) {
    return { direction: 'data', track: 'bigdata' };
  }
  if (group.includes('基础') || group.includes('云') || group.includes('devops')) {
    return { direction: 'infra', track: 'cloud_devops' };
  }
  return { direction: 'other', track: 'other' };
}

const directionLabel: Record<string, string> = {
  backend: '后端开发',
  frontend: '前端开发',
  ai: 'AI 应用/算法',
  infra: 'Infra / DevOps',
  data: '数据工程',
  security: '安全方向',
  qa: '测试工程',
  other: '其他方向',
};

const trackLabel: Record<string, string> = {
  programming_language: '编程语言',
  backend_framework: '后端框架',
  data_storage: '数据库与中间件',
  web_framework: '前端框架与工具',
  ml_llm: '机器学习与大模型',
  bigdata: '大数据栈',
  cloud_devops: '云原生与运维',
  security_core: '安全核心栈',
  qa_testing: '测试与质量保障',
  other: '未分类技术栈',
};

const childToParentSlug: Record<string, string> = {
  'cpp-stl': 'cpp',
  'cpp-inline': 'cpp',
  'cpp-template': 'cpp',
  'cpp-memory': 'cpp',
  'java-jvm': 'java',
  'java-concurrency': 'java',
  'java-collection': 'java',
  'java-io': 'java',
  'python-async': 'python',
  'python-gil': 'python',
  'python-metaclass': 'python',
  'python-typing': 'python',
  'go-goroutine': 'go',
  'go-channel': 'go',
  'go-gmp': 'go',
  'go-context': 'go',
  'react-hooks': 'react',
  'react-state': 'react',
  'react-ssr': 'react',
  'react-performance': 'react',
  'vue-composition': 'vue',
  'vue-router': 'vue',
  'vue-pinia': 'vue',
  'vue-performance': 'vue',
  'springboot-mvc': 'springboot',
  'springboot-aop': 'springboot',
  'springboot-jpa': 'springboot',
  'springboot-security': 'springboot',
  'django-orm': 'django',
  'django-middleware': 'django',
  'django-auth': 'django',
  'django-rest': 'django',
  'fastapi-dependency': 'fastapi',
  'fastapi-async': 'fastapi',
  'fastapi-pydantic': 'fastapi',
  'fastapi-openapi': 'fastapi',
  'node-eventloop': 'nodejs',
  'node-stream': 'nodejs',
  'node-cluster': 'nodejs',
  'node-buffer': 'nodejs',
  'mysql-index': 'mysql',
  'mysql-transaction': 'mysql',
  'mysql-lock': 'mysql',
  'mysql-sharding': 'mysql',
  'redis-cache': 'redis',
  'redis-lock': 'redis',
  'redis-pipeline': 'redis',
  'redis-ha': 'redis',
  'kafka-topic': 'kafka',
  'kafka-group': 'kafka',
  'kafka-idempotent': 'kafka',
  'kafka-eos': 'kafka',
  'docker-image': 'docker',
  'docker-network': 'docker',
  'docker-volume': 'docker',
  'docker-multistage': 'docker',
  'k8s-deployment': 'k8s',
  'k8s-service': 'k8s',
  'k8s-ingress': 'k8s',
  'k8s-hpa': 'k8s',
  'pytorch-autograd': 'pytorch',
  'pytorch-distributed': 'pytorch',
  'pytorch-dataloader': 'pytorch',
  'pytorch-amp': 'pytorch',
  'tensorflow-graph': 'tensorflow',
  'tensorflow-keras': 'tensorflow',
  'tensorflow-serving': 'tensorflow',
  'tensorflow-distributed': 'tensorflow',
  'llm-prompt': 'llm',
  'llm-functioncalling': 'llm',
  'llm-evals': 'llm',
  'llm-agent': 'llm',
  'rag-rewrite': 'rag',
  'rag-hybrid': 'rag',
  'rag-rerank': 'rag',
  'rag-compression': 'rag',
  'vllm-pagedattention': 'vllm',
  'vllm-batching': 'vllm',
  'vllm-kvcache': 'vllm',
  'vllm-tp': 'vllm',
};

export async function GET() {
  try {
    const tags = await query<TagRow>(
      `SELECT id, slug, label, group_name
       FROM tags
       ORDER BY group_name NULLS LAST, label`,
    );

    const childMap = new Map<string, StackItem[]>();
    for (const tag of tags) {
      const parentSlug = childToParentSlug[tag.slug];
      if (!parentSlug) continue;
      if (!childMap.has(parentSlug)) {
        childMap.set(parentSlug, []);
      }
      childMap.get(parentSlug)!.push({
        tag_id: tag.id,
        slug: tag.slug,
        label: tag.label,
        group_name: tag.group_name ?? '未分组',
        children: [],
      });
    }

    const dirMap = new Map<string, Map<string, StackItem[]>>();
    for (const tag of tags) {
      if (childToParentSlug[tag.slug]) {
        continue;
      }
      const { direction, track } = classifyTag(tag);
      if (!dirMap.has(direction)) dirMap.set(direction, new Map<string, StackItem[]>());
      const trackMap = dirMap.get(direction)!;
      if (!trackMap.has(track)) trackMap.set(track, []);
      const children = childMap.get(tag.slug) ?? [];
      children.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
      trackMap.get(track)!.push({
        tag_id: tag.id,
        slug: tag.slug,
        label: tag.label,
        group_name: tag.group_name ?? '未分组',
        children,
      });
    }

    const directionOrder = ['backend', 'frontend', 'ai', 'infra', 'data', 'security', 'qa', 'other'];
    const taxonomy: Direction[] = directionOrder
      .filter((dir) => dirMap.has(dir))
      .map((dir) => {
        const trackMap = dirMap.get(dir)!;
        const tracks: Track[] = Array.from(trackMap.entries()).map(([trackId, stacks]) => ({
          id: trackId,
          label: trackLabel[trackId] ?? trackId,
          stacks,
        }));
        tracks.sort((a, b) => b.stacks.length - a.stacks.length);
        return {
          id: dir,
          label: directionLabel[dir] ?? dir,
          tracks,
        };
      });

    return NextResponse.json({ directions: taxonomy });
  } catch (err) {
    log.error({ err }, 'Failed to load graph taxonomy');
    return NextResponse.json({ error: '加载技术评估分类失败' }, { status: 500 });
  }
}
