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

const CAMPUS_CAREERS_PAGES = [
  'https://careers.tencent.com/',
  'https://careers.tencent.com/campus.html',
  'https://campus.aliyun.com/',
  'https://campus.alibaba.com/',
  'https://campus.didi.cn/',
  'https://campus.bytedance.com/',
  'https://jobs.bytedance.com/campus',
  'https://careers.jd.com/',
  'https://campus.meituan.com/',
  'https://campus.pinduoduo.com/',
  'https://campus.netease.com/',
  'https://talent.baidu.com/',
  'https://campus.xiaomi.com/',
  'https://campus.huawei.com/',
  'https://campus.vivo.com/',
  'https://campus.oppo.com/',
  'https://campus.mi.com/',
  'https://campus.kuaishou.cn/',
  'https://campus.sensetime.com/',
  'https://campus.mobvoi.com/',
  'https://campus.jd.com/',
  'https://campus.mogan.com/',
  'https://campus.deepin.io/',
  'https://campus.sheingroup.com/',
  'https://campus.360.cn/',
  'https://campus.bilibili.com/',
  'https://campus.xiu.com/',
  'https://campus.lenovo.com.cn/',
  'https://campus.hp.com/',
  'https://campus.cisco.com/',
  'https://campus.intel.com/',
  'https://campus.nvidia.com/',
  'https://campus.ibm.com/',
  'https://campus.sap.com/',
  'https://campus.oracle.com/',
  'https://campus.microfocus.com/',
  'https://campus.samsung.com/',
  'https://campus.lg.com/',
  'https://campus.sony.com/',
  'https://campus.canon.com/',
  'https://campus.hitachi.com/',
  'https://campus.mitsubishi.com/',
  'https://campus.toyota.com/',
  'https://campus.honda.com/',
  'https://campus.bmw.com/',
  'https://campus.mercedes-benz.com/',
  'https://campus.audi.com/',
  'https://campus.volkswagen.com/',
  'https://campus.shell.com/',
  'https://campus.exxonmobil.com/',
  'https://campus.enn.com/',
  'https://campus.cnooc.com/',
  'https://campus.sinopec.com/',
  'https://campus.petrochina.com/',
  'https://campus.icbc.com/',
  'https://campus.ccb.com/',
  'https://campus.bankcomm.com/',
  'https://campus.cib.com/',
  'https://campus.citic.com/',
  'https://campus.cmbchina.com/',
  'https://campus.pingan.com/',
  'https://campus.hxb.com/',
  'https://campus.cebbank.com/',
  'https://campus.cgbchina.com/',
  'https://campus.psbc.com/',
  'https://campus.boc.cn/',
  'https://campus.abchina.com/',
  'https://campus.adbc.com.cn/',
  'https://campus.citic securities.com/',
  'https://campus.glsc.com.cn/',
  'https://campus.gjzq.com.cn/',
  'https://campus.investors.com/',
  'https://campus.haitong.com/',
  'https://campus.essence.com.cn/',
  'https://campus.swfc.com/',
  'https://campus.rosefort.com/',
  'https://campus.shhxzq.com/',
  'https://campus.htsec.com/',
  'https://campus.dfzq.com.cn/',
  'https://campus.dwzq.com.cn/',
  'https://campus.axzq.com.cn/',
  'https://campus.ssdxyzq.com/',
  'https://campus.cs.ecitic.com/',
  'https://campus.newchina.com/',
  'https://campus.td.com/',
  'https://campus.gfhx.com/',
  'https://campus.zlfund.com/',
  'https://campus.yhfund.com/',
  'https://campus.jsfund.com/',
  'https://campus.zjfund.com/',
  'https://campus.gffund.com/',
  'https://campus.efunds.com.cn/',
  'https://campus.antgroup.com/',
  'https://campus.webank.com.cn/',
  'https://campus.mybank.com.cn/',
  'https://campus.xwbank.com/',
  'https://campus.lu.com/',
  'https://campus.wacai.com/',
  'https://campus.creditcard.ecitic.com/',
  'https://campus.pab.com/',
  'https://campus.hzbank.com.cn/',
  'https://campus.baihang.com/',
  'https://campus.cmbc.com.cn/',
  'https://campus.hxb.com.cn/',
  'https://campus.bankofbeijing.com.cn/',
  'https://campus.bankofshanghai.com/',
  'https://campus.bankofnanjing.com/',
  'https://campus.hzcb.com/',
  'https://campus.njcb.com.cn/',
  'https://campus.cbhb.com.cn/',
  'https://campus.bosera.com/',
  'https://campus.fofpower.com/',
  'https://campus.amac.com.cn/',
  'https://campus.cffex.com.cn/',
  'https://campus.shfe.com.cn/',
  'https://campus.dce.com.cn/',
  'https://campus.czce.com.cn/',
  'https://campus.cfets.com.cn/',
  'https://campus.cbirc.com/',
  'https://campus.circ.com.cn/',
  'https://campus.safe.gov.cn/',
  'https://campus.nbsdc.gov.cn/',
  'https://campus.ccps.gov.cn/',
  'https://campus.gov.cn/',
  'https://campus.12333.gov.cn/',
  'https://campus.csrc.gov.cn/',
  'https://campus.sac.net.cn/',
  'https://campus.szse.cn/',
  'https://campus.sse.com.cn/',
  'https://campus.cque.com/',
  'https://campus.shmeea.com/',
  'https://campus.cqupt.edu.cn/',
  'https://campus.scu.edu.cn/',
  'https://campus.tsinghua.edu.cn/',
  'https://campus.pku.edu.cn/',
  'https://campus.fudan.edu.cn/',
  'https://campus.sjtu.edu.cn/',
  'https://campus.zju.edu.cn/',
  'https://campus.nju.edu.cn/',
  'https://campus.whu.edu.cn/',
  'https://campus.hust.edu.cn/',
  'https://campus.xjtu.edu.cn/',
  'https://campus.hit.edu.cn/',
  'https://campus.buct.edu.cn/',
  'https://campus.buaa.edu.cn/',
  'https://campus.bit.edu.cn/',
  'https://campus.cumt.edu.cn/',
  'https://campus.sut.edu.cn/',
  'https://campus.cup.edu.cn/',
  'https://campus.cug.edu.cn/',
  'https://campus.swjtu.edu.cn/',
  'https://campus.dlut.edu.cn/',
  'https://campus.neu.edu.cn/',
  'https://campus.njust.edu.cn/',
  'https://campus.nwpu.edu.cn/',
  'https://campus.xmu.edu.cn/',
  'https://campus.sufe.edu.cn/',
  'https://campus.sbs.edu.cn/',
  'https://campus.uibe.edu.cn/',
  'https://campus.ruc.edu.cn/',
  'https://campus.cufe.edu.cn/',
  'https://campus.zuel.edu.cn/',
  'https://campus.cqu.edu.cn/',
  'https://campus.hqu.edu.cn/',
  'https://campus.fzu.edu.cn/',
  'https://campus.hunnu.edu.cn/',
  'https://campus.sau.edu.cn/',
  'https://campus.csu.edu.cn/',
  'https://campus.uestc.edu.cn/',
  'https://campus.uic.edu.cn/',
  'https://campus.scu.edu.cn/',
  'https://campus.cdu.edu.cn/',
  'https://campus.sit.edu.cn/',
  'https://campus.sues.edu.cn/',
  'https://campus.shou.edu.cn/',
  'https://campus.ecust.edu.cn/',
  'https://campus.dhu.edu.cn/',
  'https://campus.sspu.edu.cn/',
  'https://campus.sit.edu.cn/',
  'https://campus.sues.edu.cn/',
  'https://campus.shnu.edu.cn/',
  'https://campus.ecnu.edu.cn/',
  'https://campus.sjtu.edu.cn/',
  'https://campus.tongji.edu.cn/',
  'https://campus.fudan.edu.cn/',
  'https://campus.hhu.edu.cn/',
  'https://campus.seu.edu.cn/',
  'https://campus.nuaa.edu.cn/',
  'https://campus.njust.edu.cn/',
  'https://campus.cpu.edu.cn/',
  'https://campus.njtech.edu.cn/',
  'https://campus.njupt.edu.cn/',
  'https://campus.njau.edu.cn/',
  'https://campus.nuist.edu.cn/',
  'https://campus.njue.edu.cn/',
  'https://campus.cpu.edu.cn/',
];

