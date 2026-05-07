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

const SEARCH_API = 'https://www.zhipin.com/web/geek/job';
const WEB_API = 'https://www.zhipin.com/wapi/zpgeek/search/job.json';
const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://www.zhipin.com/',
  Cookie: '',
};

const log = createLogger('crawl/zhipin');

interface ZhipinJobResult {
  zpData: {
    jobList: Array<{
      encryptJobId: string;
      jobName: string;
      companyName: string;
      city: string;
      areaDistrict: string;
      workingExp: string;
      salary: string;
      jobTags: Array<{ name: string }>;
      brandType: string;
      companyLogo: string;
      skills: string[];
      positiveMediumScore: string;
      interviewCommentNum: string;
      bossName: string;
      bossTitle: string;
      bossAvatar: string;
      hasImDialog: string;
      expectSalary: string;
      isApply: string;
      isCollect: string;
      hasNewVersion: string;
      vipJobType: string;
      applyShareStatus: string;
      jobCardStatus: string;
      chatRate: string;
      bossActiveTime: string;
      grade: string;
      geo: string;
      location: string;
      gev: string;
      lid: string;
      pageQuery: string;
    }>;
    pageNo: number;
    pageSize: number;
    totalCount: number;
    totalPage: number;
    maxSalary: number;
    minSalary: number;
    recommendIds: string[];
  };
}

