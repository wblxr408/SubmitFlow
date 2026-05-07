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

const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const log = createLogger('crawl/companycareers');

// ============================================================
// Company Groups (by industry)
// ============================================================

/** 互联网大厂 */
const TECH_GIANT_PAGES = [
  'https://careers.tencent.com/',
  'https://careers.tencent.com/campus.html',
  'https://jobs.bytedance.com/campus',
  'https://campus.bytedance.com/',
  'https://talent.baidu.com/',
  'https://campus.alibaba.com/',
  'https://campus.aliyun.com/',
  'https://careers.jd.com/',
  'https://campus.meituan.com/',
  'https://campus.pinduoduo.com/',
  'https://campus.netease.com/',
  'https://campus.kuaishou.cn/',
  'https://campus.antgroup.com/',
  'https://www.sina.com.cn/',
  'https://careers.sina.com.cn/',
  'https://job.sohu.com/',
  'https://campus.bilibili.com/',
  'https://campus.xiu.com/',
  'https://campus.mogan.com/',
  'https://campus.deepin.io/',
  'https://campus.sheingroup.com/',
  'https://campus.360.cn/',
];

/** 手机/硬件厂商 */
const HARDWARE_PAGES = [
  'https://campus.xiaomi.com/',
  'https://campus.huawei.com/',
  'https://campus.vivo.com/',
  'https://campus.oppo.com/',
  'https://campus.mi.com/',
  'https://campus.lenovo.com.cn/',
  'https://careers.oppo.com/',
  'https://campus.realme.com/',
  'https://campus.oneplus.com/',
  'https://campus.transsion.com/',
];

/** 银行 */
const BANK_PAGES = [
  'https://icbc.inesa.cn/',          // 工商银行
  'https://job.ccb.com/',            // 建设银行
  'https://career.bankcomm.com/',   // 交通银行
  'https://career.boc.cn/',          // 中国银行
  'https://job.abchina.com/',        // 农业银行
  'https://career.icbc.com.cn/',
  'https://job.abchina.com/',
  'https://www.bankofbeijing.com.cn/campus/',
  'https://www.bankofshanghai.com/',
  'https://www.bankofnanjing.com.cn/',
  'https://careers.citic.com/campus', // 中信银行
  'https://careers.cmbchina.com/',   // 招商银行
  'https://careers.pingan.com/',     // 平安银行
  'https://careers.hxb.com.cn/',     // 华夏银行
  'https://careers.cebbank.com/',    // 光大银行
  'https://careers.cgbchina.com.cn/', // 广发银行
  'https://careers.citic.com/',      // 中信银行(集团)
  'https://careers.spdb.com.cn/',    // 浦发银行
  'https://career.bosera.com/',      // 华宝基金
];

/** 证券/基金/资管 */
const SECURITIES_PAGES = [
  'https://campus.htsec.com/',       // 海通证券
  'https://campus.gjzq.com.cn/',    // 国金证券
  'https://campus.haitong.com/',     // 海通证券(另一个)
  'https://campus.swfc.com/',        // 上海东吴期货
  'https://campus.essence.com.cn/',  // 安信证券
  'https://careers.citic.com/',      // 中信证券
  'https://campus.gjzq.com.cn/',
  'https://campus.rosefort.com/',   // 融通基金
  'https://campus.swanfund.com/',   // 天弘基金
  'https://campus.afund.com/',      // 蚂蚁基金
  'https://campus.geqfund.com/',    // 工银瑞信
  'https://campus.zhaopin.com/',     // 智联招聘
  'https://campus.51job.com/',      // 前程无忧
];

/** 外资/海外企业 */
const FOREIGN_PAGES = [
  'https://campus.cisco.com/',
  'https://campus.intel.com/',
  'https://campus.nvidia.com/',
  'https://campus.ibm.com/',
  'https://campus.sap.com/',
  'https://campus.oracle.com/',
  'https://campus.samsung.com/',
  'https://campus.lg.com/',
  'https://campus.sony.com/',
  'https://campus.canon.com/',
  'https://campus.hp.com/',
  'https://campus.microfocus.com/',
  'https://campus.bmw.com/',
  'https://campus.mercedes-benz.com/',
  'https://campus.shell.com/',
  'https://campus.exxonmobil.com/',
  'https://careers.apple.com/cn',
  'https://careers.google.com/',
  'https://careers.microsoft.com/',
  'https://www.amazon.jobs/en/regions/asia-pacific',
];

