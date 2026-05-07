import axios from 'axios';
import { load } from 'cheerio';
import { createLogger } from '@/lib/logger';
import type {
  CrawlContext,
  DiscoveredItem,
  JobEntrypointInput,
  NormalizedJob,
  RawJobRecord,
  SourceAdapter,
} from '../types';

const BASE_URL = 'https://www.yingjiesheng.com';
const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  Referer: 'https://www.yingjiesheng.com/',
};

const log = createLogger('crawl/yingjiesheng');

const CAMPUS_PAGES = [
  'https://www.yingjiesheng.com/',
  'https://www.yingjiesheng.com/beijing/',
  'https://www.yingjiesheng.com/shanghai/',
  'https://www.yingjiesheng.com/guangzhou/',
  'https://www.yingjiesheng.com/shenzhen/',
  'https://www.yingjiesheng.com/hangzhou/',
  'https://www.yingjiesheng.com/nanjing/',
  'https://www.yingjiesheng.com/wuhan/',
  'https://www.yingjiesheng.com/xian/',
  'https://www.yingjiesheng.com/chengdu/',
];

interface YingjieshengJobCard {
  title: string;
  company: string;
  city: string;
  date: string;
  url: string;
  detail?: string;
}

const INCLUDE_RECRUIT_KEYWORDS = /校园招聘|秋招|春招|202[4-9]届|20\d{2}届|校招|实习生|校园招募/iu;
const EXCLUDE_NON_JOB = /宣讲会|笔经|面经|经验分享|求职信|简历模板|笔试真题|面试技巧|大赛|挑战赛|培训生|管理培训|精英计划/iu;
const INCLUDE_TECH = /字节|腾讯|阿里|百度|美团|京东|拼多多|网易|快手|滴滴|小米|华为|OPPO|vivo|苹果|谷歌|Metaicrosoft|亚马逊|NVIDIA|Intel|AMD|高通|联发科|台积电|三星|商汤|旷视|依图|云从|寒武纪|地平线|芯动|壁仞|摩尔线程|燧原|天数智芯|沐曦|海光|龙芯|兆芯|申威|飞腾|华为海思|紫光展锐|中兴通讯|烽火通信|中际旭创|新易盛|剑桥科技|天孚通信|光迅科技|华工科技|大族激光|锐科激光|海康威视|大华股份|宇视科技|智慧安防|科大讯飞|云从科技|第四范式|九章云极|同盾科技|百分科技|智能科技|人工智能|AI[器用运]|机器学习|深度学习|计算机视觉|自然语言处理|NLP|语音识别|语义计算|大模型|LLM|ChatGPT|GPT|文心|通义|KIMI|豆包|DeepSeek|元宝|AI[应岗]|生成式|算法工程|云计算|云原生|IaaS|PaaS|SaaS|公有云|私有云|混合云|云服务|云平台|云厂商|云存储|云安全|云数据库|云网络|云服务器|CDN|边缘计算|雾计算|算力|算力服务|算力平台|大数据|数据湖|数据仓库|Hadoop|Spark|Flink|Kafka|ETL|数据开发|数据分析|数据挖掘|数据工程|数据平台|数据治理|湖仓一体|数据中台|数据资产|数据服务|数据科学|数据分析师|BI|商业智能|游戏|网络游戏|手游|端游|页游|VR|AR|MR|元宇宙|虚拟现实|增强现实|混合现实|Unity|Unreal|图形渲染|游戏客户端|游戏服务端|游戏策划|游戏美术|游戏运营|游戏测试|游戏发行|游戏渠道|游戏研发|电商|电子商务|跨境电商|直播电商|社交电商|内容电商|兴趣电商|即时零售|社区团购|生鲜电商|汽车电商|医药电商|二手电商|电商平台|电商运营|电商技术|电商开发|电商产品|新能源|电动汽车|智能汽车|自动驾驶|车联网|智能座舱|ADAS|毫米波雷达|激光雷达|传感器融合|电池管理|电驱动|充电桩|换电站|储能|光伏|风电|新能源材料|新能源技术|氢能|碳中和|碳交易|环保|新材料|先进材料|纳米材料|石墨烯|碳纤维|3D打印|增材制造|芯片|半导体|集成电路|IC设计|晶圆制造|封装测试|EDA工具|IP核|FPGA|ASIC|SOC|MCU|CPU|GPU|AI芯片|存储芯片|模拟芯片|功率半导体|汽车芯片|射频芯片|光芯片|微电子|电子工程|电路设计|PCB|嵌入式|单片机|物联网|IoT|智能硬件|智能家居|智能穿戴|智能音箱|智能手环|智能手表|TWS|AR眼镜|VR眼镜|无人机|机器人|服务机器人|工业机器人|手术机器人|手术导航|医疗机器人|康复机器人|扫地机器人|智能客服|对话系统|知识图谱|推荐系统|搜索算法|NLP算法|语音助手|智能助手|自动驾驶算法|路径规划|感知算法|定位算法|控制算法|规控|预测算法|仿真测试|网络安全|信息安全|数据安全|云安全|应用安全|主机安全|网络安全工控安全|漏洞挖掘|渗透测试|逆向工程|密码学|零信任|安全运营|SOC|威胁情报|态势感知|入侵检测|防火墙|WAF|DDoS|APT|红蓝对抗|应急响应|代码安全、软件安全|通信技术|5G|6G|蜂窝网络|无线通信|光通信|卫星通信|量子通信|通信设备|基站|天线|滤波器|射频前端|功放|交换机|路由器|光模块|光纤|SDN|NFV|网络架构|网络优化|运营商|电信|联通|移动|虚拟运营商|运营商业务|软硬件|软开|软测|软工|软件开发、软件测试、软件实施、软件运维|ERP实施|SAP实施|Oracle实施|售前咨询|解决方案|系统集成|IT咨询|IT服务|运维开发|DevOps|SRE|平台工程|云原生开发|容器化|Kubernetes|Docker|微服务|Service Mesh|服务网格|分布式|高并发|海量数据|中间件|消息队列|RabbitMQ|ActiveMQ|Kafka|RocketMQ|注册中心|配置中心|网关|负载均衡|限流|熔断|降级|链路追踪|全链路|APM|监控|日志|链路日志|全链路日志|链路监控|调用链|分布式追踪|分布式事务|Seata|TCC|Saga|可靠消息|最终一致性|分布式锁|分布式缓存|Redis集群|Memcached|分布式存储|对象存储|块存储|文件存储|MinIO|数据库|MySQL|PostgreSQL|Redis|MongoDB|ElasticSearch|ClickHouse|Doris|StarRocks|TiDB|OLAP|OLTP|HTAP|时序数据库|图数据库|向量数据库|数据同步|数据迁移|ETL|数据管道|实时计算|流计算|批处理|数据湖|湖仓一体|DeltaLake|Iceberg|Hudi|机器学习平台|MLOps|AI平台|模型训练|模型部署|模型服务化|模型压缩|模型量化|模型蒸馏|模型加速|Triton|TensorRT|ONNX|预训练|微调|RLHF|Agent|AI Agent|多模态|多模态模型|文生图|图生图|文生视频|视频生成|AI生成|内容生成式|创意生成|AI[开研]|AI[开岗]|AI[程发岗]/iu;