const INCLUDE_RECRUIT_KEYWORDS = /校园招聘|校招|秋招|春招|202[4-9]届|应届|实习生提前批|校招补录|校园精英|暑期实习提前批/iu;
const EXCLUDE_NON_JOB = /宣讲会|笔经|面经|经验分享|求职信|简历模板|笔试真题|面试技巧|大赛|挑战赛|管理培训生|精英计划/iu;
const INCLUDE_TECH = /字节|腾讯|阿里|百度|美团|京东|拼多多|网易|快手|滴滴|小米|华为|OPPO|vivo|苹果|谷歌|Metaicrosoft|亚马逊|NVIDIA|Intel|AMD|高通|联发科|台积电|三星|商汤|旷视|依图|云从|寒武纪|地平线|芯动|壁仞|摩尔线程|燧原|天数智芯|沐曦|海光|龙芯|兆芯|申威|飞腾|华为海思|紫光展锐|中兴通讯|烽火通信|中际旭创|新易盛|剑桥科技|天孚通信|光迅科技|华工科技|大族激光|锐科激光|海康威视|大华股份|宇视科技|智慧安防|科大讯飞|云从科技|第四范式|九章云极|同盾科技|百分科技|智能科技|人工智能|AI[器用运]|机器学习|深度学习|计算机视觉|自然语言处理|NLP|语音识别|语义计算|大模型|LLM|ChatGPT|GPT|文心|通义|KIMI|豆包|DeepSeek|元宝|AI[应岗]|生成式|算法工程|云计算|云原生|IaaS|PaaS|SaaS|公有云|私有云|混合云|云服务|云平台|云厂商|云存储|云安全|云数据库|云网络|云服务器|CDN|边缘计算|雾计算|算力|算力服务|算力平台|大数据|数据湖|数据仓库|Hadoop|Spark|Flink|Kafka|ETL|数据开发|数据分析|数据挖掘|数据工程|数据平台|数据治理|湖仓一体|数据中台|数据资产|数据服务|数据科学|数据分析师|BI|商业智能|游戏|网络游戏|手游|端游|页游|VR|AR|MR|元宇宙|虚拟现实|增强现实|混合现实|Unity|Unreal|图形渲染|游戏客户端|游戏服务端|游戏策划|游戏美术|游戏运营|游戏测试|游戏发行|游戏渠道|游戏研发|电商|电子商务|跨境电商|直播电商|社交电商|内容电商|兴趣电商|即时零售|社区团购|生鲜电商|汽车电商|医药电商|二手电商|电商平台|电商运营|电商技术|电商开发|电商产品|新能源|电动汽车|智能汽车|自动驾驶|车联网|智能座舱|ADAS|毫米波雷达|激光雷达|传感器融合|电池管理|电驱动|充电桩|换电站|储能|光伏|风电|新能源材料|新能源技术|氢能|碳中和|碳交易|环保|新材料|先进材料|纳米材料|石墨烯|碳纤维|3D打印|增材制造|芯片|半导体|集成电路|IC设计|晶圆制造|封装测试|EDA工具|IP核|FPGA|ASIC|SOC|MCU|CPU|GPU|AI芯片|存储芯片|模拟芯片|功率半导体|汽车芯片|射频芯片|光芯片|微电子|电子工程|电路设计|PCB|嵌入式|单片机|物联网|IoT|智能硬件|智能家居|智能穿戴|智能音箱|智能手环|智能手表|TWS|AR眼镜|VR眼镜|无人机|机器人|服务机器人|工业机器人|手术机器人|手术导航|医疗机器人|康复机器人|扫地机器人|智能客服|对话系统|知识图谱|推荐系统|搜索算法|NLP算法|语音助手|智能助手|自动驾驶算法|路径规划|感知算法|定位算法|控制算法|规控|预测算法|仿真测试|网络安全|信息安全|数据安全|云安全|应用安全|主机安全|网络安全工控安全|漏洞挖掘|渗透测试|逆向工程|密码学|零信任|安全运营|SOC|威胁情报|态势感知|入侵检测|防火墙|WAF|DDoS|APT|红蓝对抗|应急响应|代码安全、软件安全|通信技术|5G|6G|蜂窝网络|无线通信|光通信|卫星通信|量子通信|通信设备|基站|天线|滤波器|射频前端|功放|交换机|路由器|光模块|光纤|SDN|NFV|网络架构|网络优化|运营商|电信|联通|移动|虚拟运营商|运营商业务|软硬件|软开|软测|软工 软件开发、软件测试、软件实施、软件运维|ERP实施|SAP实施|Oracle实施|售前咨询|解决方案|系统集成|IT咨询|IT服务|运维开发|DevOps|SRE|平台工程|云原生开发|容器化|Kubernetes|Docker|微服务|Service Mesh|服务网格|分布式|高并发|海量数据|中间件|消息队列|RabbitMQ|ActiveMQ|Kafka|RocketMQ|注册中心|配置中心|网关|负载均衡|限流|熔断|降级|链路追踪|全链路|APM|监控|日志|链路日志|全链路日志|链路监控|调用链|分布式追踪|分布式事务|Seata|TCC|Saga|可靠消息|最终一致性|分布式锁|分布式缓存|Redis集群|Memcached|分布式存储|对象存储|块存储|文件存储|MinIO|数据库|MySQL|PostgreSQL|Redis|MongoDB|ElasticSearch|ClickHouse|Doris|StarRocks|TiDB|OLAP|OLTP|HTAP|时序数据库|图数据库|向量数据库|数据同步|数据迁移|ETL|数据管道|实时计算|流计算|批处理|数据湖|湖仓一体|DeltaLake|Iceberg|Hudi|机器学习平台|MLOps|AI平台|模型训练|模型部署|模型服务化|模型压缩|模型量化|模型蒸馏|模型加速|Triton|TensorRT|ONNX|预训练|微调|RLHF|Agent|AI Agent|多模态|多模态模型|文生图|图生图|文生视频|视频生成|AI生成|内容生成式|创意生成|AI[开研]|AI[开岗]|AI[程发岗]/iu;
const CAMPUS_KEYWORD = '校招';

type ZhipinNormalizedJob = NormalizedJob & {
  entry_url: string;
  source_job_id: string;
};

export class ZhipinAdapter implements SourceAdapter {
  readonly sourceName = 'BOSS直聘';
  readonly sourceType = 'public' as const;