/** 新能源/智能汽车 */
const AUTO_PAGES = [
  'https://campus.xpeng.com.cn/',    // 小鹏汽车
  'https://campus.nio.cn/',          // 蔚来
  'https://campus.byd.com/',
  'https://campus.gac.com/',         // 广汽
  'https://campus.gacna.com/',       // 广汽北美
  'https://campus.changan.com.cn/',
  'https://campus.geely.com/',
  'https://campus.jac.com.cn/',
  'https://campus.lixiang.com/',     // 理想
  'https://campus.zEEKR.com/',
  'https://campus.dffeng.com/',      // 东风风神
  'https://campus.enovismotor.com/', // 智己汽车
  'https://careers.tesla.com/',
];

/** AI/芯片/硬科技 */
const CHIP_AI_PAGES = [
  'https://campus.sensetime.com/',
  'https://campus.mobvoi.com/',
  'https://campus.deepglint.com/',
  'https://campus.megvii.com/',      // 旷视
  'https://campus.yitu.com/',        // 依图
  'https://campus.cambricon.com/',   // 寒武纪
  'https://campus.hikvision.com/',
  'https://campus.dahuatech.com/',
  'https://campus.uniview.com/',
  'https://campus.horizon.ai/',     // 地平线
  'https://campus.rock-chips.com/', // 瑞芯微
  'https://campus.sangfor.com.cn/',  // 深信服
  'https://campus.qingcloud.com/',   // 青云
  'https://campus.jingcloud.com/',  // 景嘉微
];

/** 运营商/通信 */
const CARRIER_PAGES = [
  'https://campus.10086.cn/',
  'https://careers.10010.cn/',
  'https://job.conexpo.cn/',
];

/** 高校就业网 (tech-related universities) */
const UNIVERSITY_PAGES = [
  'https://career.tsinghua.edu.cn/',
  'https://career.pku.edu.cn/',
  'https://career.fudan.edu.cn/',
  'https://career.sjtu.edu.cn/',
  'https://career.zju.edu.cn/',
  'https://career.nju.edu.cn/',
  'https://career.whu.edu.cn/',
  'https://career.hust.edu.cn/',
  'https://career.xjtu.edu.cn/',
  'https://career.hit.edu.cn/',
  'https://career.scu.edu.cn/',
  'https://career.uestc.edu.cn/',
  'https://career.cumt.edu.cn/',
  'https://career.dlut.edu.cn/',
  'https://career.neu.edu.cn/',
  'https://career.swjtu.edu.cn/',
  'https://career.buaa.edu.cn/',
  'https://career.bit.edu.cn/',
  'https://career.buct.edu.cn/',
  'https://career.nwpu.edu.cn/',
  'https://career.xmu.edu.cn/',
  'https://career.fzu.edu.cn/',
  'https://career.cqu.edu.cn/',
  'https://career.hqu.edu.cn/',
  'https://career.shufe.edu.cn/',
  'https://career.uibe.edu.cn/',
  'https://career.ruc.edu.cn/',
  'https://career.cufe.edu.cn/',
  'https://career.seu.edu.cn/',
  'https://career.nuaa.edu.cn/',
  'https://career.njust.edu.cn/',
  'https://career.cpu.edu.cn/',
  'https://career.ecust.edu.cn/',
  'https://career.shu.edu.cn/',
  'https://career.ecnu.edu.cn/',
  'https://career.sudas.cn/',        // 上海数字艺术学院
  'https://career.hhu.edu.cn/',
  'https://career.cug.edu.cn/',
  'https://career.nankai.edu.cn/',
  'https://career.tongji.edu.cn/',
  'https://career.sut.edu.cn/',
  'https://career.dhu.edu.cn/',
  'https://career.shou.edu.cn/',
  'https://career.njupt.edu.cn/',
  'https://career.njau.edu.cn/',
  'https://career.njtech.edu.cn/',
  'https://career.njue.edu.cn/',
  'https://career.nuist.edu.cn/',
  'https://career.bfsu.edu.cn/',
  'https://career.xisu.edu.cn/',
  'https://career.ustc.edu.cn/',
  'https://career.ustb.edu.cn/',
  'https://career.sdu.edu.cn/',
  'https://career.sdufe.edu.cn/',
  'https://career.szu.edu.cn/',
  'https://career.hunnu.edu.cn/',
  'https://career.hunu.edu.cn/',
  'https://career.csu.edu.cn/',
  'https://career.csufe.edu.cn/',
  'https://career.hust.edu.cn/',
  'https://career.wut.edu.cn/',
  'https://career.zuel.edu.cn/',
  'https://career.hzau.edu.cn/',
  'https://career.zjut.edu.cn/',
  'https://career.cjlu.edu.cn/',
  'https://career.cust.edu.cn/',
  'https://career.jlu.edu.cn/',
  'https://career.dlufl.edu.cn/',
  'https://career.syuct.edu.cn/',
  'https://career.cdut.edu.cn/',
  'https://career.swust.edu.cn/',
  'https://career.cdu.edu.cn/',
  'https://career.sues.edu.cn/',
  'https://career.shnu.edu.cn/',
  'https://career.hziee.edu.cn/',
  'https://career.hznu.edu.cn/',
  'https://career.sau.edu.cn/',
  'https://career.cdu.edu.cn/',
  'https://career.nuc.edu.cn/',
  'https://career.imust.edu.cn/',
  'https://career.tyust.edu.cn/',
  'https://career.tyut.edu.cn/',
  'https://career.neu.edu.cn/',
];

