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

const log = createLogger('crawl/university');

// ============================================================
// University Career Site URL Patterns
// Universities are grouped by their career site template systems
// ============================================================

/** 华中科技大学系统 (hust.edu.cn) */
const HUST_PAGES = [
  'https://career.hust.edu.cn/',
  'https://career.hust.edu.cn/school-recruitment',
  'https://career.hust.edu.cn/fulltime',
  'https://career.hust.edu.cn/intern',
];

/** 清华大学系统 */
const TSINGHUA_PAGES = [
  'https://career.tsinghua.edu.cn/',
  'https://career.tsinghua.edu.cn/index/school/noticeList.html',
  'https://career.tsinghua.edu.cn/index/position/list.html',
];

/** 北大系统 */
const PKU_PAGES = [
  'https://career.pku.edu.cn/',
  'https://career.pku.edu.cn/xxfb/zpxx.htm',
  'https://career.pku.edu.cn/xxfb/qpxx.htm',
  'https://career.pku.edu.cn/xxfb/sxpxx.htm',
];

/** 复旦系统 */
const FUDAN_PAGES = [
  'https://career.fudan.edu.cn/',
  'https://career.fudan.edu.cn/web/index/news/list_115.html',
  'https://career.fudan.edu.cn/web/index/recruit/list_12.html',
];

/** 上海交大系统 */
const SJTU_PAGES = [
  'https://career.sjtu.edu.cn/',
  'https://career.sjtu.edu.cn/web/index/news/list_21.html',
  'https://career.sjtu.edu.cn/web/index/recruitment/list_8.html',
  'https://career.sjtu.edu.cn/web/index/intern/list_6.html',
];

/** 浙江大学系统 */
const ZJU_PAGES = [
  'https://career.zju.edu.cn/',
  'https://www.careers.zju.edu.cn/',
  'https://www.careers.zju.edu.cn/position/list?type=school',
  'https://www.careers.zju.edu.cn/position/list?type=intern',
];

/** 南京大学系统 */
const NJU_PAGES = [
  'https://career.nju.edu.cn/',
  'https://career.nju.edu.cn/module/168',
  'https://career.nju.edu.cn/module/170',
];

/** 武汉大学系统 */
const WHU_PAGES = [
  'https://career.whu.edu.cn/',
  'https://career.whu.edu.cn/xxfb/zpxx.htm',
  'https://career.whu.edu.cn/xxfb/sxpxx.htm',
];

/** 西安交大系统 */
const XJTU_PAGES = [
  'https://career.xjtu.edu.cn/',
  'https://career.xjtu.edu.cn/module/168',
  'https://career.xjtu.edu.cn/module/170',
];

/** 哈工大系统 */
const HIT_PAGES = [
  'https://career.hit.edu.cn/',
  'https://career.hit.edu.cn/module/168',
  'https://career.hit.edu.cn/module/170',
];

/** 电子科大系统 */
const UESTC_PAGES = [
  'https://career.uestc.edu.cn/',
  'https://career.uestc.edu.cn/campus',
  'https://career.uestc.edu.cn/campus/position',
  'https://career.uestc.edu.cn/intern',
];

/** 东南大学系统 */
const SEU_PAGES = [
  'https://career.seu.edu.cn/',
  'https://career.seu.edu.cn/module/168',
  'https://career.seu.edu.cn/module/170',
  'https://career.seu.edu.cn/module/172',
];

/** 北航系统 */
const BUAA_PAGES = [
  'https://career.buaa.edu.cn/',
  'https://career.buaa.edu.cn/xxfb/zpxx.htm',
  'https://career.buaa.edu.cn/xxfb/sxpxx.htm',
];

/** 北理工系统 */
const BIT_PAGES = [
  'https://career.bit.edu.cn/',
  'https://career.bit.edu.cn/module/168',
  'https://career.bit.edu.cn/module/170',
];

/** 同济大学系统 */
const TONGJI_PAGES = [
  'https://career.tongji.edu.cn/',
  'https://career.tongji.edu.cn/module/168',
  'https://career.tongji.edu.cn/module/170',
];