  async discover(ctx: CrawlContext): Promise<DiscoveredItem[]> {
    const items: DiscoveredItem[] = [];
    const cities = [
      { code: '101010100', name: '北京' },
      { code: '101020100', name: '上海' },
      { code: '101280100', name: '广州' },
      { code: '101280600', name: '深圳' },
      { code: '101210100', name: '杭州' },
      { code: '101270100', name: '成都' },
      { code: '101190100', name: '南京' },
      { code: '101200100', name: '武汉' },
      { code: '101270200', name: '西安' },
      { code: '101190400', name: '苏州' },
    ];

    for (const city of cities) {
      for (let page = 1; page <= 5; page++) {
        try {
          const pageItems = await this.fetchCampusJobs(city.code, city.name, page);
          if (pageItems.length === 0) break;

          for (const job of pageItems) {
            if (!INCLUDE_TECH.test(job.jobName + job.companyName)) continue;
            if (!INCLUDE_RECRUIT_KEYWORDS.test(job.jobName + job.companyName)) continue;
            if (EXCLUDE_NON_JOB.test(job.jobName)) continue;

            const entryUrl = `https://www.zhipin.com/job_detail/${job.encryptJobId}.html`;
            items.push({
              source_job_id: job.encryptJobId,
              title: cleanText(job.jobName),
              url: entryUrl,
              metadata: {
                ...job,
                entry_url: entryUrl,
                city_name: city.name,
              } as unknown as Record<string, unknown>,
            });
          }
          if (items.length >= 200) break;
        } catch (err) {
          log.warn({ err, city: city.name }, 'Failed to fetch Zhipin city page');
        }
      }
      if (items.length >= 200) break;
    }

    return items;
  }

  private async fetchCampusJobs(cityCode: string, cityName: string, page: number = 1): Promise<ZhipinJobResult['zpData']['jobList']> {
    // First try the web API with cookie support
    try {
      const response = await axios.get<ZhipinJobResult>(WEB_API, {
        headers: {
          ...HTTP_HEADERS,
          'Cookie': process.env.ZHIPIN_COOKIE || '',
        },
        params: {
          scene: '1',
          lid: cityCode,
          resumeSource: '2',
          query: CAMPUS_KEYWORD,
          page: String(page),
          pageSize: '30',
        },
        timeout: 20000,
      });

      const data = response.data;
      if (data?.zpData?.jobList?.length > 0) {
        return data.zpData.jobList;
      }
    } catch {
      // fall through to HTML scrape
    }

    // Fallback: scrape the HTML page
    return this.fetchCampusJobsHtml(cityCode, cityName, page);
  }