const CAMPUS_CAREERS_PAGES = [
  ...TECH_GIANT_PAGES,
  ...HARDWARE_PAGES,
  ...BANK_PAGES,
  ...SECURITIES_PAGES,
  ...FOREIGN_PAGES,
  ...AUTO_PAGES,
  ...CHIP_AI_PAGES,
  ...CARRIER_PAGES,
  ...UNIVERSITY_PAGES,
];

const CAMPUS_KEYWORD_PATTERNS = /校园招聘|秋招|春招|202[4-9]届|20\d{2}届|校招|校园招募|校园实习|暑期实习提前批|校园精英|热招岗位|在招职位|招聘职位|职位列表|岗位名称|校招岗位|热招职位/iu;
const SKIP_PATTERNS = /宣讲会|笔经|面经|经验分享|求职信|简历模板|笔试真题|面试技巧|大赛|挑战赛|管理培训生|精英计划/iu;
const INCLUDE_TECH = /字节|腾讯|阿里|百度|美团|京东|拼多多|网易|快手|滴滴|小米|华为|OPPO|vivo|苹果|谷歌|Metaicrosoft|亚马逊|NVIDIA|Intel|AMD|高通|联发科|台积电|三星|商汤|旷视|依图|云从|寒武纪|地平线|芯动|壁仞|摩尔线程|燧原|天数智芯|沐曦|海光|龙芯|兆芯|申威|飞腾|华为海思|紫光展锐|中兴通讯|烽火通信|中际旭创|新易盛|剑桥科技|天孚通信|光迅科技|华工科技|大族激光|锐科激光|海康威视|大华股份|宇视科技|智慧安防|科大讯飞|云从科技|第四范式|九章云极|同盾科技|百分科技|智能科技|人工智能|AI[器用运]|机器学习|深度学习|计算机视觉|自然语言处理|NLP|语音识别|语义计算|大模型|LLM|ChatGPT|GPT|文心|通义|KIMI|豆包|DeepSeek|元宝|AI[应岗]|生成式|算法工程|云计算|云原生|IaaS|PaaS|SaaS|公有云|私有云|混合云|云服务|云平台|云厂商|云存储|云安全|云数据库|云网络|云服务器|CDN|边缘计算|雾计算|算力|算力服务|算力平台|大数据|数据湖|数据仓库|Hadoop|Spark|Flink|Kafka|ETL|数据开发|数据分析|数据挖掘|数据工程|数据平台|数据治理|湖仓一体|数据中台|数据资产|数据服务|数据科学|数据分析师|BI|商业智能|游戏|网络游戏|手游|端游|页游|VR|AR|MR|元宇宙|虚拟现实|增强现实|混合现实|Unity|Unreal|图形渲染|游戏客户端|游戏服务端|游戏策划|游戏美术|游戏运营|游戏测试|游戏发行|游戏渠道|游戏研发|电商|电子商务|跨境电商|直播电商|社交电商|内容电商|兴趣电商|即时零售|社区团购|生鲜电商|汽车电商|医药电商|二手电商|电商平台|电商运营|电商技术|电商开发|电商产品|新能源|电动汽车|智能汽车|自动驾驶|车联网|智能座舱|ADAS|毫米波雷达|激光雷达|传感器融合|电池管理|电驱动|充电桩|换电站|储能|光伏|风电|新能源材料|新能源技术|氢能|碳中和|碳交易|环保|新材料|先进材料|纳米材料|石墨烯|碳纤维|3D打印|增材制造|芯片|半导体|集成电路|IC设计|晶圆制造|封装测试|EDA工具|IP核|FPGA|ASIC|SOC|MCU|CPU|GPU|AI芯片|存储芯片|模拟芯片|功率半导体|汽车芯片|射频芯片|光芯片|微电子|电子工程|电路设计|PCB|嵌入式|单片机|物联网|IoT|智能硬件|智能家居|智能穿戴|智能音箱|智能手环|智能手表|TWS|AR眼镜|VR眼镜|无人机|机器人|服务机器人|工业机器人|手术机器人|手术导航|医疗机器人|康复机器人|扫地机器人|智能客服|对话系统|知识图谱|推荐系统|搜索算法|NLP算法|语音助手|智能助手|自动驾驶算法|路径规划|感知算法|定位算法|控制算法|规控|预测算法|仿真测试|网络安全|信息安全|数据安全|云安全|应用安全|主机安全|网络安全工控安全|漏洞挖掘|渗透测试|逆向工程|密码学|零信任|安全运营|SOC|威胁情报|态势感知|入侵检测|防火墙|WAF|DDoS|APT|红蓝对抗|应急响应|代码安全、软件安全|通信技术|5G|6G|蜂窝网络|无线通信|光通信|卫星通信|量子通信|通信设备|基站|天线|滤波器|射频前端|功放|交换机|路由器|光模块|光纤|SDN|NFV|网络架构|网络优化|运营商|电信|联通|移动|虚拟运营商|运营商业务|软硬件|软开|软测|软工 软件开发、软件测试、软件实施、软件运维|ERP实施|SAP实施|Oracle实施|售前咨询|解决方案|系统集成|IT咨询|IT服务|运维开发|DevOps|SRE|平台工程|云原生开发|容器化|Kubernetes|Docker|微服务|Service Mesh|服务网格|分布式|高并发|海量数据|中间件|消息队列|RabbitMQ|ActiveMQ|Kafka|RocketMQ|注册中心|配置中心|网关|负载均衡|限流|熔断|降级|链路追踪|全链路|APM|监控|日志|链路日志|全链路日志|链路监控|调用链|分布式追踪|分布式事务|Seata|TCC|Saga|可靠消息|最终一致性|分布式锁|分布式缓存|Redis集群|Memcached|分布式存储|对象存储|块存储|文件存储|MinIO|数据库|MySQL|PostgreSQL|Redis|MongoDB|ElasticSearch|ClickHouse|Doris|StarRocks|TiDB|OLAP|OLTP|HTAP|时序数据库|图数据库|向量数据库|数据同步|数据迁移|ETL|数据管道|实时计算|流计算|批处理|数据湖|湖仓一体|DeltaLake|Iceberg|Hudi|机器学习平台|MLOps|AI平台|模型训练|模型部署|模型服务化|模型压缩|模型量化|模型蒸馏|模型加速|Triton|TensorRT|ONNX|预训练|微调|RLHF|Agent|AI Agent|多模态|多模态模型|文生图|图生图|文生视频|视频生成|AI生成|内容生成式|创意生成|AI[开研]|AI[开岗]|AI[程发岗]/iu;
const JOB_TITLE_INDICATORS = /热招岗位|在招职位|招聘职位|职位列表|岗位名称|校招岗位|热招职位/iu;

