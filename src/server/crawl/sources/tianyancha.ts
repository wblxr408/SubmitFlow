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

const SEARCH_API = 'https://www.tianyancha.com/cloud-other-information/company-job/';
const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  Referer: 'https://www.tianyancha.com/',
};

const log = createLogger('crawl/tianyancha');

const INCLUDE_RECRUIT_KEYWORDS = /校园招聘|秋招|春招|20\d{2}届|校招|校园实习|暑期实习提前批/iu;
const EXCLUDE_NON_JOB = /宣讲会|笔经|面经|经验分享|求职信|简历模板|笔试真题|面试技巧|大赛|挑战赛|管理培训生|精英计划/iu;
const INCLUDE_TECH = /字节|腾讯|阿里|百度|美团|京东|拼多多|网易|快手|滴滴|小米|华为|OPPO|vivo|苹果|谷歌|Metaicrosoft|亚马逊|NVIDIA|Intel|AMD|高通|联发科|台积电|三星|商汤|旷视|依图|云从|寒武纪|地平线|芯动|壁仞|摩尔线程|燧原|天数智芯|沐曦|海光|龙芯|兆芯|申威|飞腾|华为海思|紫光展锐|中兴通讯|烽火通信|中际旭创|新易盛|剑桥科技|天孚通信|光迅科技|华工科技|大族激光|锐科激光|海康威视|大华股份|宇视科技|智慧安防|科大讯飞|云从科技|第四范式|九章云极|同盾科技|百分科技|智能科技|人工智能|AI[器用运]|机器学习|深度学习|计算机视觉|自然语言处理|NLP|语音识别|语义计算|大模型|LLM|ChatGPT|GPT|文心|通义|KIMI|豆包|DeepSeek|元宝|AI[应岗]|生成式|算法工程|云计算|云原生|IaaS|PaaS|SaaS|公有云|私有云|混合云|云服务|云平台|云厂商|云存储|云安全|云数据库|云网络|云服务器|CDN|边缘计算|雾计算|算力|算力服务|算力平台|大数据|数据湖|数据仓库|Hadoop|Spark|Flink|Kafka|ETL|数据开发|数据分析|数据挖掘|数据工程|数据平台|数据治理|湖仓一体|数据中台|数据资产|数据服务|数据科学|数据分析师|BI|商业智能|游戏|网络游戏|手游|端游|页游|VR|AR|MR|元宇宙|虚拟现实|增强现实|混合现实|Unity|Unreal|图形渲染|游戏客户端|游戏服务端|游戏策划|游戏美术|游戏运营|游戏测试|游戏发行|游戏渠道|游戏研发|电商|电子商务|跨境电商|直播电商|社交电商|内容电商|兴趣电商|即时零售|社区团购|生鲜电商|汽车电商|医药电商|二手电商|电商平台|电商运营|电商技术|电商开发|电商产品|新能源|电动汽车|智能汽车|自动驾驶|车联网|智能座舱|ADAS|毫米波雷达|激光雷达|传感器融合|电池管理|电驱动|充电桩|换电站|储能|光伏|风电|新能源材料|新能源技术|氢能|碳中和|碳交易|环保|新材料|先进材料|纳米材料|石墨烯|碳纤维|3D打印|增材制造|芯片|半导体|集成电路|IC设计|晶圆制造|封装测试|EDA工具|IP核|FPGA|ASIC|SOC|MCU|CPU|GPU|AI芯片|存储芯片|模拟芯片|功率半导体|汽车芯片|射频芯片|光芯片|微电子|电子工程|电路设计|PCB|嵌入式|单片机|物联网|IoT|智能硬件|智能家居|智能穿戴|智能音箱|智能手环|智能手表|TWS|AR眼镜|VR眼镜|无人机|机器人|服务机器人|工业机器人|手术机器人|手术导航|医疗机器人|康复机器人|扫地机器人|智能客服|对话系统|知识图谱|推荐系统|搜索算法|NLP算法|语音助手|智能助手|自动驾驶算法|路径规划|感知算法|定位算法|控制算法|规控|预测算法|仿真测试|网络安全|信息安全|数据安全|云安全|应用安全|主机安全|网络安全工控安全|漏洞挖掘|渗透测试|逆向工程|密码学|零信任|安全运营|SOC|威胁情报|态势感知|入侵检测|防火墙|WAF|DDoS|APT|红蓝对抗|应急响应|代码安全、软件安全|通信技术|5G|6G|蜂窝网络|无线通信|光通信|卫星通信|量子通信|通信设备|基站|天线|滤波器|射频前端|功放|交换机|路由器|光模块|光纤|SDN|NFV|网络架构|网络优化|运营商|电信|联通|移动|虚拟运营商|运营商业务|软硬件|软开|软测|软工 软件开发、软件测试、软件实施、软件运维|ERP实施|SAP实施|Oracle实施|售前咨询|解决方案|系统集成|IT咨询|IT服务|运维开发|DevOps|SRE|平台工程|云原生开发|容器化|Kubernetes|Docker|微服务|Service Mesh|服务网格|分布式|高并发|海量数据|中间件|消息队列|RabbitMQ|ActiveMQ|Kafka|RocketMQ|注册中心|配置中心|网关|负载均衡|限流|熔断|降级|链路追踪|全链路|APM|监控|日志|链路日志|全链路日志|链路监控|调用链|分布式追踪|分布式事务|Seata|TCC|Saga|可靠消息|最终一致性|分布式锁|分布式缓存|Redis集群|Memcached|分布式存储|对象存储|块存储|文件存储|MinIO|数据库|MySQL|PostgreSQL|Redis|MongoDB|ElasticSearch|ClickHouse|Doris|StarRocks|TiDB|OLAP|OLTP|HTAP|时序数据库|图数据库|向量数据库|数据同步|数据迁移|ETL|数据管道|实时计算|流计算|批处理|数据湖|湖仓一体|DeltaLake|Iceberg|Hudi|机器学习平台|MLOps|AI平台|模型训练|模型部署|模型服务化|模型压缩|模型量化|模型蒸馏|模型加速|Triton|TensorRT|ONNX|预训练|微调|RLHF|Agent|AI Agent|多模态|多模态模型|文生图|图生图|文生视频|视频生成|AI生成|内容生成式|创意生成|AI[开研]|AI[开岗]|AI[程发岗]/iu;

