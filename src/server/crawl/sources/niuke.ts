import axios from 'axios';
import { createLogger } from '@/lib/logger';
import type {
  DiscoveredItem,
  RawJobRecord,
  NormalizedJob,
  JobEntrypointInput,
  CrawlContext,
  SourceAdapter,
} from '../types';

const LISTING_PAGES = [
  'https://www.nowcoder.com/jobs/school/jobs',
  'https://www.nowcoder.com/jobs/intern/center',
];
const SCROLL_PAGES = [
  'https://www.nowcoder.com/jobs/school/jobs?page=2',
  'https://www.nowcoder.com/jobs/school/jobs?page=3',
  'https://www.nowcoder.com/jobs/school/jobs?page=4',
  'https://www.nowcoder.com/jobs/school/jobs?page=5',
  'https://www.nowcoder.com/jobs/intern/center?page=2',
  'https://www.nowcoder.com/jobs/intern/center?page=3',
  'https://www.nowcoder.com/jobs/intern/center?page=4',
  'https://www.nowcoder.com/jobs/intern/center?page=5',
];
const log = createLogger('crawl/niuke');

const BYTEDANCE_COMPANY_NAMES = /字节|ByteDance|bytedance|TikTok/i;
const BYTEDANCE_CAREERS_URLS = [
  'https://jobs.bytedance.com/campus',
  'https://campus.bytedance.com/',
  'https://careers.bytedance.com/',
];