/** 上海大学系统 */
const SHU_PAGES = [
  'https://career.shu.edu.cn/',
  'https://career.shu.edu.cn/module/168',
  'https://career.shu.edu.cn/module/170',
];

/** 华东理工系统 */
const ECUST_PAGES = [
  'https://career.ecust.edu.cn/',
  'https://career.ecust.edu.cn/module/168',
  'https://career.ecust.edu.cn/module/170',
];

/** 上海财大系统 */
const SUFE_PAGES = [
  'https://career.sufe.edu.cn/',
  'https://career.sufe.edu.cn/module/168',
  'https://career.sufe.edu.cn/module/170',
];

/** 北京邮电系统 */
const BUPT_PAGES = [
  'https://career.bupt.edu.cn/',
  'https://career.bupt.edu.cn/xxfb/zpxx.htm',
  'https://career.bupt.edu.cn/xxfb/sxpxx.htm',
];

/** 北京交通系统 */
const BJTU_PAGES = [
  'https://career.bjtu.edu.cn/',
  'https://career.bjtu.edu.cn/module/168',
  'https://career.bjtu.edu.cn/module/170',
];

/** 北京化工系统 */
const BUCT_PAGES = [
  'https://career.buct.edu.cn/',
  'https://career.buct.edu.cn/module/168',
  'https://career.buct.edu.cn/module/170',
];

/** 中国石油大学系统 */
const CUP_PAGES = [
  'https://career.cup.edu.cn/',
  'https://career.cup.edu.cn/module/168',
  'https://career.cup.edu.cn/module/170',
];

/** 中国地质大学系统 */
const CUG_PAGES = [
  'https://career.cug.edu.cn/',
  'https://career.cug.edu.cn/module/168',
  'https://career.cug.edu.cn/module/170',
];

/** 西南交大系统 */
const SWJTU_PAGES = [
  'https://career.swjtu.edu.cn/',
  'https://career.swjtu.edu.cn/module/168',
  'https://career.swjtu.edu.cn/module/170',
];

/** 大连理工系统 */
const DLUT_PAGES = [
  'https://career.dlut.edu.cn/',
  'https://career.dlut.edu.cn/module/168',
  'https://career.dlut.edu.cn/module/170',
];

/** 东北大学系统 */
const NEU_PAGES = [
  'https://career.neu.edu.cn/',
  'https://career.neu.edu.cn/module/168',
  'https://career.neu.edu.cn/module/170',
];

/** 南京理工系统 */
const NJUST_PAGES = [
  'https://career.njust.edu.cn/',
  'https://career.njust.edu.cn/module/168',
  'https://career.njust.edu.cn/module/170',
];

/** 南京航空系统 */
const NUAA_PAGES = [
  'https://career.nuaa.edu.cn/',
  'https://career.nuaa.edu.cn/module/168',
  'https://career.nuaa.edu.cn/module/170',
];

/** 西北工大系统 */
const NWPU_PAGES = [
  'https://career.nwpu.edu.cn/',
  'https://career.nwpu.edu.cn/module/168',
  'https://career.nwpu.edu.cn/module/170',
];

/** 厦门大学系统 */
const XMU_PAGES = [
  'https://career.xmu.edu.cn/',
  'https://career.xmu.edu.cn/module/168',
  'https://career.xmu.edu.cn/module/170',
];

/** 福州大学系统 */
const FZU_PAGES = [
  'https://career.fzu.edu.cn/',
  'https://career.fzu.edu.cn/module/168',
  'https://career.fzu.edu.cn/module/170',
];

/** 湖南大学系统 */
const HNU_PAGES = [
  'https://career.hnu.edu.cn/',
  'https://career.hnu.edu.cn/module/168',
  'https://career.hnu.edu.cn/module/170',
];

/** 中南大学系统 */
const CSU_PAGES = [
  'https://career.csu.edu.cn/',
  'https://career.csu.edu.cn/module/168',
  'https://career.csu.edu.cn/module/170',
];

/** 中山大学系统 */
const SYSU_PAGES = [
  'https://career.sysu.edu.cn/',
  'https://career.sysu.edu.cn/module/168',
  'https://career.sysu.edu.cn/module/170',
];

