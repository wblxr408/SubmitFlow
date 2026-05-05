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
const EXCLUDE_INDUSTRY = /房产|地产|置业顾问|经纪人|中介(?!机)|物业(?!管理)/iu;
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
            if (EXCLUDE_INDUSTRY.test(job.jobName + job.companyName)) continue;
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
    const response = await axios.get<ZhipinJobResult>(WEB_API, {
      headers: HTTP_HEADERS,
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
    return data?.zpData?.jobList ?? [];
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
