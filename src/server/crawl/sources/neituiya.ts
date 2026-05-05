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

const API_BASE_URL = 'https://www.neituiya.com/bapeApi';
const DETAIL_PAGE_URL = 'https://www.neituiya.com/detail';
const LIST_PAGE_SIZE = 15;
const DEFAULT_MAX_PAGES_PER_CATEGORY = 2;
const DEFAULT_MAX_DISCOVERED_ITEMS = 500;

const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Origin: 'https://www.neituiya.com',
  Referer: 'https://www.neituiya.com/software',
};

const DISCOVERY_RECRUIT_PATTERN = /内推|招聘|直推|简历|岗位|职位|实习|校招|社招|春招|秋招|hc|内推码/iu;
const DISCOVERY_EXCLUDED_PATTERN = /面经|面试|真题|笔试|测评|题解|算法|八股|手撕|题库|刷题|oj|leetcode|经验分享|无领导|群面|结构化面试/iu;
const DETAIL_RECRUIT_PATTERN = /公司名称\s*[:：]|公司名\s*[:：]|企业名称\s*[:：]|招聘岗位\s*[:：]|职位名\s*[:：]|热招岗位\s*[:：]|工作地点\s*[:：]|工作城市\s*[:：]|城市\s*[:：]|内推链接|内推码|简历投递|岗位职责|任职要求/iu;
const DETAIL_EXCLUDED_PATTERN = /面经|面试|真题|笔试|测评|题解|算法|八股|手撕|题库|刷题|oj|leetcode|经验分享|在线测评|无领导|群面|结构化面试/iu;
const GENERIC_ROLE_PATTERN = /^(不限|若干|多个岗位|热招岗位|岗位不限|职位不限|部门不限|全部岗位)$/u;

const log = createLogger('crawl/neituiya');

interface ApiEnvelope<T> {
  code: number;
  msg?: string | null;
  data?: T;
}

interface NeituiyaCategory {
  id: string;
  name: string;
}

interface NeituiyaUser {
  name?: string | null;
}

interface NeituiyaListingItem {
  paperType?: number;
  id: string | number;
  paperName?: string | null;
  desc?: string | null;
  mdDesc?: string | null;
  itemDesc?: string | null;
  createTime?: string | null;
  taxRecruitType?: string | null;
  userModelView?: NeituiyaUser | null;
}

interface NeituiyaPagedData<T> {
  items?: T[];
  result?: T[];
  total?: number;
  totalPage?: number;
  hasMore?: boolean;
}

interface NeituiyaDetailData {
  paperModelView?: NeituiyaListingItem | null;
  userModelView?: NeituiyaUser | null;
}

interface DiscoverMetadata {
  feed_type: 'recruit_moment' | 'industry_list';
  category_id: string;
  category_name: string;
  page: number;
  listing: NeituiyaListingItem;
}

interface NeituiyaRawPayload {
  feed_type?: 'recruit_moment' | 'industry_list';
  category_id?: string;
  category_name?: string;
  page?: number;
  detail_url?: string;
  detail_api_url?: string;
  listing?: NeituiyaListingItem;
  detail?: NeituiyaDetailData;
}

type NeituiyaNormalizedJob = NormalizedJob & {
  entry_url: string;
  source_job_id: string;
  referrer_name?: string;
};

export class NeituiyaAdapter implements SourceAdapter {
  readonly sourceName = '内推鸭';
  readonly sourceType = 'public_referral' as const;