/** 华南理工系统 */
const SCUT_PAGES = [
  'https://career.scut.edu.cn/',
  'https://career.scut.edu.cn/module/168',
  'https://career.scut.edu.cn/module/170',
];

/** 四川大学系统 */
const SCU_PAGES = [
  'https://career.scu.edu.cn/',
  'https://career.scu.edu.cn/module/168',
  'https://career.scu.edu.cn/module/170',
];

/** 重庆大学系统 */
const CQU_PAGES = [
  'https://career.cqu.edu.cn/',
  'https://career.cqu.edu.cn/module/168',
  'https://career.cqu.edu.cn/module/170',
];

/** 山东大学系统 */
const SDU_PAGES = [
  'https://career.sdu.edu.cn/',
  'https://career.sdu.edu.cn/module/168',
  'https://career.sdu.edu.cn/module/170',
];

/** 中国海洋大学系统 */
const OUC_PAGES = [
  'https://career.ouc.edu.cn/',
  'https://career.ouc.edu.cn/module/168',
  'https://career.ouc.edu.cn/module/170',
];

/** 南开系统 */
const NKU_PAGES = [
  'https://career.nankai.edu.cn/',
  'https://career.nankai.edu.cn/module/168',
  'https://career.nankai.edu.cn/module/170',
];

/** 天津大学系统 */
const TJU_PAGES = [
  'https://career.tju.edu.cn/',
  'https://career.tju.edu.cn/module/168',
  'https://career.tju.edu.cn/module/170',
];

/** 北京师范系统 */
const BNU_PAGES = [
  'https://career.bnu.edu.cn/',
  'https://career.bnu.edu.cn/module/168',
  'https://career.bnu.edu.cn/module/170',
];

/** 对外经贸系统 */
const UIBE_PAGES = [
  'https://career.uibe.edu.cn/',
  'https://career.uibe.edu.cn/module/168',
  'https://career.uibe.edu.cn/module/170',
];

/** 人大系统 */
const RUC_PAGES = [
  'https://career.ruc.edu.cn/',
  'https://career.ruc.edu.cn/module/168',
  'https://career.ruc.edu.cn/module/170',
];

/** 央财系统 */
const CUFE_PAGES = [
  'https://career.cufe.edu.cn/',
  'https://career.cufe.edu.cn/module/168',
  'https://career.cufe.edu.cn/module/170',
];

/** 吉林大学系统 */
const JLU_PAGES = [
  'https://career.jlu.edu.cn/',
  'https://career.jlu.edu.cn/module/168',
  'https://career.jlu.edu.cn/module/170',
];

/** 兰州大学系统 */
const LZU_PAGES = [
  'https://career.lzu.edu.cn/',
  'https://career.lzu.edu.cn/module/168',
  'https://career.lzu.edu.cn/module/170',
];

/** 中科大系统 */
const USTC_PAGES = [
  'https://career.ustc.edu.cn/',
  'https://career.ustc.edu.cn/module/168',
  'https://career.ustc.edu.cn/module/170',
];

/** 北科大系统 */
const USTB_PAGES = [
  'https://career.ustb.edu.cn/',
  'https://career.ustb.edu.cn/module/168',
  'https://career.ustb.edu.cn/module/170',
];

/** 华南师范系统 */
const SCNU_PAGES = [
  'https://career.scnu.edu.cn/',
  'https://career.scnu.edu.cn/module/168',
  'https://career.scnu.edu.cn/module/170',
];