type YingjieshengNormalizedJob = NormalizedJob & {
  entry_url: string;
  source_job_id: string;
};

export class YingjieshengAdapter implements SourceAdapter {
  readonly sourceName = '应届生求职网';
  readonly sourceType = 'public' as const;

  async discover(ctx: CrawlContext): Promise<DiscoveredItem[]> {
    const seen = new Set<string>();
    const items: DiscoveredItem[] = [];

    for (const pageUrl of CAMPUS_PAGES) {
      for (let page = 1; page <= 10; page++) {
        try {
          const pageUrlWithPage = page === 1 ? pageUrl : `${pageUrl}index_${page}.html`;
          const jobs = await this.fetchListingPage(pageUrlWithPage);
          if (jobs.length === 0) break;

          for (const job of jobs) {
            if (!job.url || seen.has(job.url)) continue;
            seen.add(job.url);

            if (!INCLUDE_TECH.test(job.title + job.company)) continue;
            if (!INCLUDE_RECRUIT_KEYWORDS.test(job.title + job.company)) continue;
            if (EXCLUDE_NON_JOB.test(job.title)) continue;

            const sourceJobId = this.buildJobId(job.url);
            items.push({
              source_job_id: sourceJobId,
              title: cleanText(job.title),
              url: job.url,
              metadata: {
                ...job,
                page_url: pageUrl,
              } as unknown as Record<string, unknown>,
            });
          }
          if (items.length >= 200) break;
        } catch (err) {
          log.warn({ err, pageUrl }, 'Failed to fetch Yingjiesheng listing page');
        }
      }
      if (items.length >= 200) break;
    }

    return items;
  }

