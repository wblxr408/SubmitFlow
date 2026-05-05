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
const EXCLUDE_INDUSTRY = /房产|地产|置业顾问|经纪人|中介(?!机)|物业(?!管理)/iu;

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
          if (EXCLUDE_INDUSTRY.test(job.title + company.name)) continue;
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