/** 合集：所有高校就业网 */
const UNIVERSITY_PAGES = [
  ...HUST_PAGES,
  ...TSINGHUA_PAGES,
  ...PKU_PAGES,
  ...FUDAN_PAGES,
  ...SJTU_PAGES,
  ...ZJU_PAGES,
  ...NJU_PAGES,
  ...WHU_PAGES,
  ...XJTU_PAGES,
  ...HIT_PAGES,
  ...UESTC_PAGES,
  ...SEU_PAGES,
  ...BUAA_PAGES,
  ...BIT_PAGES,
  ...TONGJI_PAGES,
  ...SHU_PAGES,
  ...ECUST_PAGES,
  ...SUFE_PAGES,
  ...BUPT_PAGES,
  ...BJTU_PAGES,
  ...BUCT_PAGES,
  ...CUP_PAGES,
  ...CUG_PAGES,
  ...SWJTU_PAGES,
  ...DLUT_PAGES,
  ...NEU_PAGES,
  ...NJUST_PAGES,
  ...NUAA_PAGES,
  ...NWPU_PAGES,
  ...XMU_PAGES,
  ...FZU_PAGES,
  ...HNU_PAGES,
  ...CSU_PAGES,
  ...SYSU_PAGES,
  ...SCUT_PAGES,
  ...SCU_PAGES,
  ...CQU_PAGES,
  ...SDU_PAGES,
  ...OUC_PAGES,
  ...NKU_PAGES,
  ...TJU_PAGES,
  ...BNU_PAGES,
  ...UIBE_PAGES,
  ...RUC_PAGES,
  ...CUFE_PAGES,
  ...JLU_PAGES,
  ...LZU_PAGES,
  ...USTC_PAGES,
  ...USTB_PAGES,
  ...SCNU_PAGES,
];

// Pattern: job title must contain campus-recruit keywords
const CAMPUS_KEYWORD_PATTERNS = /校园招聘|秋招|春招|202[4-9]届|20\d{2}届|校招|校园招募|暑期实习提前批|热招岗位|在招职位|招聘职位|职位列表|岗位名称|校招岗位|热招职位/iu;
const SKIP_PATTERNS = /宣讲会|笔经|面经|经验分享|求职信|简历模板|笔试真题|面试技巧|大赛|挑战赛|管理培训生|精英计划|博雅|博雅讲堂|讲座|沙龙|分享会|茶话会|工作坊|研讨会/iu;

// Pattern: company name must be a recognized tech company
const INCLUDE_TECH_COMPANY = /字节|腾讯|阿里|百度|美团|京东|拼多多|网易|快手|滴滴|小米|华为|OPPO|vivo|苹果|谷歌|Meta|微软|亚马逊|NVIDIA|Intel|AMD|高通|三星|商汤|旷视|依图|科大讯飞|海康威视|寒武纪|地平线|龙芯|中兴|蚂蚁|蚂蚁集团|蚂蚁金服|蚂蚁科技|蚂蚁财富|腾讯云|阿里云|阿里影业|饿了么|口碑|盒马|菜鸟|高德|优酷|UC|夸克|神策|同程|携程|去哪儿|马蜂窝|猎聘|智联|前程无忧|BOSS直聘|拉勾|脉脉|小红书|抖音|字节跳动|TikTok|Soul|Keep|喜马拉雅|蜻蜓FM|荔枝|虎牙|斗鱼|哔哩|Steam莉莉丝|鹰角|米哈游|完美世界|盛趣游戏|西山居|巨人网络|网易游戏|腾讯游戏|阿里巴巴|蚂蚁集团|蚂蚁科技/iu;

// Pattern: company name must NOT be a non-tech company (university-specific filter)
const EXCLUDE_NON_TECH_COMPANY = /房产中介|保险公司|平安保险|中国人寿|太平洋保险|新华保险|泰康保险/iu;

interface UniversityJobCard {
  title: string;
  company: string;
  city: string;
  date: string;
  url: string;
  detail?: string;
}

type UniversityNormalizedJob = NormalizedJob & {
  entry_url: string;
  source_job_id: string;
};

export class UniversityAdapter implements SourceAdapter {
  readonly sourceName = '高校就业网';
  readonly sourceType = 'public' as const;