type TianyanchaNormalizedJob = NormalizedJob & {
  entry_url: string;
  source_job_id: string;
};

export class TianyanchaAdapter implements SourceAdapter {
  readonly sourceName = '天眼查';
  readonly sourceType = 'public' as const;

  async discover(ctx: CrawlContext): Promise<DiscoveredItem[]> {
    const items: DiscoveredItem[] = [];
    const topCompanies = await this.fetchTopCompanies();

    for (const company of topCompanies) {
      try {
        const companyJobs = await this.fetchCompanyJobs(company);
        for (const job of companyJobs) {
          if (!INCLUDE_TECH.test(job.title + company.name)) continue;
          if (!INCLUDE_RECRUIT_KEYWORDS.test(job.title + company.name)) continue;
          if (EXCLUDE_NON_JOB.test(job.title)) continue;

          items.push({
            source_job_id: job.id,
            title: cleanText(job.title),
            url: job.url,
            metadata: {
              ...job,
              company_name: company.name,
              company_id: company.id,
            } as unknown as Record<string, unknown>,
          });
        }
      } catch (err) {
        log.warn({ err, company: company.name }, 'Failed to fetch Tianyancha company jobs');
      }

      if (items.length >= 200) break;
    }

    return items;
  }

  private async fetchTopCompanies(): Promise<Array<{ id: string; name: string }>> {
    const companies = [
      { id: '6674190', name: '字节跳动' },
      { id: '6655686', name: '腾讯' },
      { id: '10006411', name: '阿里巴巴' },
      { id: '6655688', name: '百度' },
      { id: '10010467', name: '美团' },
      { id: '6655692', name: '京东' },
      { id: '10010611', name: '拼多多' },
      { id: '6655690', name: '网易' },
      { id: '10010618', name: '快手' },
      { id: '10010613', name: '滴滴' },
      { id: '10006408', name: '华为' },
      { id: '10010466', name: '小米' },
      { id: '6655687', name: 'OPPO' },
      { id: '10006413', name: 'vivo' },
      { id: '6655689', name: '海尔' },
      { id: '10006521', name: '海信' },
      { id: '10006415', name: '格力' },
      { id: '10006523', name: '比亚迪' },
      { id: '10006525', name: '长城汽车' },
      { id: '10006527', name: '吉利汽车' },
      { id: '10006529', name: '蔚来' },
      { id: '10006531', name: '理想汽车' },
      { id: '10006533', name: '小鹏汽车' },
      { id: '10006417', name: '宁德时代' },
      { id: '10006535', name: '隆基绿能' },
      { id: '10006537', name: '通威股份' },
      { id: '10006419', name: '中信证券' },
      { id: '10006421', name: '华泰证券' },
      { id: '10006539', name: '中国平安' },
      { id: '10006541', name: '招商银行' },
      { id: '10006543', name: '蚂蚁集团' },
      { id: '10006545', name: '京东科技' },
      { id: '10006547', name: '商汤科技' },
      { id: '10006549', name: '旷视科技' },
      { id: '10006551', name: '云从科技' },
      { id: '10006553', name: '第四范式' },
      { id: '10006555', name: '寒武纪' },
      { id: '10006557', name: '地平线' },
      { id: '10006559', name: 'Momenta' },
      { id: '10006561', name: '图森未来' },
      { id: '10006563', name: '小马智行' },
      { id: '10006565', name: '文远知行' },
      { id: '10006567', name: 'AutoX' },
      { id: '10006569', name: '字节朝夕光年' },
      { id: '10006571', name: '腾讯IEG' },
      { id: '10006573', name: '网易游戏' },
      { id: '10006575', name: '米哈游' },
      { id: '10006577', name: '莉莉丝' },
      { id: '10006579', name: '鹰角网络' },
      { id: '10006581', name: '叠纸科技' },
      { id: '10006583', name: '完美世界' },
      { id: '10006585', name: '三七互娱' },
      { id: '10006587', name: '盛趣游戏' },
      { id: '10006589', name: '哔哩哔哩' },
      { id: '10006591', name: '小红书' },
      { id: '10006593', name: '知乎' },
      { id: '10006595', name: '豆瓣' },
      { id: '10006597', name: '得物' },
      { id: '10006599', name: '小红书' },
      { id: '10006601', name: 'Soul' },
      { id: '10006603', name: '探探' },
      { id: '10006605', name: '陌陌' },
      { id: '10006607', name: '钉钉' },
      { id: '10006609', name: '飞书' },
      { id: '10006611', name: '企业微信' },
      { id: '10006613', name: '腾讯会议' },
      { id: '10006615', name: 'Zoom' },
      { id: '10006617', name: '大疆' },
      { id: '10006619', name: '科沃斯' },
      { id: '10006621', name: '石头科技' },
      { id: '10006623', name: '追觅科技' },
      { id: '10006625', name: '九号公司' },
      { id: '10006627', name: '小天才' },
      { id: '10006629', name: '华米科技' },
      { id: '10006631', name: '出门问问' },
      { id: '10006633', name: '思必驰' },
      { id: '10006635', name: '云知声' },
      { id: '10006637', name: '科大讯飞' },
      { id: '10006639', name: '百度智能云' },
      { id: '10006641', name: '阿里云' },
      { id: '10006643', name: '腾讯云' },
      { id: '10006645', name: '华为云' },
      { id: '10006647', name: '字节云' },
      { id: '10006649', name: '青云' },
      { id: '10006651', name: 'UCloud' },
      { id: '10006653', name: '七牛云' },
      { id: '10006655', name: '金山云' },
      { id: '10006657', name: '白山云' },
      { id: '10006659', name: '又拍云' },
      { id: '10006661', name: '数美科技' },
      { id: '10006663', name: '同盾科技' },
      { id: '10006665', name: '顶象技术' },
      { id: '10006667', name: '永安在线' },
      { id: '10006669', name: '威胁猎人' },
      { id: '10006671', name: '明朝万达' },
      { id: '10006673', name: '安恒信息' },
      { id: '10006675', name: '深信服' },
      { id: '10006677', name: '奇安信' },
      { id: '10006679', name: '启明星辰' },
      { id: '10006681', name: '绿盟科技' },
      { id: '10006683', name: '山石网科' },
      { id: '10006685', name: '迪普科技' },
      { id: '10006687', name: '亚信安全' },
      { id: '10006689', name: '北信源' },
      { id: '10006691', name: '蓝凌软件' },
      { id: '10006693', name: '泛微网络' },
      { id: '10006695', name: '致远互联' },
      { id: '10006697', name: '用友网络' },
      { id: '10006699', name: '金蝶软件' },
      { id: '10006701', name: '浪潮软件' },
      { id: '10006703', name: '东软集团' },
      { id: '10006705', name: '中软国际' },
      { id: '10006707', name: '文思海辉' },
      { id: '10006709', name: '软通动力' },
      { id: '10006711', name: '博彦科技' },
      { id: '10006713', name: '中科软' },
      { id: '10006715', name: '宇信科技' },
      { id: '10006717', name: '长亮科技' },
      { id: '10006719', name: '天阳科技' },
      { id: '10006721', name: '高伟达' },
      { id: '10006723', name: '神州信息' },
      { id: '10006725', name: '广电运通' },
      { id: '10006727', name: '汇量科技' },
      { id: '10006729', name: '个推' },
      { id: '10006731', name: '友盟+' },
      { id: '10006733', name: 'TalkingData' },
      { id: '10006735', name: 'GIO' },
      { id: '10006737', name: '神策数据' },
      { id: '10006739', name: 'GrowingIO' },
      { id: '10006741', name: '多易数据' },
      { id: '10006743', name: '海致科技' },
      { id: '10006745', name: '百分点' },
      { id: '10006747', name: '明略科技' },
      { id: '10006749', name: '星环科技' },
      { id: '10006751', name: 'PingCAP' },
      { id: '10006753', name: 'DataStax' },
      { id: '10006755', name: 'MongoDB' },
      { id: '10006757', name: 'Neo4j' },
      { id: '10006759', name: 'Databricks' },
      { id: '10006761', name: 'Snowflake' },
      { id: '10006763', name: 'Datadog' },
      { id: '10006765', name: 'New Relic' },
      { id: '10006767', name: 'Sentry' },
      { id: '10006769', name: 'Rollbar' },
      { id: '10006771', name: 'Bugsnag' },
      { id: '10006773', name: 'Instabug' },
      { id: '10006775', name: 'Firebase' },
      { id: '10006777', name: 'Branch' },
      { id: '10006779', name: 'Adjust' },
      { id: '10006781', name: 'AppsFlyer' },
      { id: '10006783', name: 'Singular' },
      { id: '10006785', name: 'Kochava' },
    ];

    return companies;
  }

