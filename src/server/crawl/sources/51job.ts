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

const SEARCH_API = 'https://we.51job.com/api/job/search-pc';
const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://we.51job.com/pc/search',
};

const log = createLogger('crawl/51job');

interface Job51Item {
  jobid: string;
  job_name: string;
  company_name: string;
  companyid: string;
  providesalary_text: string;
  workarea: string;
  workarea_text: string;
  updatedate: string;
  iscollect: string;
  isvalid: string;
  jobwelf: string;
  attribute_text: string[];
  companytype_text: string;
}

interface JobSearchResult {
  result?: {
    job: Job51Item[];
    jobcount: number;
    page_no: number;
    page_size: number;
    total_page: number;
  };
  code: number;
  message: string;
}

const INCLUDE_RECRUIT_KEYWORDS = /校园招聘|秋招|春招|202[4-9]届|20\d{2}届|实习生提前批|校招补录|校园精英|暑期实习提前批/iu;
const EXCLUDE_NON_JOB = /宣讲会|笔经|面经|经验分享|求职信|简历模板|笔试真题|面试技巧|大赛|挑战赛|管理培训生|精英计划/iu;
const EXCLUDE_INDUSTRY = /房产|地产|置业顾问|经纪人|中介(?!机)|物业(?!管理)|银行|国有银行|商业银行|信用社|村镇银行|证券|基金|期货|保险|安邦|人寿|平安|太平洋|新华|泰康|信托|资产管理|投行|承销|保荐|地产开发|物业管理|建筑|施工|工程监理|造价咨询|装修|装饰|园林|规划设计|市政|路桥|隧道|钢结构|政府部门|街道办事处|社区|居委会|事业单位|机关单位|政府机构|教育局|卫生局|医院|医疗机构|诊所|药店|药房|医学院|高校|大学|中学|小学|幼儿园|教育机构|培训|学校|驾校|职业技术学院|政府|央企|国企|中国石油|中国石化|中国建筑|中国中铁|中国铁建|中国交建|中国中车|国家电网|南方电网|烟草|电网|电力|火电|水电|核电|风电|光伏|能源|煤炭|矿产|采矿|冶金|钢铁|铝业|铜业|有色金属|化工|石油|天然气|炼化|煤化工|化肥|农药|农业|种植|养殖|畜牧|兽医|食品|饮料|酒|乳业|茶|粮油|调味|保健品|制造业|机械|机床|汽车制造|整车厂|重卡|客车|商用车|农机|船舶|航空|航天|军工|部队|军区|物流|快递|运输|仓储|供应链|贸易|进出口|商贸|批发|零售|超市|便利店|百货|购物中心|商业综合体|餐饮|酒店|旅游|航空|机场|铁路|地铁|公路|公交|出租车|驾培|传媒|出版|印刷|广告|公关|会展|咨询|猎头|人力资源外包|会计|审计|律师|公证|商标|专利|翻译|检测|认证|计量|标准|特种设备|环保|污水处理|固废处理|环卫|园林绿化|政府|公共事业|公用事业|给排水|燃气|供热|通信|运营商|基础电信|广播电视|电影|电视台|电台|剧院|演出|经纪公司|模特|网红|直播带货|微商|直销|传销|贵金属|金银|珠宝|典当|小额贷款|民间借贷|担保|租赁|融资租赁|商业保理|消费金融|征信|支付|银行卡|信用卡|收单|POS|公积金|社保|人事代理|劳务派遣|外事|领事馆|签证|移民|出入境|检验检疫|海关|口岸|保税区|开发区|高新区|创业园|孵化器|众创空间|科技园|产业园区|管委会|人民政府|党委|组织部|宣传部|统战部|发改委|工信部|商务部|财政部|人社部|住建部|交通部|水利部|农业部|商务部|文旅部|卫健委|药监局|市场监管|质监局|检验检疫|气象局|地震局|测绘局|档案局|统计局|信访局|法制办|外办|台办|侨办|民宗局|民盟|民建|民进|农工|致公|九三|台盟|共青团|工会|妇联|残联|科协|文联|作协|红十字会|慈善|基金会|老龄委|关工委|老龄办/iu;
const INCLUDE_TECH = /字节|腾讯|阿里|百度|美团|京东|拼多多|网易|快手|滴滴|小米|华为|OPPO|vivo|苹果|谷歌|Metaicrosoft|亚马逊|NVIDIA|Intel|AMD|高通|联发科|台积电|三星|商汤|旷视|依图|云从|寒武纪|地平线|芯动|壁仞|摩尔线程|燧原|天数智芯|沐曦|海光|龙芯|兆芯|申威|飞腾|华为海思|紫光展锐|中兴通讯|烽火通信|中际旭创|新易盛|剑桥科技|天孚通信|光迅科技|华工科技|大族激光|锐科激光|海康威视|大华股份|宇视科技|智慧安防|科大讯飞|云从科技|第四范式|九章云极|同盾科技|百分科技|智能科技|人工智能|AI[器用运]|机器学习|深度学习|计算机视觉|自然语言处理|NLP|语音识别|语义计算|大模型|LLM|ChatGPT|GPT|文心|通义|KIMI|豆包|DeepSeek|元宝|AI[应岗]|生成式|算法工程|云计算|云原生|IaaS|PaaS|SaaS|公有云|私有云|混合云|云服务|云平台|云厂商|云存储|云安全|云数据库|云网络|云服务器|CDN|边缘计算|雾计算|算力|算力服务|算力平台|大数据|数据湖|数据仓库|Hadoop|Spark|Flink|Kafka|ETL|数据开发|数据分析|数据挖掘|数据工程|数据平台|数据治理|湖仓一体|数据中台|数据资产|数据服务|数据科学|数据分析师|BI|商业智能|游戏|网络游戏|手游|端游|页游|VR|AR|MR|元宇宙|虚拟现实|增强现实|混合现实|Unity|Unreal|图形渲染|游戏客户端|游戏服务端|游戏策划|游戏美术|游戏运营|游戏测试|游戏发行|游戏渠道|游戏研发|电商|电子商务|跨境电商|直播电商|社交电商|内容电商|兴趣电商|即时零售|社区团购|生鲜电商|汽车电商|医药电商|二手电商|电商平台|电商运营|电商技术|电商开发|电商产品|新能源|电动汽车|智能汽车|自动驾驶|车联网|智能座舱|ADAS|毫米波雷达|激光雷达|传感器融合|电池管理|电驱动|充电桩|换电站|储能|光伏|风电|新能源材料|新能源技术|氢能|碳中和|碳交易|环保|新材料|先进材料|纳米材料|石墨烯|碳纤维|3D打印|增材制造|芯片|半导体|集成电路|IC设计|晶圆制造|封装测试|EDA工具|IP核|FPGA|ASIC|SOC|MCU|CPU|GPU|AI芯片|存储芯片|模拟芯片|功率半导体|汽车芯片|射频芯片|光芯片|微电子|电子工程|电路设计|PCB|嵌入式|单片机|物联网|IoT|智能硬件|智能家居|智能穿戴|智能音箱|智能手环|智能手表|TWS|AR眼镜|VR眼镜|无人机|机器人|服务机器人|工业机器人|手术机器人|手术导航|医疗机器人|康复机器人|扫地机器人|智能客服|对话系统|知识图谱|推荐系统|搜索算法|NLP算法|语音助手|智能助手|自动驾驶算法|路径规划|感知算法|定位算法|控制算法|规控|预测算法|仿真测试|网络安全|信息安全|数据安全|云安全|应用安全|主机安全|网络安全工控安全|漏洞挖掘|渗透测试|逆向工程|密码学|零信任|安全运营|SOC|威胁情报|态势感知|入侵检测|防火墙|WAF|DDoS|APT|红蓝对抗|应急响应|代码安全|软件安全|通信技术|5G|6G|蜂窝网络|无线通信|光通信|卫星通信|量子通信|通信设备|基站|天线|滤波器|射频前端|功放|交换机|路由器|光模块|光纤|SDN|NFV|网络架构|网络优化|运营商|电信|联通|移动|虚拟运营商|运营商业务|软硬件|软开|软测|软工|软件开发|软件测试|软件实施|软件运维|ERP实施|SAP实施|Oracle实施|售前咨询|解决方案|系统集成|IT咨询|IT服务|运维开发|DevOps|SRE|平台工程|云原生开发|容器化|Kubernetes|Docker|微服务|Service Mesh|服务网格|分布式|高并发|海量数据|中间件|消息队列|RabbitMQ|ActiveMQ|Kafka|RocketMQ|注册中心|配置中心|网关|负载均衡|限流|熔断|降级|链路追踪|全链路|APM|监控|日志|链路日志|全链路日志|链路监控|调用链|分布式追踪|分布式事务|Seata|TCC|Saga|可靠消息|最终一致性|分布式锁|分布式缓存|Redis集群|Memcached|分布式存储|对象存储|块存储|文件存储|MinIO|数据库|MySQL|PostgreSQL|Redis|MongoDB|ElasticSearch|ClickHouse|Doris|StarRocks|TiDB|OLAP|OLTP|HTAP|时序数据库|图数据库|向量数据库|数据同步|数据迁移|ETL|数据管道|实时计算|流计算|批处理|数据湖|湖仓一体|DeltaLake|Iceberg|Hudi|机器学习平台|MLOps|AI平台|模型训练|模型部署|模型服务化|模型压缩|模型量化|模型蒸馏|模型加速|Triton|TensorRT|ONNX|预训练|微调|RLHF|Agent|AI Agent|多模态|多模态模型|文生图|图生图|文生视频|视频生成|AI生成|内容生成式|创意生成|AI[开研]|AI[开岗]|AI[程发岗]/iu;