  async discover(_ctx: CrawlContext): Promise<DiscoveredItem[]> {
    const seenUrls = new Set<string>();
    const items: DiscoveredItem[] = [];

    for (const pageUrl of UNIVERSITY_PAGES) {
      try {
        await new Promise((r) => setTimeout(r, 1000));

        const jobs = await this.fetchListingPage(pageUrl);
        for (const job of jobs) {
          if (!job.url || seenUrls.has(job.url)) continue;
          seenUrls.add(job.url);

          // Must match campus recruit keyword
          if (!CAMPUS_KEYWORD_PATTERNS.test(job.title + job.company)) continue;
          if (SKIP_PATTERNS.test(job.title)) continue;

          // Must be a recognized tech company
          if (EXCLUDE_NON_TECH_COMPANY.test(job.company)) continue;
          if (!INCLUDE_TECH_COMPANY.test(job.company)) continue;

          const sourceJobId = this.buildJobId(job.url);
          items.push({
            source_job_id: sourceJobId,
            title: cleanText(job.title),
            url: job.url,
            metadata: {
              ...job,
              page_url: pageUrl,
              university_name: this.extractUniversityName(pageUrl),
            } as unknown as Record<string, unknown>,
          });
        }
      } catch (err) {
        log.warn({ err, pageUrl }, 'Failed to fetch university career page');
      }

      if (items.length >= 300) break;
    }

    return items;
  }

  private async fetchListingPage(pageUrl: string): Promise<UniversityJobCard[]> {
    let retries = 2;
    while (retries >= 0) {
      try {
        const response = await axios.get<string>(pageUrl, {
          headers: HTTP_HEADERS,
          timeout: 20000,
          responseType: 'text',
        });

        const html = response.data as string;
        const jobs = this.parseHtml(html, pageUrl);

        // If no jobs from HTML, try pagination patterns
        if (jobs.length === 0) {
          const paginated = await this.tryPagination(html, pageUrl);
          if (paginated.length > 0) return paginated;
        }

        return jobs;
      } catch {
        retries -= 1;
        if (retries < 0) return [];
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    return [];
  }

  private parseHtml(html: string, pageUrl: string): UniversityJobCard[] {
    const $ = load(html);
    const jobs: UniversityJobCard[] = [];

    // Strategy 1: JSON-LD structured data
    const jsonLdJobs = this.parseJsonLd(html, pageUrl);
    if (jsonLdJobs.length > 0) {
      return jsonLdJobs;
    }

    // Strategy 2: Common table/list patterns in Chinese university career sites
    const selectors = [
      // Module-based (通用模块系统)
      '.module-job-list li',
      '.job-list li',
      '.recruit-list li',
      '.position-list li',
      '.career-list li',
      '.article-list li',
      '.info-list li',
      '.clearfix li',
      // Table-based
      'table.list-table tr',
      'table tr',
      'table.job-table tr',
      // Div-based
      '.job-item',
      '.recruit-item',
      '.career-item',
      '.article-item',
      '.info-item',
      '.list-item',
      // Row-based
      '.row',
      '.item',
    ];

    for (const selector of selectors) {
      $(selector).each((_, el) => {
        const $el = $(el);
        const titleEl = $el.find('a').first();
        const text = $el.text().trim();

        const title = titleEl.text().trim() || $el.find('h3, h4, h5, .title, .name').first().text().trim() || '';
        const href = titleEl.attr('href') || $el.find('a').attr('href') || '';
        const company = this.extractCompanyFromText(text);
        const date = this.extractDateFromText(text);
        const city = this.extractCityFromText(text);

        if (title && href && title.length >= 2 && title.length <= 80) {
          const url = normalizeUrl(href, pageUrl);
          jobs.push({ title, company, city, date, url });
        }
      });

      if (jobs.length > 0) break;
    }

    // Strategy 3: All links containing campus recruit keywords
    if (jobs.length === 0) {
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();

        if (!text || text.length < 4 || text.length > 80) return;
        if (!CAMPUS_KEYWORD_PATTERNS.test(text)) return;

        const url = normalizeUrl(href, pageUrl);
        if (!url.startsWith('http')) return;

        jobs.push({
          title: text,
          company: '',
          city: '',
          date: '',
          url,
        });
      });
    }

    return jobs;
  }

  private parseJsonLd(html: string, pageUrl: string): UniversityJobCard[] {
    const jobs: UniversityJobCard[] = [];
    const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

    for (const match of html.matchAll(pattern)) {
      try {
        const data = JSON.parse(match[1]);
        const items = this.extractJsonLdJobs(data, pageUrl);
        jobs.push(...items);
      } catch {
        // not valid JSON, skip
      }
    }

    return jobs;
  }