  private async fetchCampusJobsHtml(cityCode: string, cityName: string, page: number): Promise<ZhipinJobResult['zpData']['jobList']> {
    const url = `https://www.zhipin.com/web/geek/job?query=${encodeURIComponent(CAMPUS_KEYWORD)}&city=${cityCode}&page=${page}`;
    try {
      const response = await axios.get(url, {
        headers: {
          ...HTTP_HEADERS,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 20000,
      });

      const $ = load(response.data as string);
      const jobs: ZhipinJobResult['zpData']['jobList'] = [];

      // BOSS直聘 HTML structure for job cards - try multiple selectors
      const selectors = [
        '.job-list .job-primary',
        '.job-card-box',
        '.search-card-con',
        '.job-card-wrap',
        '.search-result-job-detail',
      ];

      for (const selector of selectors) {
        $(selector).each((_, el) => {
          const $el = $(el);
          const jobName = $el.find('.job-title').text().trim()
                       || $el.find('h3').text().trim()
                       || $el.find('.job-name').text().trim()
                       || '';
          const companyName = $el.find('.company-name').text().trim()
                           || $el.find('.name .text').text().trim()
                           || '';
          const city = $el.find('.job-area').text().trim()
                    || $el.find('.city').text().trim()
                    || cityName
                    || '';
          const salary = $el.find('.salary').text().trim() || '';
          const encryptJobId = $el.find('a[data-jobid]').attr('data-jobid')
                            || $el.find('[data-jid]').attr('data-jid')
                            || `zhipin_${Date.now()}_${Math.random().toString(36).slice(2)}`;

          if (jobName) {
            jobs.push({
              encryptJobId,
              jobName,
              companyName,
              city,
              areaDistrict: '',
              workingExp: '',
              salary,
              jobTags: [],
              brandType: '',
              companyLogo: '',
              skills: [],
              positiveMediumScore: '',
              interviewCommentNum: '',
              bossName: '',
              bossTitle: '',
              bossAvatar: '',
              hasImDialog: '',
              expectSalary: '',
              isApply: '',
              isCollect: '',
              hasNewVersion: '',
              vipJobType: '',
              applyShareStatus: '',
              jobCardStatus: '',
              chatRate: '',
              bossActiveTime: '',
              grade: '',
              geo: '',
              location: '',
              gev: '',
              lid: '',
              pageQuery: '',
            });
          }
        });

        if (jobs.length > 0) break;
      }

      return jobs;
    } catch {
      return [];
    }
  }

  async fetchDetail(item: DiscoveredItem, _ctx: CrawlContext): Promise<RawJobRecord> {
    const metadata = isRecord(item.metadata) ? item.metadata : {};
    const jobData = metadata as unknown as ZhipinJobResult['zpData']['jobList'][number];

    let detailHtml = '';
    try {
      const resp = await axios.get(`https://www.zhipin.com/web/geek/job-detail?job=${item.source_job_id}&scene=1`, {
        headers: HTTP_HEADERS,
        timeout: 20000,
      });
      detailHtml = resp.data as string;
    } catch {
      detailHtml = '';
    }

    return {
      source_name: this.sourceName,
      source_job_id: item.source_job_id,
      raw_payload: {
        ...jobData,
        detail_html: detailHtml,
        detail_url: `https://www.zhipin.com/job_detail/${item.source_job_id}.html`,
        entry_url: item.url,
      } as unknown as Record<string, unknown>,
    };
  }

  async normalize(raw: RawJobRecord): Promise<NormalizedJob> {
    const payload = raw.raw_payload as unknown as ZhipinJobResult['zpData']['jobList'][number] & {
      detail_html?: string;
      entry_url?: string;
      city_name?: string;
    };

    const companyName = cleanText(payload.companyName);
    const title = cleanText(payload.jobName);

    if (!companyName) {
      throw new Error(`Zhipin job ${raw.source_job_id} is missing company_name`);
    }
    if (!title) {
      throw new Error(`Zhipin job ${raw.source_job_id} is missing job_name`);
    }

    const jdText = this.extractJdFromHtml(payload.detail_html);
    const internshipType = this.detectInternshipType(
      title + ' ' + (payload.jobTags?.map((t) => t.name).join(' ') || ''),
    );
    const city = normalizeCity(payload.areaDistrict || payload.city || payload.city_name || '');

    const normalized: ZhipinNormalizedJob = {
      company_name: companyName,
      title,
      city,
      is_remote: false,
      internship_type: internshipType,
      deadline: null,
      jd_text: jdText,
      entry_url: payload.entry_url || `https://www.zhipin.com/job_detail/${raw.source_job_id}.html`,
      source_job_id: raw.source_job_id,
    };

    return normalized;
  }

  private extractJdFromHtml(html: string | undefined): string | null {
    if (!html) return null;

    try {
      const $ = load(html);
      const jdSelectors = [
        '.job-detail-text',
        '#job_detail',
        '.job-desc',
        '[class*="detail"]',
        '.job-info',
        '.desc',
      ];

      for (const selector of jdSelectors) {
        const node = $(selector);
        if (node.length > 0) {
          const text = cleanText(node.text());
          if (text.length > 30) return text;
        }
      }

      const body = $('body');
      const text = body.clone().find('script, style, nav, header, footer, .ad, .sidebar, .salary-confirm').remove().end().text();
      return cleanText(text) || null;
    } catch {
      return null;
    }
  }

  private detectInternshipType(text: string): string {
    if (/实习(?![生员])/u.test(text)) {
      return '实习';
    }
    return '校招';
  }

  async extractEntrypoints(job: NormalizedJob): Promise<JobEntrypointInput[]> {
    const zhipinJob = job as ZhipinNormalizedJob;
    return [
      {
        entry_type: 'official',
        entry_url: zhipinJob.entry_url,
        visibility: 'public',
        requires_auth: false,
        referrer_name: 'BOSS直聘',
        source_job_id: zhipinJob.source_job_id,
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

function normalizeCity(raw: string | undefined): string {
  if (!raw) return '';
  return raw.replace(/市|区$/, '').replace(/^不限[，,、]?\s*/u, '').trim();
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