  async discover(_ctx: CrawlContext): Promise<DiscoveredItem[]> {
    const categories = await fetchCategories();
    const maxPagesPerCategory = getConfiguredNumber('NEITUIYA_MAX_PAGES', DEFAULT_MAX_PAGES_PER_CATEGORY, 1, 5);
    const maxRecruitMomentPages = getConfiguredNumber('NEITUIYA_RECRUIT_PAGES', DEFAULT_MAX_PAGES_PER_CATEGORY, 1, 5);
    const maxDiscoveredItems = getConfiguredNumber('NEITUIYA_MAX_ITEMS', DEFAULT_MAX_DISCOVERED_ITEMS, 30, 500);
    const items = new Map<string, DiscoveredItem>();

    for (let page = 1; page <= maxRecruitMomentPages; page += 1) {
      if (items.size >= maxDiscoveredItems) {
        return [...items.values()];
      }

      try {
        const { listings, hasMore } = await fetchRecruitMoments(page);

        for (const listing of listings) {
          if (!shouldDiscoverListing(listing)) {
            continue;
          }

          const sourceJobId = String(listing.id);
          if (!sourceJobId || items.has(sourceJobId)) {
            continue;
          }

          const metadata: DiscoverMetadata = {
            feed_type: 'recruit_moment',
            category_id: '',
            category_name: '',
            page,
            listing,
          };

          items.set(sourceJobId, {
            source_job_id: sourceJobId,
            title: cleanText(firstString(listing.paperName) ?? ''),
            url: buildDetailPageUrl(sourceJobId),
            metadata: metadata as unknown as Record<string, unknown>,
          });
        }

        if (!hasMore) {
          break;
        }
      } catch (err) {
        log.warn({ err, page }, 'Failed to fetch Neituiya recruit moment page');
        break;
      }
    }

    for (const category of categories) {
      for (let page = 1; page <= maxPagesPerCategory; page += 1) {
        if (items.size >= maxDiscoveredItems) {
          return [...items.values()];
        }

        try {
          const { listings, hasMore } = await fetchListings(category.id, page);

          for (const listing of listings) {
            if (!shouldDiscoverListing(listing)) {
              continue;
            }

            const sourceJobId = String(listing.id);
            if (!sourceJobId || items.has(sourceJobId)) {
              continue;
            }

            const metadata: DiscoverMetadata = {
              feed_type: 'industry_list',
              category_id: category.id,
              category_name: category.name,
              page,
              listing,
            };

            items.set(sourceJobId, {
              source_job_id: sourceJobId,
              title: cleanText(firstString(listing.paperName) ?? ''),
              url: buildDetailPageUrl(sourceJobId),
              metadata: metadata as unknown as Record<string, unknown>,
            });
          }

          if (!hasMore) {
            break;
          }
        } catch (err) {
          log.warn({ err, category, page }, 'Failed to fetch Neituiya listing page');
          break;
        }
      }
    }

    return [...items.values()];
  }

  async fetchDetail(item: DiscoveredItem, _ctx: CrawlContext): Promise<RawJobRecord> {
    const detail = await fetchDetail(item.source_job_id);
    const metadata = isRecord(item.metadata) ? (item.metadata as unknown as DiscoverMetadata) : undefined;

    return {
      source_name: this.sourceName,
      source_job_id: item.source_job_id,
      raw_payload: {
        feed_type: metadata?.feed_type,
        category_id: metadata?.category_id,
        category_name: metadata?.category_name,
        page: metadata?.page,
        listing: metadata?.listing,
        detail,
        detail_url: item.url ?? buildDetailPageUrl(item.source_job_id),
        detail_api_url: buildDetailApiUrl(item.source_job_id),
      },
    };
  }