type Job51NormalizedJob = NormalizedJob & {
  entry_url: string;
  source_job_id: string;
};

export class Job51Adapter implements SourceAdapter {
  readonly sourceName = '前程无忧';
  readonly sourceType = 'public' as const;

  async discover(ctx: CrawlContext): Promise<DiscoveredItem[]> {
    const items: DiscoveredItem[] = [];
    const regions = ['010000', '020000', '030200', '040000', '070300', '080200', '090200', '170300', '200200', '250300'];
    const regionNames = ['北京', '上海', '广州', '深圳', '杭州', '成都', '南京', '武汉', '西安', '苏州'];

    for (let i = 0; i < regions.length; i++) {
      for (let page = 1; page <= 5; page++) {
        try {
          const region = regions[i];
          const regionName = regionNames[i];
          const pageItems = await this.fetchSearchPage(region, regionName, page);
          if (pageItems.length === 0) break;

          for (const job of pageItems) {
            if (EXCLUDE_INDUSTRY.test(job.job_name + job.company_name)) continue;
            if (!INCLUDE_TECH.test(job.job_name + job.company_name)) continue;
            if (!INCLUDE_RECRUIT_KEYWORDS.test(job.job_name + job.company_name)) continue;
            if (EXCLUDE_NON_JOB.test(job.job_name)) continue;

            items.push({
              source_job_id: job.jobid,
              title: cleanText(job.job_name),
              url: `https://we.51job.com/pc/job?jobid=${job.jobid}`,
              metadata: {
                ...job,
                entry_url: `https://we.51job.com/pc/job?jobid=${job.jobid}`,
              } as unknown as Record<string, unknown>,
            });
          }
          if (items.length >= 200) break;
        } catch (err) {
          log.warn({ err, regionIdx: i }, 'Failed to fetch 51job region page');
        }
      }
      if (items.length >= 200) break;
    }

    return items;
  }