type CompanyNormalizedJob = NormalizedJob & {
  entry_url: string;
  source_job_id: string;
  company_name: string;
};

export class CompanyCareersAdapter implements SourceAdapter {
  readonly sourceName = '官网直接投递';
  readonly sourceType = 'public' as const;

  async discover(ctx: CrawlContext): Promise<DiscoveredItem[]> {
    const items: DiscoveredItem[] = [];
    const seenUrls = new Set<string>();

    for (const careersUrl of CAMPUS_CAREERS_PAGES) {
      let retries = 2;
      while (retries >= 0) {
        try {
          // Add delay between requests to avoid rate limiting
          await new Promise(r => setTimeout(r, 800));

          const discovered = await this.scrapeCompanyCareers(careersUrl);
          for (const item of discovered) {
            if (!item.url || seenUrls.has(item.url)) continue;
            if (item.url.startsWith('mailto:') || item.url.startsWith('tel:')) continue;
            const companyName = (item.metadata as Record<string, unknown>)?.company_name as string || '';
            const jobTitle = item.title || '';
            if (!INCLUDE_TECH.test(companyName + ' ' + jobTitle)) continue;
            seenUrls.add(item.url);

            items.push(item);
          }
          break; // success, exit retry loop
        } catch (err) {
          retries -= 1;
          if (retries < 0) {
            log.warn({ err, url: careersUrl }, 'Failed to fetch company careers page after 3 attempts');
            break;
          }
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (items.length >= 200) break;
    }

    return items;
  }

  private async scrapeCompanyCareers(careersUrl: string): Promise<DiscoveredItem[]> {
    const items: DiscoveredItem[] = [];

    let html = '';
    try {
      const resp = await axios.get<string>(careersUrl, {
        headers: HTTP_HEADERS,
        timeout: 15000,
        responseType: 'text',
      });
      html = resp.data as string;
    } catch {
      return items;
    }

    const companyName = this.extractCompanyName(careersUrl);
    const $ = load(html);

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      if (!href || !text) return;
      if (SKIP_PATTERNS.test(text)) return;

      const fullUrl = normalizeUrl(href, careersUrl);
      if (!this.isJobListingUrl(fullUrl, text, $)) return;

      const sourceJobId = this.buildJobId(fullUrl, text);
      items.push({
        source_job_id: sourceJobId,
        title: cleanText(text),
        url: fullUrl,
        metadata: {
          company_name: companyName,
          careers_url: careersUrl,
          discovered_url: fullUrl,
          discovered_text: text,
        } as unknown as Record<string, unknown>,
      });
    });

    const jsonLdJobs = this.parseJsonLdJobs(html, companyName, careersUrl);
    for (const job of jsonLdJobs) {
      if (!job.url || items.some((i) => i.url === job.url)) continue;
      items.push(job);
    }

    return items;
  }