  async normalize(raw: RawJobRecord): Promise<NormalizedJob> {
    const payload = raw.raw_payload as NeituiyaRawPayload;
    const detail = payload.detail;
    const paper = detail?.paperModelView ?? payload.listing;
    const feedType = payload.feed_type ?? 'industry_list';

    if (!paper) {
      throw new Error(`Neituiya job ${raw.source_job_id} is missing detail payload`);
    }

    const pageTitle = cleanText(firstString(paper.paperName) ?? '');
    const html = firstNonEmpty(
      firstString(paper.desc),
      firstString(paper.itemDesc),
      firstString(paper.mdDesc),
    );
    const text = html ? htmlToText(html) : '';
    const combined = cleanText([pageTitle, text].filter(Boolean).join('\n'));

    if (!looksLikeRecruitmentDetail(combined)) {
      throw new Error(`Neituiya job ${raw.source_job_id} does not look like a recruitment post`);
    }

    const companyName = extractCompanyName(pageTitle, text);
    if (!companyName) {
      throw new Error(`Neituiya job ${raw.source_job_id} is missing company_name`);
    }

    const title = extractJobTitle(pageTitle, text, companyName, feedType);
    if (!title) {
      throw new Error(`Neituiya job ${raw.source_job_id} is missing a concrete job title`);
    }

    const normalized: NeituiyaNormalizedJob = {
      company_name: companyName,
      title,
      city: normalizeCity(extractCity(text)),
      is_remote: /远程|居家|remote/iu.test(combined),
      internship_type: normalizeRecruitType(combined, firstString(paper.taxRecruitType)),
      deadline: extractDeadline(text),
      jd_text: combined || null,
      entry_url: extractEntrypointUrl(html, text) ?? payload.detail_url ?? buildDetailPageUrl(raw.source_job_id),
      source_job_id: raw.source_job_id,
      referrer_name: extractReferrerName(detail?.userModelView),
    };

    return normalized;
  }

  async extractEntrypoints(job: NormalizedJob): Promise<JobEntrypointInput[]> {
    const neituiyaJob = job as NeituiyaNormalizedJob;

    return [
      {
        entry_type: 'public_referral',
        entry_url: neituiyaJob.entry_url,
        visibility: 'public',
        requires_auth: false,
        referrer_name: neituiyaJob.referrer_name ?? '内推鸭',
        source_job_id: neituiyaJob.source_job_id,
      },
    ];
  }

  needsReauth(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return (
      error.message.includes('401') ||
      error.message.includes('403') ||
      error.message.includes('login') ||
      error.message.includes('登录')
    );
  }
}

async function fetchCategories(): Promise<NeituiyaCategory[]> {
  const data = await requestApi<NeituiyaCategory[]>({
    method: 'GET',
    url: '/paper/category/info',
  });

  return Array.isArray(data)
    ? data.filter((category): category is NeituiyaCategory => Boolean(category?.id && category?.name))
    : [];
}

async function fetchListings(categoryId: string, page: number): Promise<{
  listings: NeituiyaListingItem[];
  hasMore: boolean;
}> {
  const data = await requestApi<NeituiyaPagedData<NeituiyaListingItem>>({
    method: 'POST',
    url: '/paper/ugc/index',
    data: {
      page,
      perPage: LIST_PAGE_SIZE,
      categoryId,
    },
  });

  const listings = Array.isArray(data.items)
    ? data.items
    : Array.isArray(data.result)
      ? data.result
      : [];

  const totalPages = Number.isFinite(data.totalPage) ? Number(data.totalPage) : null;
  const total = Number.isFinite(data.total) ? Number(data.total) : null;
  const hasMore = Boolean(data.hasMore)
    || (totalPages !== null && page < totalPages)
    || (total !== null && page * LIST_PAGE_SIZE < total);

  return { listings, hasMore };
}

async function fetchRecruitMoments(page: number): Promise<{
  listings: NeituiyaListingItem[];
  hasMore: boolean;
}> {
  const data = await requestApi<NeituiyaPagedData<NeituiyaListingItem>>({
    method: 'POST',
    url: '/paper/ugc/recruit/moment',
    data: {
      page,
      perPage: LIST_PAGE_SIZE,
    },
  });

  const listings = Array.isArray(data.items)
    ? data.items
    : Array.isArray(data.result)
      ? data.result
      : [];

  const totalPages = Number.isFinite(data.totalPage) ? Number(data.totalPage) : null;
  const total = Number.isFinite(data.total) ? Number(data.total) : null;
  const hasMore = Boolean(data.hasMore)
    || (totalPages !== null && page < totalPages)
    || (total !== null && page * LIST_PAGE_SIZE < total);

  return { listings, hasMore };
}

