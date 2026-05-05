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

const EXCLUDE_INDUSTRY = /房产|地产|置业顾问|经纪人|中介(?!机)|物业(?!管理)|银行|国有银行|商业银行|信用社|村镇银行|证券|基金|期货|保险|安邦|人寿|平安|太平洋|新华|泰康|信托|资产管理|投行|承销|保荐|地产开发|物业管理|建筑|施工|工程监理|造价咨询|装修|装饰|园林|规划设计|市政|路桥|隧道|钢结构|政府部门|街道办事处|社区|居委会|事业单位|机关单位|政府机构|教育局|卫生局|医院|医疗机构|诊所|药店|药房|医学院|高校|大学|中学|小学|幼儿园|教育机构|培训|学校|驾校|职业技术学院|政府|央企|国企|中国石油|中国石化|中国建筑|中国中铁|中国铁建|中国交建|中国中车|国家电网|南方电网|烟草|电网|电力|火电|水电|核电|风电|光伏|能源|煤炭|矿产|采矿|冶金|钢铁|铝业|铜业|有色金属|化工|石油|天然气|炼化|煤化工|化肥|农药|农业|种植|养殖|畜牧|兽医|食品|饮料|酒|乳业|茶|粮油|调味|保健品|制造业|机械|机床|汽车制造|整车厂|重卡|客车|商用车|农机|船舶|航空|航天|军工|部队|军区|物流|快递|运输|仓储|供应链|贸易|进出口|商贸|批发|零售|超市|便利店|百货|购物中心|商业综合体|餐饮|酒店|旅游|航空|机场|铁路|地铁|公路|公交|出租车|驾培|传媒|出版|印刷|广告|公关|会展|咨询|猎头|人力资源外包|会计|审计|律师|公证|商标|专利|翻译|检测|认证|计量|标准|特种设备|环保|污水处理|固废处理|环卫|园林绿化|政府|公共事业|公用事业|给排水|燃气|供热|通信|运营商|基础电信|广播电视|电影|电视台|电台|剧院|演出|经纪公司|模特|网红|直播带货|微商|直销|传销|贵金属|金银|珠宝|典当|小额贷款|民间借贷|担保|租赁|融资租赁|商业保理|消费金融|征信|支付|银行卡|信用卡|收单|POS|公积金|社保|人事代理|劳务派遣|外事|领事馆|签证|移民|出入境|检验检疫|海关|口岸|保税区|开发区|高新区|创业园|孵化器|众创空间|科技园|产业园区|管委会|人民政府|党委|组织部|宣传部|统战部|发改委|工信部|商务部|财政部|人社部|住建部|交通部|水利部|农业部|商务部|文旅部|卫健委|药监局|市场监管|质监局|检验检疫|气象局|地震局|测绘局|档案局|统计局|信访局|法制办|外办|台办|侨办|民宗局|民盟|民建|民进|农工|致公|九三|台盟|共青团|工会|妇联|残联|科协|文联|作协|红十字会|慈善|基金会|老龄委|关工委|老龄办/iu;
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
          if (EXCLUDE_INDUSTRY.test(combined)) continue;
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
      } catch (err) {
        log.warn({ err, pageUrl }, 'Failed to parse Niuke listing page');
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
    const companyName = firstNonEmpty(
      payload.recommendInternCompany?.companyShortName,
      payload.recommendInternCompany?.companyName,
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
      entry_url: firstNonEmpty(payload.redirectExternalUrl, payload.detail_url) ?? buildDetailUrl(Number(raw.source_job_id)),
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

async function fetchHtml(url: string): Promise<string> {
  const response = await axios.get<string>(url, {
    headers: HTTP_HEADERS,
    timeout: 20000,
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

function normalizeCity(jobCityList: string[] | undefined, jobCity: string | null | undefined): string {
  const rawValue = firstNonEmpty(...(jobCityList ?? []), jobCity);
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