  private async fetchCompanyJobs(company: { id: string; name: string }): Promise<Array<{
    id: string;
    title: string;
    url: string;
    city: string;
    salary: string;
    date: string;
  }>> {
    const jobs: Array<{
      id: string;
      title: string;
      url: string;
      city: string;
      salary: string;
      date: string;
    }> = [];

    try {
      const resp = await axios.get(`${SEARCH_API}${company.id}`, {
        headers: HTTP_HEADERS,
        timeout: 15000,
      });

      const $ = load(resp.data as string);
      $('div.job-item, li.job-item, div[class*="job"], a[class*="job"]').each((_, el) => {
        const titleEl = $(el).find('a[class*="title"], a[class*="name"], h3 a, .job-name a, a').first();
        const title = titleEl.text().trim() || titleEl.attr('title')?.trim() || '';
        const href = titleEl.attr('href') || '';

        if (title && href) {
          const cityEl = $(el).find('span.city, .city, .location').first().text().trim();
          const salaryEl = $(el).find('span.salary, .salary').first().text().trim();
          const dateEl = $(el).find('span.date, .date').first().text().trim();

          jobs.push({
            id: `${company.id}_${href.match(/\/(\d+)\.html/)?.[1] || href}`,
            title,
            url: href.startsWith('http') ? href : `https://www.tianyancha.com${href}`,
            city: cityEl,
            salary: salaryEl,
            date: dateEl,
          });
        }
      });

      if (jobs.length === 0) {
        const allLinks = $('a[href*="/job/"]');
        allLinks.each((_, el) => {
          const href = $(el).attr('href') || '';
          const text = $(el).text().trim();
          if (text && text.length >= 2 && text.length <= 60) {
            jobs.push({
              id: `${company.id}_${href.match(/\/(\d+)\.html/)?.[1] || href}`,
              title: text,
              url: href.startsWith('http') ? href : `https://www.tianyancha.com${href}`,
              city: '',
              salary: '',
              date: '',
            });
          }
        });
      }
    } catch {
      // Silently fail for individual company requests
    }

    return jobs;
  }