  private async fetchSearchPage(regionCode: string, regionName: string, page: number): Promise<Job51Item[]> {
    const response = await axios.get<JobSearchResult>(SEARCH_API, {
      headers: HTTP_HEADERS,
      params: {
        api_search: 1,
        page,
        region: regionCode,
        keyword: '校园招聘',
        workarea: regionCode,
        jobarea: regionCode,
        salary: '0,0',
        workYear: '',
        degree: '',
        jobType: '',
        companyType: '',
        company_size: '',
        order: '1',
        pageSize: '50',
        useJobL: 'true',
        source: '51zjlc_pc',
        lang: 'c',
        posthead: '',
        dir: '1',
        label: '',
      },
      timeout: 20000,
    });

    return response.data.result?.job ?? [];
  }

  async fetchDetail(item: DiscoveredItem, _ctx: CrawlContext): Promise<RawJobRecord> {
    const metadata = isRecord(item.metadata) ? item.metadata : {};
    const jobData = metadata as unknown as Job51Item;

    let detailHtml = '';
    try {
      const resp = await axios.get(`https://we.51job.com/pc/job/${item.source_job_id}.html`, {
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
        detail_url: `https://we.51job.com/pc/job/${item.source_job_id}.html`,
        entry_url: item.url,
      } as unknown as Record<string, unknown>,
    };
  }

  async normalize(raw: RawJobRecord): Promise<NormalizedJob> {
    const payload = raw.raw_payload as unknown as Job51Item & {
      detail_html?: string;
      entry_url?: string;
    };

    const companyName = cleanText(payload.company_name);
    const title = cleanText(payload.job_name);

    if (!companyName) {
      throw new Error(`51job job ${raw.source_job_id} is missing company_name`);
    }
    if (!title) {
      throw new Error(`51job job ${raw.source_job_id} is missing job_name`);
    }

    const jdText = this.extractJdFromHtml(payload.detail_html);
    const internshipType = this.detectInternshipType(title + ' ' + (payload.attribute_text?.join(' ') || ''));
    const city = normalizeCity(payload.workarea_text || '');
    const deadline = this.parseDeadline(payload.updatedate);

    const normalized: Job51NormalizedJob = {
      company_name: companyName,
      title,
      city,
      is_remote: false,
      internship_type: internshipType,
      deadline,
      jd_text: jdText,
      entry_url: payload.entry_url || `https://we.51job.com/pc/job/${raw.source_job_id}.html`,
      source_job_id: raw.source_job_id,
    };

    return normalized;
  }

  private extractJdFromHtml(html: string | undefined): string | null {
    if (!html) return null;

    try {
      const $ = load(html);
      const jdSelectors = [
        '.job_msg',
        '#job_detail',
        '.job-description',
        '[class*="detail"]',
        '.clearfix',
        '.job-intro',
      ];

      for (const selector of jdSelectors) {
        const node = $(selector);
        if (node.length > 0) {
          const text = cleanText(node.text());
          if (text.length > 50) return text;
        }
      }

      const body = $('body');
      const text = body.clone().find('script, style, nav, header, footer, .ad, .sidebar').remove().end().text();
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

  private parseDeadline(updatedate: string): string | null {
    if (!updatedate) return null;
    const match = updatedate.match(/\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];

    const date = new Date(updatedate);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  async extractEntrypoints(job: NormalizedJob): Promise<JobEntrypointInput[]> {
    const job51 = job as Job51NormalizedJob;
    return [
      {
        entry_type: 'official',
        entry_url: job51.entry_url,
        visibility: 'public',
        requires_auth: false,
        referrer_name: '前程无忧',
        source_job_id: job51.source_job_id,
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
  return raw.split('-').pop()?.replace(/市$/, '').trim() ?? raw;
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