const INCLUDE_TECH = /字节|腾讯|阿里|百度|美团|京东|拼多多|网易|快手|滴滴|小米|华为|OPPO|vivo|苹果|谷歌|Metaicrosoft|亚马逊|NVIDIA|Intel|AMD|高通|联发科|台积电|三星|商汤|旷视|依图|云从|寒武纪|地平线|芯动|壁仞|摩尔线程|燧原|天数智芯|沐曦|海光|龙芯|兆芯|申威|飞腾|华为海思|紫光展锐|中兴通讯|烽火通信|中际旭创|新易盛|剑桥科技|天孚通信|光迅科技|华工科技|大族激光|锐科激光|海康威视|大华股份|宇视科技|智慧安防|科大讯飞|云从科技|第四范式|九章云极|同盾科技|百分科技|智能科技|人工智能|AI[器用运]|机器学习|深度学习|计算机视觉|自然语言处理|NLP|语音识别|语义计算|大模型|LLM|ChatGPT|GPT|文心|通义|KIMI|豆包|DeepSeek|元宝|AI[应岗]|生成式|算法工程|云计算|云原生|IaaS|PaaS|SaaS|公有云|私有云|混合云|云服务|云平台|云厂商|云存储|云安全|云数据库|云网络|云服务器|CDN|边缘计算|雾计算|算力|算力服务|算力平台|大数据|数据湖|数据仓库|Hadoop|Spark|Flink|Kafka|ETL|数据开发|数据分析|数据挖掘|数据工程|数据平台|数据治理|湖仓一体|数据中台|数据资产|数据服务|数据科学|数据分析师|BI|商业智能|游戏|网络游戏|手游|端游|页游|VR|AR|MR|元宇宙|虚拟现实|增强现实|混合现实|Unity|Unreal|图形渲染|游戏客户端|游戏服务端|游戏策划|游戏美术|游戏运营|游戏测试|游戏发行|游戏渠道|游戏研发|电商|电子商务|跨境电商|直播电商|社交电商|内容电商|兴趣电商|即时零售|社区团购|生鲜电商|汽车电商|医药电商|二手电商|电商平台|电商运营|电商技术|电商开发|电商产品|新能源|电动汽车|智能汽车|自动驾驶|车联网|智能座舱|ADAS|毫米波雷达|激光雷达|传感器融合|电池管理|电驱动|充电桩|换电站|储能|光伏|风电|新能源材料|新能源技术|氢能|碳中和|碳交易|环保|新材料|先进材料|纳米材料|石墨烯|碳纤维|3D打印|增材制造|芯片|半导体|集成电路|IC设计|晶圆制造|封装测试|EDA工具|IP核|FPGA|ASIC|SOC|MCU|CPU|GPU|AI芯片|存储芯片|模拟芯片|功率半导体|汽车芯片|射频芯片|光芯片|微电子|电子工程|电路设计|PCB|嵌入式|单片机|物联网|IoT|智能硬件|智能家居|智能穿戴|智能音箱|智能手环|智能手表|TWS|AR眼镜|VR眼镜|无人机|机器人|服务机器人|工业机器人|手术机器人|手术导航|医疗机器人|康复机器人|扫地机器人|智能客服|对话系统|知识图谱|推荐系统|搜索算法|NLP算法|语音助手|智能助手|自动驾驶算法|路径规划|感知算法|定位算法|控制算法|规控|预测算法|仿真测试|网络安全|信息安全|数据安全|云安全|应用安全|主机安全|网络安全工控安全|漏洞挖掘|渗透测试|逆向工程|密码学|零信任|安全运营|SOC|威胁情报|态势感知|入侵检测|防火墙|WAF|DDoS|APT|红蓝对抗|应急响应|代码安全|软件安全|通信技术|5G|6G|蜂窝网络|无线通信|光通信|卫星通信|量子通信|通信设备|基站|天线|滤波器|射频前端|功放|交换机|路由器|光模块|光纤|SDN|NFV|网络架构|网络优化|运营商|电信|联通|移动|虚拟运营商|运营商业务|软硬件|软开|软测|软工|软件开发|软件测试|软件实施|软件运维|ERP实施|SAP实施|Oracle实施|售前咨询|解决方案|系统集成|IT咨询|IT服务|运维开发|DevOps|SRE|平台工程|云原生开发|容器化|Kubernetes|Docker|微服务|Service Mesh|服务网格|分布式|高并发|海量数据|中间件|消息队列|RabbitMQ|ActiveMQ|Kafka|RocketMQ|注册中心|配置中心|网关|负载均衡|限流|熔断|降级|链路追踪|全链路|APM|监控|日志|链路日志|全链路日志|链路监控|调用链|分布式追踪|分布式事务|Seata|TCC|Saga|可靠消息|最终一致性|分布式锁|分布式缓存|Redis集群|Memcached|分布式存储|对象存储|块存储|文件存储|MinIO|数据库|MySQL|PostgreSQL|Redis|MongoDB|ElasticSearch|ClickHouse|Doris|StarRocks|TiDB|OLAP|OLTP|HTAP|时序数据库|图数据库|向量数据库|数据同步|数据迁移|ETL|数据管道|实时计算|流计算|批处理|数据湖|湖仓一体|DeltaLake|Iceberg|Hudi|机器学习平台|MLOps|AI平台|模型训练|模型部署|模型服务化|模型压缩|模型量化|模型蒸馏|模型加速|Triton|TensorRT|ONNX|预训练|微调|RLHF|Agent|AI Agent|多模态|多模态模型|文生图|图生图|文生视频|视频生成|AI生成|内容生成式|创意生成|AI[开研]|AI[开岗]|AI[程发岗]/iu;

interface NiukeCompanyInfo {
  companyName?: string;
  companyShortName?: string;
  personScales?: string | null;
  industryTagNameList?: string[];
}

interface NiukeJobCard {
  id: number;
  jobName: string;
  recruitType?: number;
  jobCity?: string | null;
  jobCityList?: string[];
  jobAddress?: string | null;
  careerJobId?: number;
  careerJobName?: string | null;
  jobKeys?: string | null;
  deliverEnd?: number | null;
  ext?: string | null;
  redirectExternalUrl?: string | null;
  recommendInternCompany?: NiukeCompanyInfo | null;
  companyNameText?: string | null;
  companyLogoText?: string | null;
  companyIndustryText?: string | null;
}

type NiukeRawPayload = NiukeJobCard & {
  source_url?: string;
  detail_url?: string;
};

type NiukeNormalizedJob = NormalizedJob & {
  entry_url: string;
  source_job_id: string;
};

export class NiukeAdapter implements SourceAdapter {
  readonly sourceName = '牛客网';
  readonly sourceType = 'public' as const;