  private async fetchListingPage(pageUrl: string): Promise<YingjieshengJobCard[]> {
    const response = await axios.get<string>(pageUrl, {
      headers: HTTP_HEADERS,
      timeout: 20000,
      responseType: 'text',
    });

    const html = response.data;
    const $ = load(html);
    const jobs: YingjieshengJobCard[] = [];

    $('div.job-list li, div.job li, ul.job-list li, table.job-table tr, div.companys li').each((_, el) => {
      const titleEl = $(el).find('a.job-name, a.title, td a, h3 a, a').first();
      const companyEl = $(el).find('a.company-name, span.company, td.company, h4, div.company');
      const cityEl = $(el).find('span.city, td.city, div.city, span.location');
      const dateEl = $(el).find('span.date, td.date, div.date');
      const href = titleEl.attr('href');

      const title = titleEl.text().trim() || titleEl.attr('title')?.trim() || '';
      const company = companyEl.text().trim();
      const city = cityEl.text().trim();
      const date = dateEl.text().trim();

      if (title && href) {
        const url = normalizeUrl(href, BASE_URL);
        jobs.push({ title, company, city, date, url });
      }
    });

    if (jobs.length === 0) {
      $('a[href*="yingjiesheng.com"]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;

        const url = normalizeUrl(href, BASE_URL);
        const text = $(el).text().trim();

        if (INCLUDE_RECRUIT_KEYWORDS.test(text)) {
          jobs.push({
            title: text,
            company: '',
            city: '',
            date: '',
            url,
          });
        }
      });
    }