const CAMPUS_KEYWORD_PATTERNS = /校园招聘|秋招|春招|202[4-9]届|20\d{2}届|校招|校园招募|校园实习|暑期实习提前批|校园精英/iu;
const SKIP_PATTERNS = /宣讲会|笔经|面经|经验分享|求职信|简历模板|笔试真题|面试技巧|大赛|挑战赛|管理培训生|精英计划/iu;
const EXCLUDE_INDUSTRY = /房产|地产|置业顾问|经纪人|中介(?!机)|物业(?!管理)/iu;
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
      try {
        const discovered = await this.scrapeCompanyCareers(careersUrl);
        for (const item of discovered) {
          if (!item.url || seenUrls.has(item.url)) continue;
          if (item.url.startsWith('mailto:') || item.url.startsWith('tel:')) continue;
          if (EXCLUDE_INDUSTRY.test((item.metadata as Record<string, unknown>)?.company_name as string || '')) continue;
          seenUrls.add(item.url);

          items.push(item);
        }
      } catch (err) {
        log.warn({ err, url: careersUrl }, 'Failed to fetch company careers page');
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
    if (/实习(?!生)/u.test(text) && !/(?:校园招聘|秋招|春招|校招)/u.test(text)) {
      return '实习';
    }
    if (/社招|社会招聘/u.test(text)) {
      return '社招';
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