  private extractJsonLdJobs(data: unknown, pageUrl: string): UniversityJobCard[] {
    if (!data) return [];
    const jobs: UniversityJobCard[] = [];

    if (Array.isArray(data)) {
      for (const item of data) {
        jobs.push(...this.extractJsonLdJobs(item, pageUrl));
      }
      return jobs;
    }

    if (typeof data === 'object') {
      const obj = data as Record<string, unknown>;

      if (obj['@type'] === 'JobPosting') {
        const title = String(obj['title'] || '');
        const url = String(obj['url'] || '');
        const hiringOrg = obj['hiringOrganization'] as Record<string, unknown> | undefined;
        const company = String(hiringOrg?.['name'] || '');
        const datePosted = String(obj['datePosted'] || '');

        if (title && url) {
          jobs.push({
            title: cleanText(title),
            company: cleanText(company),
            city: '',
            date: cleanText(datePosted),
            url: normalizeUrl(url, pageUrl),
          });
        }
      }

      if (obj['@graph']) {
        jobs.push(...this.extractJsonLdJobs(obj['@graph'], pageUrl));
      }

      if (obj['itemListElement']) {
        jobs.push(...this.extractJsonLdJobs(obj['itemListElement'], pageUrl));
      }
    }

    return jobs;
  }