    return jobs;
  }

  async fetchDetail(item: DiscoveredItem, _ctx: CrawlContext): Promise<RawJobRecord> {
    const metadata = isRecord(item.metadata) ? item.metadata : {};
    const jobCard = metadata as unknown as YingjieshengJobCard & {
      page_url?: string;
      detail_url?: string;
      detail_text?: string;
    };

    let detailText = '';
    try {
      const detailUrl = item.url || jobCard.page_url;
      if (!detailUrl) throw new Error('No detail URL');
      const resp = await axios.get(detailUrl, {
        headers: HTTP_HEADERS,
        timeout: 20000,
      });
      const $ = load(resp.data);
      $('script, style, nav, header, footer, .sidebar, .ad, .advertisement').remove();
      detailText = cleanText($('body').text());
    } catch {
      detailText = '';
    }

    return {
      source_name: this.sourceName,
      source_job_id: item.source_job_id,
      raw_payload: {
        ...jobCard,
        detail_text: detailText,
        detail_url: item.url,
      } as unknown as Record<string, unknown>,
    };
  }

  async normalize(raw: RawJobRecord): Promise<NormalizedJob> {
    const payload = raw.raw_payload as unknown as YingjieshengJobCard & {
      detail_text?: string;
      detail_url?: string;
      page_url?: string;
    };

    const companyName = cleanText(payload.company || this.extractCompanyFromTitle(payload.title || ''));
    if (!companyName) {
      throw new Error(`Yingjiesheng job ${raw.source_job_id} is missing company_name`);
    }

    const title = this.extractJobTitle(payload.title || '', payload.detail_text || '');
    if (!title) {
      throw new Error(`Yingjiesheng job ${raw.source_job_id} is missing a concrete job title`);
    }

    const jdText = payload.detail_text || null;
    const internshipType = this.detectInternshipType(payload.title + ' ' + (payload.detail_text || ''));
    const deadline = this.extractDeadline(payload.detail_text || payload.date || '');

    const normalized: YingjieshengNormalizedJob = {
      company_name: companyName,
      title,
      city: normalizeCity(payload.city),
      is_remote: /远程|居家|remote/i.test(jdText || ''),
      internship_type: internshipType,
      deadline,
      jd_text: jdText,
      entry_url: payload.detail_url || raw.source_job_id,
      source_job_id: raw.source_job_id,
    };

    return normalized;
  }

  private extractCompanyFromTitle(title: string): string {
    const cleaned = cleanText(title);
    const matched = cleaned.match(
      /^([A-Za-z0-9\u4e00-\u9fa5·&().-]+?)(?=(?:20\d{2}(?:届|年)?|校园招聘|校园|秋招|春招|社招|招聘|校招|实习|内推))/u,
    );
    return matched?.[1]?.trim() ?? '';
  }

  private extractJobTitle(title: string, detail: string): string | null {
    let text = cleanText(title);
    text = text.replace(/[【】[\]()（）|｜]/gu, ' ');
    text = text.replace(/(?:校园招聘|校园|秋招|春招|社招|招聘|校招|内推|直推|开启|链接|可帮|帮内推)/gu, ' ').trim();
    text = text.replace(/^\d{2,4}届\s*/u, '');

    if (!text || text.length < 2) return null;
    if (/(?:岗位职责|任职要求|内推码|简历)/u.test(text)) return null;

    return text || null;
  }

  private detectInternshipType(text: string): string {
    if (/实习(?![生员])/u.test(text)) {
      return '实习';
    }
    return '校招';
  }

  private extractDeadline(text: string): string | null {
    const matched = text.match(
      /(?:截止|截止日期|报名截止|投递截止|截止时间)\s*[:：]?\s*(\d{4}[./-]\d{1,2}[./-]\d{1,2})/u,
    );
    if (!matched?.[1]) return null;

    const dateStr = matched[1].replace(/[./]/gu, '-');
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return null;

    return date.toISOString().slice(0, 10);
  }

  private buildJobId(url: string): string {
    const matched = url.match(/\/(\d+)\.html/);
    return matched?.[1] ?? Buffer.from(url).toString('base64').replace(/\//g, '_').slice(0, 32);
  }

  async extractEntrypoints(job: NormalizedJob): Promise<JobEntrypointInput[]> {
    const yingJob = job as YingjieshengNormalizedJob;
    return [
      {
        entry_type: 'official',
        entry_url: yingJob.entry_url,
        visibility: 'public',
        requires_auth: false,
        referrer_name: '应届生求职网',
        source_job_id: yingJob.source_job_id,
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

function normalizeUrl(href: string, baseUrl: string): string {
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return `${baseUrl}${href}`;
  return `${baseUrl}/${href}`;
}

function normalizeCity(raw: string | undefined): string {
  if (!raw) return '';
  return raw.replace(/市|地区$/, '').replace(/^不限[，,、]?\s*/u, '').trim();
}

function cleanText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\u00a0/gu, ' ')
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/\n[ \t]+/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .replace(/[ \t]{2,}/gu, ' ')
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