  async discover(_ctx: CrawlContext): Promise<DiscoveredItem[]> {
    const items = new Map<string, DiscoveredItem>();

    const ALL_PAGES = [...LISTING_PAGES, ...SCROLL_PAGES];
    for (const pageUrl of ALL_PAGES) {
      let retries = 2; // 3 attempts total
      while (retries >= 0) {
        try {
          const html = await fetchHtml(pageUrl);
          const initialState = extractInitialState(html);
          const jobCards = collectJobCards(initialState);

          for (const job of jobCards) {
            const sourceJobId = String(job.id);
            if (!sourceJobId || items.has(sourceJobId)) {
              continue;
            }

            const combined = (job.jobName || '') + ' ' + (job.companyNameText || '') + ' ' + (job.recommendInternCompany?.companyName || '') + ' ' + (job.recommendInternCompany?.companyShortName || '');
            if (!INCLUDE_TECH.test(combined)) continue;

            items.set(sourceJobId, {
              source_job_id: sourceJobId,
              title: cleanText(job.jobName),
              url: buildDetailUrl(job.id),
              metadata: {
                ...job,
                source_url: pageUrl,
                detail_url: buildDetailUrl(job.id),
              },
            });
          }
          break; // success, exit retry loop
        } catch (err) {
          retries -= 1;
          if (retries < 0) {
            log.warn({ err, pageUrl }, 'Failed to parse Niuke listing page after 3 attempts');
            break;
          }
          // retry
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    return [...items.values()];
  }

  async fetchDetail(item: DiscoveredItem, _ctx: CrawlContext): Promise<RawJobRecord> {
    return {
      source_name: this.sourceName,
      source_job_id: item.source_job_id,
      raw_payload: {
        ...(isRecord(item.metadata) ? item.metadata : {}),
        detail_url: item.url ?? null,
      },
    };
  }

  async normalize(raw: RawJobRecord): Promise<NormalizedJob> {
    const payload = raw.raw_payload as unknown as NiukeRawPayload;
    const ext = parseExt(payload.ext);

    // recommendInternCompany might be a string/number/array instead of object
    const companyInfo = isNiukeCompanyInfo(payload.recommendInternCompany)
      ? payload.recommendInternCompany
      : null;

    const companyName = firstNonEmpty(
      companyInfo?.companyShortName,
      companyInfo?.companyName,
      payload.companyNameText,
    );

    if (!companyName) {
      throw new Error(`Niuke job ${raw.source_job_id} is missing company_name`);
    }

    const normalized: NiukeNormalizedJob = {
      company_name: cleanText(companyName),
      title: cleanText(payload.jobName),
      city: normalizeCity(payload.jobCityList, payload.jobCity),
      is_remote: detectRemote(payload),
      internship_type: normalizeRecruitType(payload.recruitType),
      deadline: normalizeDeadline(payload.deliverEnd),
      jd_text: buildJobDescription(ext),
      entry_url: buildEntryUrl(companyName, payload, raw.source_job_id),
      source_job_id: raw.source_job_id,
    };

    return normalized;
  }

  async extractEntrypoints(job: NormalizedJob): Promise<JobEntrypointInput[]> {
    const niukeJob = job as NiukeNormalizedJob;

    return [
      {
        entry_type: 'official',
        entry_url: niukeJob.entry_url,
        visibility: 'public',
        requires_auth: false,
        referrer_name: '牛客网',
        source_job_id: niukeJob.source_job_id,
      },
    ];
  }

  needsReauth(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.message.includes('401') ||
        error.message.includes('403') ||
        error.message.includes('login') ||
        error.message.includes('登录')
      );
    }

    return false;
  }
}

const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

async function fetchHtml(url: string): Promise<string> {
  await new Promise(r => setTimeout(r, 500));

  const response = await axios.get<string>(url, {
    headers: HTTP_HEADERS,
    timeout: 30000,
    responseType: 'text',
  });

  return response.data;
}

function extractInitialState(html: string): unknown {
  const marker = 'window.__INITIAL_STATE__=';
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error('Niuke initial state marker not found');
  }

  let index = markerIndex + marker.length;
  while (index < html.length && html[index] !== '{') {
    index += 1;
  }

  if (html[index] !== '{') {
    throw new Error('Niuke initial state JSON start not found');
  }