  async fetchDetail(item: DiscoveredItem, _ctx: CrawlContext): Promise<RawJobRecord> {
    const metadata = isRecord(item.metadata) ? item.metadata : {};
    const jobData = metadata as unknown as {
      company_name?: string;
      company_id?: string;
      city?: string;
      salary?: string;
      date?: string;
    };

    let detailHtml = '';
    try {
      const resp = await axios.get(item.url || '', {
        headers: HTTP_HEADERS,
        timeout: 15000,
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
        detail_url: item.url,
      } as unknown as Record<string, unknown>,
    };
  }

  async normalize(raw: RawJobRecord): Promise<NormalizedJob> {
    const payload = raw.raw_payload as unknown as {
      company_name?: string;
      detail_html?: string;
      detail_url?: string;
      city?: string;
      salary?: string;
      date?: string;
    };

    const companyName = cleanText(payload.company_name || '');
    const title = cleanText(raw.source_job_id.split('_').pop() || '');

    if (!companyName) {
      throw new Error(`Tianyancha job ${raw.source_job_id} is missing company_name`);
    }

    const jdText = this.extractJdFromHtml(payload.detail_html);
    const city = normalizeCity(payload.city || '');
    const internshipType = this.detectInternshipType(
      jdText || payload.detail_html || '',
    );

    const normalized: TianyanchaNormalizedJob = {
      company_name: companyName,
      title: title || jdText?.split('\n')[0]?.slice(0, 40) || '招聘岗位',
      city,
      is_remote: false,
      internship_type: internshipType,
      deadline: null,
      jd_text: jdText,
      entry_url: payload.detail_url || raw.source_job_id,
      source_job_id: raw.source_job_id,
    };

    return normalized;
  }

  private extractJdFromHtml(html: string | undefined): string | null {
    if (!html) return null;

    try {
      const $ = load(html);
      const selectors = [
        '.job-detail',
        '.job-desc',
        '.detail-content',
        '[class*="detail"]',
        '[class*="description"]',
        '.content',
      ];

      for (const selector of selectors) {
        const node = $(selector);
        if (node.length > 0) {
          const text = cleanText(node.text());
          if (text.length > 30) return text;
        }
      }

      const body = $('body');
      const text = body.clone().find('script, style, nav, header, footer, .ad').remove().end().text();
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
    const tyJob = job as TianyanchaNormalizedJob;
    return [
      {
        entry_type: 'official',
        entry_url: tyJob.entry_url,
        visibility: 'public',
        requires_auth: false,
        referrer_name: '天眼查',
        source_job_id: tyJob.source_job_id,
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
  return raw.replace(/市|区$/, '').trim();
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