  private async tryPagination(html: string, baseUrl: string): Promise<UniversityJobCard[]> {
    const $ = load(html);
    const allJobs: UniversityJobCard[] = [];

    // Try to find next page URLs
    const pageSelectors = [
      'a.next',
      'a[rel="next"]',
      'a.page-next',
      'a[href*="page"]',
      'a[href*="p"]',
      '.pagination a',
      '.pages a',
    ];

    for (const selector of pageSelectors) {
      const links = $(selector);
      if (links.length === 0) continue;

      const pageUrls: string[] = [];
      links.each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          pageUrls.push(normalizeUrl(href, baseUrl));
        }
      });

      // Fetch up to 5 pages
      const pagesToFetch = pageUrls.slice(0, 5);
      for (const pageUrl of pagesToFetch) {
        try {
          await new Promise((r) => setTimeout(r, 800));
          const resp = await axios.get(pageUrl, {
            headers: HTTP_HEADERS,
            timeout: 15000,
          });
          const pageJobs = this.parseHtml(resp.data as string, pageUrl);
          allJobs.push(...pageJobs);
        } catch {
          // skip failed page
        }
      }

      if (allJobs.length > 0) break;
    }

    return allJobs;
  }

  private extractCompanyFromText(text: string): string {
    // Common patterns: "公司名称" or "公司：xxx" or just the company name before common separators
    const patterns = [
      /公司[：:]\s*([^\s\n|]{2,30})/u,
      /企业[：:]\s*([^\s\n|]{2,30})/u,
      /招聘单位[：:]\s*([^\s\n|]{2,30})/u,
      /^([^\s\n|]{2,30})(?:公司|集团|科技|网络|软件|技术)/u,
    ];

    for (const pattern of patterns) {
      const matched = text.match(pattern);
      if (matched?.[1]) {
        return cleanText(matched[1]);
      }
    }

    return '';
  }

  private extractDateFromText(text: string): string {
    const matched = text.match(/\d{4}[-./]\d{1,2}[-./]\d{1,2}/);
    return matched ? matched[0] : '';
  }

  private extractCityFromText(text: string): string {
    const matched = text.match(/([\u4e00-\u9fa5]{2,8}(?:市|区|省))/);
    return matched ? matched[1].replace(/市|省$/, '') : '';
  }

  private extractUniversityName(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      // Extract university name from hostname patterns
      const patterns: [RegExp, string][] = [
        [/^career\.(\w+)\.edu\.cn$/, '$1'],
        [/^www\.careers\.(\w+)\.edu\.cn$/, '$1'],
        [/^careers\.(\w+)\.edu\.cn$/, '$1'],
        [/^career\.(\w+)\.edu\.cn$/, '$1'],
        [/^(\w+)-career\./, '$1'],
        [/^career-(\w+)\./, '$1'],
      ];

      for (const [pattern, replacement] of patterns) {
        const matched = hostname.match(pattern);
        if (matched) {
          return matched[1];
        }
      }
    } catch {
      // ignore
    }
    return '';
  }

  private buildJobId(url: string): string {
    const hash = url.split('').reduce((h, c) => (h << 5) - h + c.charCodeAt(0), 0);
    return `uni_${Math.abs(hash).toString(36)}`;
  }

  async fetchDetail(item: DiscoveredItem, _ctx: CrawlContext): Promise<RawJobRecord> {
    const metadata = isRecord(item.metadata) ? item.metadata : {};
    const jobCard = metadata as unknown as UniversityJobCard & {
      page_url?: string;
      university_name?: string;
    };

    let detailText = '';
    try {
      const detailUrl = item.url || jobCard.page_url;
      if (detailUrl) {
        const resp = await axios.get(detailUrl, {
          headers: HTTP_HEADERS,
          timeout: 15000,
        });
        const $ = load(resp.data as string);
        $('script, style, nav, header, footer, .sidebar, .ad, .advertisement').remove();
        detailText = cleanText($('body').text());
      }
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
    const payload = raw.raw_payload as unknown as UniversityJobCard & {
      detail_text?: string;
      detail_url?: string;
      university_name?: string;
    };

    const companyName = cleanText(payload.company || this.extractCompanyFromText(payload.title));
    const title = this.extractJobTitle(payload.title || '', payload.detail_text || '');
    const detailText = payload.detail_text || '';

    if (!title) {
      throw new Error(`University job ${raw.source_job_id} is missing a concrete job title`);
    }

    const normalized: UniversityNormalizedJob = {
      company_name: companyName || payload.university_name || 'Unknown',
      title,
      city: normalizeCity(payload.city || this.extractCityFromText(detailText)),
      is_remote: /远程|居家|remote/i.test(detailText),
      internship_type: this.detectInternshipType(payload.title + ' ' + detailText),
      deadline: this.extractDeadline(detailText || payload.date),
      jd_text: detailText || null,
      entry_url: payload.detail_url || raw.source_job_id,
      source_job_id: raw.source_job_id,
    };

    return normalized;
  }

  private extractJobTitle(title: string, detail: string): string {
    let text = cleanText(title);
    text = text.replace(/[【】[\]()（）|｜]/gu, ' ');
    text = text.replace(/(?:校园招聘|校园|秋招|春招|社招|招聘|校招|内推|直推|开启|链接|可帮|帮内推)/gu, ' ').trim();
    text = text.replace(/^\d{2,4}届\s*/u, '');
    text = text.replace(/公司[：:].*$/u, '').trim();

    if (!text || text.length < 2) return '';
    if (/(?:岗位职责|任职要求|内推码|简历)/u.test(text)) return '';
    if (/^[^A-Za-z0-9\u4e00-\u9fa5]+$/.test(text)) return '';

    return text;
  }

  private detectInternshipType(text: string): string {
    if (/实习(?![生员])/u.test(text)) {
      return '实习';
    }
    return '校招';
  }

  private extractDeadline(text: string): string | null {
    const matched = text.match(
      /(?:截止|截止日期|报名截止|投递截止|截止时间|网申截止)\s*[:：]?\s*(\d{4}[./-]\d{1,2}[./-]\d{1,2})/u,
    );
    if (!matched?.[1]) return null;

    const dateStr = matched[1].replace(/[./]/gu, '-');
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return null;

    return date.toISOString().slice(0, 10);
  }

  async extractEntrypoints(job: NormalizedJob): Promise<JobEntrypointInput[]> {
    const uniJob = job as UniversityNormalizedJob;
    return [
      {
        entry_type: 'official',
        entry_url: uniJob.entry_url,
        visibility: 'public',
        requires_auth: false,
        referrer_name: '高校就业网',
        source_job_id: uniJob.source_job_id,
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

function normalizeCity(raw: string): string {
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