  const json = sliceBalancedJson(html, index);
  return JSON.parse(json);
}

function sliceBalancedJson(content: string, startIndex: number): string {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < content.length; index += 1) {
    const char = content[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return content.slice(startIndex, index + 1);
      }
    }
  }

  throw new Error('Niuke initial state JSON is incomplete');
}

function collectJobCards(value: unknown): NiukeJobCard[] {
  const seen = new WeakSet<object>();
  const jobs = new Map<number, NiukeJobCard>();

  const visit = (current: unknown) => {
    if (!current || typeof current !== 'object') {
      return;
    }

    if (seen.has(current)) {
      return;
    }

    seen.add(current);

    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }

    const job = normalizeJobCard(current as Record<string, unknown>);
    if (job) {
      jobs.set(job.id, job);
    }

    for (const next of Object.values(current)) {
      visit(next);
    }
  };

  visit(value);
  return [...jobs.values()];
}

function normalizeJobCard(value: Record<string, unknown>): NiukeJobCard | null {
  const candidate = isRecord(value.data) ? value.data : value;

  if (typeof candidate.id !== 'number' || typeof candidate.jobName !== 'string') {
    return null;
  }

  return candidate as unknown as NiukeJobCard;
}

function parseExt(rawExt: string | null | undefined): Record<string, string> {
  if (!rawExt) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawExt) as Record<string, unknown>;
    const entries = Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

function buildJobDescription(ext: Record<string, string>): string | null {
  const sections = [
    ['岗位职责', ext.infos],
    ['任职要求', ext.requirements],
    ['岗位亮点', ext.jobStrength],
  ]
    .map(([label, value]) => {
      const cleaned = cleanText(value);
      return cleaned ? `${label}\n${cleaned}` : null;
    })
    .filter((value): value is string => Boolean(value));

  return sections.length > 0 ? sections.join('\n\n') : null;
}

function normalizeCity(jobCityList: unknown, jobCity: string | null | undefined): string {
  const cityList = Array.isArray(jobCityList) ? jobCityList.filter((v): v is string => typeof v === 'string') : [];
  const rawValue = firstNonEmpty(...cityList, jobCity);
  if (!rawValue) {
    return '';
  }

  const city = rawValue
    .split(/[\/、|·]/u)[0]
    .replace(/省$/u, '')
    .replace(/市$/u, '')
    .trim();

  return city;
}

function normalizeRecruitType(recruitType: number | undefined): string {
  switch (recruitType) {
    case 1:
      return '校招';
    case 2:
      return '实习';
    case 3:
      return '社招';
    default:
      return '校招';
  }
}

function normalizeDeadline(timestamp: number | null | undefined): string | null {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return null;
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() > new Date().getUTCFullYear() + 5) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function detectRemote(payload: NiukeJobCard): boolean {
  const text = [
    payload.jobCity,
    payload.jobAddress,
    payload.jobKeys,
    payload.jobName,
  ]
    .filter(Boolean)
    .join(' ');

  return /远程|居家|remote/i.test(text);
}

function buildDetailUrl(jobId: number): string {
  return `https://www.nowcoder.com/jobs/detail/${jobId}`;
}

function buildEntryUrl(companyName: string, payload: NiukeRawPayload, sourceJobId: string): string {
  const rawExternal = payload.redirectExternalUrl;
  const rawDetail = payload.detail_url;
  const isByteDance = BYTEDANCE_COMPANY_NAMES.test(companyName);

  if (isByteDance) {
    return BYTEDANCE_CAREERS_URLS[0];
  }

  if (isValidUrl(rawExternal)) {
    return rawExternal;
  }
  if (isValidUrl(rawDetail)) {
    return rawDetail;
  }
  return buildDetailUrl(Number(sourceJobId));
}

function cleanText(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\u003c/gu, '<')
    .replace(/\u003e/gu, '>')
    .replace(/\u0026/gu, '&')
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/\n[ \t]+/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .replace(/[ \t]{2,}/gu, ' ')
    .trim();
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNiukeCompanyInfo(value: unknown): value is NiukeCompanyInfo {
  return isRecord(value);
}

function isValidUrl(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && /^https?:\/\//.test(value);
}