  private isJobListingUrl(url: string, text: string, $: ReturnType<typeof load>): boolean {
    const combined = (url + ' ' + text).toLowerCase();

    if (!CAMPUS_KEYWORD_PATTERNS.test(combined) && !JOB_TITLE_INDICATORS.test(text)) {
      return false;
    }

    if (text.length < 2 || text.length > 60) return false;
    if (/查看更多|更多职位|全部职位|展开|收起|按钮|链接|点击/i.test(text)) return false;
    if (/^\d+$/.test(text)) return false;

    const skipTerms = ['javascript:', 'mailto:', 'tel:', '#', '/about', '/news', '/press', '/blog'];
    if (skipTerms.some((t) => url.toLowerCase().includes(t))) return false;

    return true;
  }

  private parseJsonLdJobs(html: string, companyName: string, careersUrl: string): DiscoveredItem[] {
    const items: DiscoveredItem[] = [];
    const ldPatterns = [
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
      /"@type"\s*:\s*"JobPosting"/gi,
    ];

    for (const pattern of ldPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        const jsonStr = match[1] || match[0];
        try {
          const data = JSON.parse(jsonStr);
          const jobs = this.extractJobsFromJsonLd(data, companyName, careersUrl);
          items.push(...jobs);
        } catch {
          // not valid JSON, skip
        }
      }
    }