async function fetchDetail(sourceJobId: string): Promise<NeituiyaDetailData> {
  return requestApi<NeituiyaDetailData>({
    method: 'GET',
    url: buildDetailApiPath(sourceJobId),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
}

async function requestApi<T>(config: {
  method: 'GET' | 'POST';
  url: string;
  data?: Record<string, unknown>;
  headers?: Record<string, string>;
}): Promise<T> {
  const response = await axios.request<ApiEnvelope<T>>({
    baseURL: API_BASE_URL,
    method: config.method,
    url: config.url,
    data: config.data,
    headers: {
      ...HTTP_HEADERS,
      ...config.headers,
    },
    timeout: 20000,
  });

  const payload = response.data;
  if (payload.code !== 0 || typeof payload.data === 'undefined') {
    throw new Error(payload.msg || `Neituiya API request failed: ${config.url}`);
  }

  return payload.data;
}

function shouldDiscoverListing(listing: NeituiyaListingItem): boolean {
  if (!listing.paperType || ![1, 2].includes(listing.paperType)) {
    return false;
  }

  const combined = [
    firstString(listing.paperName) ?? '',
    firstString(listing.desc) ?? '',
  ].join('\n');

  if (!DISCOVERY_RECRUIT_PATTERN.test(combined)) {
    return false;
  }

  return !DISCOVERY_EXCLUDED_PATTERN.test(combined);
}

function looksLikeRecruitmentDetail(text: string): boolean {
  if (!text) {
    return false;
  }

  if (DETAIL_EXCLUDED_PATTERN.test(text) && !DETAIL_RECRUIT_PATTERN.test(text)) {
    return false;
  }

  return DETAIL_RECRUIT_PATTERN.test(text) || DISCOVERY_RECRUIT_PATTERN.test(text);
}

function extractCompanyName(pageTitle: string, detailText: string): string | null {
  const lines = splitLines(detailText);

  const labeled = firstNonEmpty(
    extractLabeledValue(lines, ['公司名称', '公司名', '企业名称']),
    extractCompanyFromTitle(pageTitle),
  );

  if (!labeled) {
    return null;
  }

  const companyName = cleanCompanyName(labeled);
  return companyName || null;
}

function extractCompanyFromTitle(pageTitle: string): string | null {
  const cleaned = cleanText(pageTitle).replace(/^\d{2,4}届\s*/u, '');
  if (!cleaned) {
    return null;
  }

  const matched = cleaned.match(/^([A-Za-z0-9\u4e00-\u9fa5·&().-]+?)(?=(?:20\d{2}(?:届|年)?|校园招聘|校园|秋招|春招|社招|招聘|校招|实习|内推))/u);
  return matched?.[1] ? matched[1].trim() : null;
}

function cleanCompanyName(value: string): string {
  return cleanText(value)
    .replace(/^🏢/u, '')
    .replace(/^(?:公司名称|公司名|企业名称)\s*[:：]\s*/u, '')
    .replace(/\s*20\d{2}(?:届|年)?(?:春季|秋季|春|秋|暑期|全球|新)?$/u, '')
    .replace(/\s*(?:春季|秋季|暑期|全球|新)$/u, '')
    .replace(/[|｜].*$/u, '')
    .trim();
}

function extractJobTitle(
  pageTitle: string,
  detailText: string,
  companyName: string,
  feedType: 'recruit_moment' | 'industry_list',
): string | null {
  const lines = splitLines(detailText);
  const directTitle = extractLabeledValue(lines, ['招聘岗位', '职位名', '职位', '岗位'], ['岗位职责', '岗位亮点']);
  const inferredTitle = directTitle
    ?? extractStandaloneTitle(lines)
    ?? (feedType === 'recruit_moment' ? extractCampaignTitle(pageTitle, companyName) : extractTitleFromPageTitle(pageTitle, companyName));

  const title = inferredTitle
    ? feedType === 'recruit_moment' && !directTitle
      ? sanitizeCampaignTitle(inferredTitle)
      : sanitizeRoleTitle(inferredTitle)
    : null;

  if (!title) {
    return null;
  }

  if (feedType === 'recruit_moment' && !directTitle) {
    return isAcceptableCampaignTitle(title) ? title : null;
  }

  return isConcreteRoleTitle(title) ? title : null;
}

function extractStandaloneTitle(lines: string[]): string | null {
  for (let index = 0; index < lines.length - 1; index += 1) {
    const current = lines[index];
    const next = lines[index + 1];

    if (!current || !next) {
      continue;
    }

    if (/岗位职责|任职要求|内推链接|内推码/u.test(current)) {
      continue;
    }

    if (/^[^|]{1,40}\|\s*[^\s].*$/u.test(next)) {
      return current;
    }
  }

  return null;
}

function extractTitleFromPageTitle(pageTitle: string, companyName: string): string | null {
  let candidate = cleanText(pageTitle);
  if (!candidate) {
    return null;
  }

  candidate = candidate.replace(companyName, ' ');
  candidate = candidate
    .replace(/^\d{2,4}届/u, ' ')
    .replace(/[【】[\]()（）|｜]/gu, ' ')
    .replace(/(?:校园招聘|校园|秋招|春招|社招|招聘|校招|内推|直推|开启|专属|链接|可帮|帮内推|招聘开启)/gu, ' ')
    .trim();

  return candidate || null;
}

function extractCampaignTitle(pageTitle: string, companyName: string): string | null {
  let candidate = cleanText(pageTitle);
  if (!candidate) {
    return null;
  }

  candidate = candidate.replace(companyName, ' ');
  candidate = candidate
    .replace(/^内推[|｜\-:： ]*/u, ' ')
    .replace(/^直推[|｜\-:： ]*/u, ' ')
    .replace(/[【】[\]]/gu, ' ')
    .replace(/[（(].*?(?:内推码|推荐码|附码|附内推码).*?[）)]/gu, ' ')
    .replace(/(?:全面)?开启/gu, ' ')
    .replace(/启动/gu, ' ')
    .replace(/可帮内推/gu, ' ')
    .replace(/帮内推/gu, ' ')
    .replace(/专属/gu, ' ')
    .replace(/链接/gu, ' ')
    .replace(/ps[:：].*$/giu, ' ')
    .replace(/[；;，,].*$/u, ' ')
    .replace(/^\d{2,4}届\s*/u, '$&')
    .replace(/^\s*20\d{2}(?:届|年)?\s*/u, '$&')
    .trim();

  return candidate || null;
}

function sanitizeRoleTitle(value: string): string {
  return cleanText(value)
    .replace(/^💻/u, '')
    .replace(/^(?:招聘岗位|职位名|职位|岗位)\s*[:：]\s*/u, '')
    .replace(/[；;].*$/u, '')
    .trim();
}

function sanitizeCampaignTitle(value: string): string {
  return cleanText(value)
    .replace(/^[|｜\-:： ]+/u, '')
    .replace(/^\d{4}(?:届|年)?\s*/u, '$&')
    .replace(/正式$/u, '')
    .replace(/春招聘/u, '春招')
    .replace(/秋招聘/u, '秋招')
    .replace(/[；;].*$/u, '')
    .trim();
}

function isConcreteRoleTitle(value: string): boolean {
  if (!value || value.length < 2 || value.length > 40 || GENERIC_ROLE_PATTERN.test(value)) {
    return false;
  }

  if (/(?:招聘|内推|校招|社招|春招|秋招|岗位职责|任职要求|公司名称|公司名|简历|内推码)/u.test(value)) {
    return false;
  }

  if (/[、，,\/]/u.test(value)) {
    return false;
  }

  if (!/[A-Za-z0-9\u4e00-\u9fa5]/u.test(value)) {
    return false;
  }

  return value !== '不限';
}

function isAcceptableCampaignTitle(value: string): boolean {
  if (!value || value.length < 2 || value.length > 40) {
    return false;
  }

  if (!/[A-Za-z0-9\u4e00-\u9fa5]/u.test(value)) {
    return false;
  }

  if (DISCOVERY_EXCLUDED_PATTERN.test(value) || DETAIL_EXCLUDED_PATTERN.test(value)) {
    return false;
  }

  return /招聘|校招|社招|春招|秋招|实习|项目|计划|补录/u.test(value);
}

function extractCity(detailText: string): string | null {
  const lines = splitLines(detailText);
  const labeled = extractLabeledValue(lines, ['工作地点', '工作城市', '城市', '地点']);
  if (labeled) {
    return labeled;
  }

  for (const line of lines) {
    if (!line.includes('|')) {
      continue;
    }

    const parts = line.split('|').map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return parts[parts.length - 1];
    }
  }

  return null;
}

function normalizeCity(rawValue: string | null): string {
  if (!rawValue) {
    return '';
  }

  const city = rawValue
    .replace(/^主要是/u, '')
    .replace(/^不限[，,、]?\s*/u, '')
    .split(/[、,，/|;；]/u)[0]
    .replace(/省$/u, '')
    .replace(/市$/u, '')
    .trim();

  if (!city || city === '不限' || city === '海外') {
    return '';
  }

  return city;
}

function normalizeRecruitType(text: string, taxRecruitType: string | null | undefined): string {
  const combined = [taxRecruitType ?? '', text].join(' ');

  if (/实习/u.test(combined)) {
    return '实习';
  }

  if (/校招|秋招|春招|\d{4}届/u.test(combined)) {
    return '校招';
  }

  return '校招';
}

function extractDeadline(detailText: string): string | null {
  const matched = detailText.match(/(?:截止日期|截止时间|投递截止|报名截止)\s*[:：]?\s*(\d{4}[./-]\d{1,2}[./-]\d{1,2})/u);
  if (!matched?.[1]) {
    return null;
  }

  const value = matched[1].replace(/[./]/gu, '-');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function extractEntrypointUrl(html: string | null, detailText: string): string | null {
  const candidates = [html ?? '', detailText];

  for (const candidate of candidates) {
    const matched = candidate
      .replace(/&amp;/gu, '&')
      .match(/https?:\/\/[^\s<>"')）)，，。；;]+/iu);

    if (matched?.[0]) {
      return matched[0].trim();
    }
  }

  return null;
}

function extractReferrerName(user: NeituiyaUser | null | undefined): string | undefined {
  const name = firstString(user?.name);
  return name ? cleanText(name) : undefined;
}

function extractLabeledValue(
  lines: string[],
  labels: string[],
  excludedLabels: string[] = [],
): string | null {
  for (const line of lines) {
    if (excludedLabels.some((label) => line.startsWith(label))) {
      continue;
    }

    for (const label of labels) {
      const matched = line.match(new RegExp(`^${escapeRegExp(label)}\\s*[:：]\\s*(.+)$`, 'u'));
      if (!matched?.[1]) {
        continue;
      }

      const value = cleanText(matched[1]);
      if (value) {
        return value;
      }
    }
  }

  return null;
}

function htmlToText(html: string): string {
  const $ = load(`<div id="root">${html}</div>`);
  $('#root br').replaceWith('\n');
  $('#root p, #root div, #root li, #root h1, #root h2, #root h3').each((_, element) => {
    $(element).append('\n');
  });

  return cleanText($('#root').text());
}

function splitLines(value: string): string[] {
  return cleanText(value)
    .split('\n')
    .map((line) => cleanText(line))
    .filter(Boolean);
}

function cleanText(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value
    .replace(/\u00a0/gu, ' ')
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/\n[ \t]+/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .replace(/[ \t]{2,}/gu, ' ')
    .trim();
}

function firstString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function buildDetailPageUrl(sourceJobId: string): string {
  return `${DETAIL_PAGE_URL}/${sourceJobId}`;
}

function buildDetailApiUrl(sourceJobId: string): string {
  return `${API_BASE_URL}${buildDetailApiPath(sourceJobId)}`;
}

function buildDetailApiPath(sourceJobId: string): string {
  return `/paper/detail/${sourceJobId}`;
}

function getConfiguredNumber(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
