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
const EXCLUDE_INDUSTRY = /房产|地产|置业顾问|经纪人|中介(?!机)|物业(?!管理)/iu;

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

            if (EXCLUDE_INDUSTRY.test(job.title + job.company)) continue;
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