    return items;
  }

  private extractJobsFromJsonLd(data: unknown, companyName: string, careersUrl: string): DiscoveredItem[] {
    const items: DiscoveredItem[] = [];

    if (!data) return items;

    if (Array.isArray(data)) {
      for (const item of data) {
        items.push(...this.extractJobsFromJsonLd(item, companyName, careersUrl));
      }
      return items;
    }

    if (typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (obj['@type'] === 'JobPosting') {
        const title = String(obj['title'] || '');
        const orgObj = obj.hiringOrganization as Record<string, unknown> | undefined;
        const url = String(obj['url'] || (orgObj && typeof orgObj === 'object' ? orgObj['url'] : '') || '');
        if (title && url) {
          items.push({
            source_job_id: this.buildJobId(url, title),
            title: cleanText(title),
            url: normalizeUrl(url, careersUrl),
            metadata: {
              company_name: companyName,
              careers_url: careersUrl,
              discovered_url: url,
              discovered_text: title,
              source: 'json-ld',
            } as unknown as Record<string, unknown>,
          });
        }
      }

      if (obj['@graph']) {
        items.push(...this.extractJobsFromJsonLd(obj['@graph'], companyName, careersUrl));
      }
    }

    return items;
  }

  private extractCompanyName(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      const parts = hostname.replace(/^www\./, '').split('.');
      if (parts.length >= 2) {
        return cleanText(parts[parts.length - 2]
          .replace(/-/g, '')
          .replace(/careers/i, '')
          .replace(/campus/i, '')
          .replace(/jobs/i, ''));
      }
      return hostname;
    } catch {
      return '';
    }
  }

  private buildJobId(url: string, title: string): string {
    const combined = `${url}|${title}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `cc_${Math.abs(hash).toString(36)}`;
  }

  async fetchDetail(item: DiscoveredItem, _ctx: CrawlContext): Promise<RawJobRecord> {
    const metadata = isRecord(item.metadata) ? item.metadata : {};
    const meta = metadata as unknown as {
      company_name?: string;
      careers_url?: string;
      discovered_url?: string;
      discovered_text?: string;
      source?: string;
    };

    let detailHtml = '';
    try {
      const resp = await axios.get(item.url || meta.careers_url || '', {
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
        ...meta,
        detail_html: detailHtml,
        detail_url: item.url,
        careers_url: meta.careers_url || item.url,
      } as unknown as Record<string, unknown>,
    };
  }

  async normalize(raw: RawJobRecord): Promise<NormalizedJob> {
    const payload = raw.raw_payload as unknown as {
      company_name?: string;
      careers_url?: string;
      detail_html?: string;
      detail_url?: string;
      discovered_text?: string;
      source?: string;
    };

    const companyName = cleanText(payload.company_name || this.extractCompanyName(payload.careers_url || payload.detail_url || ''));
    const title = cleanText(this.extractJobTitleFromHtml(payload.detail_html, payload.discovered_text || ''));

    if (!companyName) {
      throw new Error(`CompanyCareers job ${raw.source_job_id} is missing company_name`);
    }
    if (!title) {
      throw new Error(`CompanyCareers job ${raw.source_job_id} is missing job_name`);
    }

    const jdText = this.extractJdFromHtml(payload.detail_html);
    const internshipType = this.detectInternshipType(
      payload.discovered_text + ' ' + (jdText || ''),
    );
    const city = this.extractCityFromHtml(jdText || '');
    const deadline = this.extractDeadline(jdText || '');

    const normalized: CompanyNormalizedJob = {
      company_name: companyName,
      title,
      city,
      is_remote: /远程|居家|remote|work from home/i.test(jdText || ''),
      internship_type: internshipType,
      deadline,
      jd_text: jdText,
      entry_url: payload.detail_url || raw.source_job_id,
      source_job_id: raw.source_job_id,
    };

    return normalized;
  }

  private extractJobTitleFromHtml(html: string | undefined, fallback: string): string {
    if (!html) return cleanText(fallback);

    try {
      const $ = load(html);

      const titleSelectors = [
        'h1.job-title',
        'h1.position-title',
        'h1[class*="title"]',
        'h2.job-title',
        'h2.position-title',
        '.job-title',
        '.position-title',
        '[class*="job-name"]',
        '[class*="position-name"]',
        '[class*="title"]',
        'h1',
        'h2',
      ];

      for (const selector of titleSelectors) {
        const node = $(selector).first();
        if (node.length > 0) {
          const text = cleanText(node.text());
          if (text.length >= 2 && text.length <= 60) {
            return text;
          }
        }
      }

      const bodyText = $('body').text();
      const lines = bodyText.split('\n').map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (line.length >= 2 && line.length <= 60 && /[岗位职位招聘]/.test(line)) {
          return cleanText(line.replace(/[岗位职责任职要求]/g, '').trim());
        }
      }
    } catch {
      // fall through
    }

    return cleanText(fallback);
  }

  private extractJdFromHtml(html: string | undefined): string | null {
    if (!html) return null;

    try {
      const $ = load(html);
      const jdSelectors = [
        '.job-description',
        '.job-detail',
        '.job-content',
        '[class*="description"]',
        '[class*="detail"]',
        '[class*="jd"]',
        '[class*="requirement"]',
        '[class*="responsibility"]',
        '[class*="qualification"]',
        '#job-detail',
        '#job-description',
        '.content',
        '.main-content',
        'article',
        '.article',
      ];

      for (const selector of jdSelectors) {
        const node = $(selector);
        if (node.length > 0) {
          const text = cleanText(node.text());
          if (text.length > 30) return text;
        }
      }

      const body = $('body');
      const text = body.clone().find('script, style, nav, header, footer, .ad, .sidebar, .menu, nav, aside').remove().end().text();
      return cleanText(text) || null;
    } catch {
      return null;
    }
  }

  private extractCityFromHtml(text: string): string {
    const cityPatterns = [
      /(?:工作地点|工作城市|地点|城市)\s*[:：]?\s*([^\n\r]{1,30})/u,
      /([\u4e00-\u9fa5]{2,8}(?:市|区|省))/g,
    ];

    for (const pattern of cityPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return cleanText(match[1].replace(/市|区$/, ''));
      }
    }

    return '';
  }

  private detectInternshipType(text: string): string {
    if (/实习(?![生员])/u.test(text)) {
      return '实习';
    }
    return '校招';
  }

  private extractDeadline(text: string): string | null {
    const patterns = [
      /(?:截止日期|截止时间|报名截止|投递截止|截止投递|网申截止)\s*[:：]?\s*(\d{4}[年.\-/]\d{1,2}[月.\-/]\d{1,2}[日]?)/u,
      /(?:截止|截止日期)\s*[:：]?\s*(\d{4}-\d{2}-\d{2})/u,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const dateStr = match[1].replace(/[年./]/g, '-').replace(/月/g, '-').replace(/日/g, '');
        const date = new Date(dateStr);
        if (!Number.isNaN(date.getTime())) {
          return date.toISOString().slice(0, 10);
        }
      }
    }

    return null;
  }

  async extractEntrypoints(job: NormalizedJob): Promise<JobEntrypointInput[]> {
    const ccJob = job as CompanyNormalizedJob;
    return [
      {
        entry_type: 'official',
        entry_url: ccJob.entry_url,
        visibility: 'public',
        requires_auth: false,
        referrer_name: ccJob.company_name,
        source_job_id: ccJob.source_job_id,
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
  if (href.startsWith('//')) return `https:${href}`;
  if (href.startsWith('/')) {
    try {
      const base = new URL(baseUrl);
      return `${base.protocol}//${base.host}${href}`;
    } catch {
      return href;
    }
  }
  return `${baseUrl}/${href}`;
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
