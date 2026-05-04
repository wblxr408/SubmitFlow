import axios from 'axios';
import { createLogger } from '@/lib/logger';
import type {
  DiscoveredItem,
  RawJobRecord,
  NormalizedJob,
  JobEntrypointInput,
  CrawlContext,
  SourceAdapter,
} from '../types';

const LISTING_PAGES = [
  'https://www.nowcoder.com/jobs/school/jobs',
  'https://www.nowcoder.com/jobs/intern/center',
  'https://www.nowcoder.com/jobs/fulltime/center',
];
const log = createLogger('crawl/niuke');

const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  Referer: 'https://www.nowcoder.com/recommend/campus',
};

interface NiukeCompanyInfo {
  companyName?: string;
  companyShortName?: string;
  personScales?: string | null;
  industryTagNameList?: string[];
}

interface NiukeJobCard {
  id: number;
  jobName: string;
  recruitType?: number;
  jobCity?: string | null;
  jobCityList?: string[];
  jobAddress?: string | null;
  careerJobId?: number;
  careerJobName?: string | null;
  jobKeys?: string | null;
  deliverEnd?: number | null;
  ext?: string | null;
  redirectExternalUrl?: string | null;
  recommendInternCompany?: NiukeCompanyInfo | null;
  companyNameText?: string | null;
  companyLogoText?: string | null;
  companyIndustryText?: string | null;
}

type NiukeRawPayload = NiukeJobCard & {
  source_url?: string;
  detail_url?: string;
};

type NiukeNormalizedJob = NormalizedJob & {
  entry_url: string;
  source_job_id: string;
};

export class NiukeAdapter implements SourceAdapter {
  readonly sourceName = '牛客网';
  readonly sourceType = 'public' as const;

  async discover(_ctx: CrawlContext): Promise<DiscoveredItem[]> {
    const items = new Map<string, DiscoveredItem>();

    for (const pageUrl of LISTING_PAGES) {
      try {
        const html = await fetchHtml(pageUrl);
        const initialState = extractInitialState(html);
        const jobCards = collectJobCards(initialState);

        for (const job of jobCards) {
          const sourceJobId = String(job.id);
          if (!sourceJobId || items.has(sourceJobId)) {
            continue;
          }

          items.set(sourceJobId, {
            source_job_id: sourceJobId,
            title: cleanText(job.jobName),
            url: buildDetailUrl(job.id),
            metadata: {
              ...job,
              source_url: pageUrl,
              detail_url: buildDetailUrl(job.id),
            },
          });
        }
      } catch (err) {
        log.warn({ err, pageUrl }, 'Failed to parse Niuke listing page');
      }
    }

    return [...items.values()];
  }

  async fetchDetail(item: DiscoveredItem, _ctx: CrawlContext): Promise<RawJobRecord> {
    return {
      source_name: this.sourceName,
      source_job_id: item.source_job_id,
      raw_payload: {
        ...(isRecord(item.metadata) ? item.metadata : {}),
        detail_url: item.url ?? null,
      },
    };
  }

  async normalize(raw: RawJobRecord): Promise<NormalizedJob> {
    const payload = raw.raw_payload as unknown as NiukeRawPayload;
    const ext = parseExt(payload.ext);
    const companyName = firstNonEmpty(
      payload.recommendInternCompany?.companyShortName,
      payload.recommendInternCompany?.companyName,
      payload.companyNameText,
    );

    if (!companyName) {
      throw new Error(`Niuke job ${raw.source_job_id} is missing company_name`);
    }

    const normalized: NiukeNormalizedJob = {
      company_name: cleanText(companyName),
      title: cleanText(payload.jobName),
      city: normalizeCity(payload.jobCityList, payload.jobCity),
      is_remote: detectRemote(payload),
      internship_type: normalizeRecruitType(payload.recruitType),
      deadline: normalizeDeadline(payload.deliverEnd),
      jd_text: buildJobDescription(ext),
      entry_url: firstNonEmpty(payload.redirectExternalUrl, payload.detail_url) ?? buildDetailUrl(Number(raw.source_job_id)),
      source_job_id: raw.source_job_id,
    };

    return normalized;
  }

  async extractEntrypoints(job: NormalizedJob): Promise<JobEntrypointInput[]> {
    const niukeJob = job as NiukeNormalizedJob;

    return [
      {
        entry_type: 'official',
        entry_url: niukeJob.entry_url,
        visibility: 'public',
        requires_auth: false,
        referrer_name: '牛客网',
        source_job_id: niukeJob.source_job_id,
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

async function fetchHtml(url: string): Promise<string> {
  const response = await axios.get<string>(url, {
    headers: HTTP_HEADERS,
    timeout: 20000,
    responseType: 'text',
  });

  return response.data;
}

function extractInitialState(html: string): unknown {
  const marker = 'window.__INITIAL_STATE__=';
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error('Niuke initial state marker not found');
  }

  let index = markerIndex + marker.length;
  while (index < html.length && html[index] !== '{') {
    index += 1;
  }

  if (html[index] !== '{') {
    throw new Error('Niuke initial state JSON start not found');
  }

  const json = sliceBalancedJson(html, index);
  return JSON.parse(json);
}

function sliceBalancedJson(content: string, startIndex: number): string {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < content.length; index += 1) {
    const char = content[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return content.slice(startIndex, index + 1);
      }
    }
  }

  throw new Error('Niuke initial state JSON is incomplete');
}

function collectJobCards(value: unknown): NiukeJobCard[] {
  const seen = new WeakSet<object>();
  const jobs = new Map<number, NiukeJobCard>();

  const visit = (current: unknown) => {
    if (!current || typeof current !== 'object') {
      return;
    }

    if (seen.has(current)) {
      return;
    }

    seen.add(current);

    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }

    const job = normalizeJobCard(current as Record<string, unknown>);
    if (job) {
      jobs.set(job.id, job);
    }

    for (const next of Object.values(current)) {
      visit(next);
    }
  };

  visit(value);
  return [...jobs.values()];
}

function normalizeJobCard(value: Record<string, unknown>): NiukeJobCard | null {
  const candidate = isRecord(value.data) ? value.data : value;

  if (typeof candidate.id !== 'number' || typeof candidate.jobName !== 'string') {
    return null;
  }

  return candidate as unknown as NiukeJobCard;
}

function parseExt(rawExt: string | null | undefined): Record<string, string> {
  if (!rawExt) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawExt) as Record<string, unknown>;
    const entries = Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

function buildJobDescription(ext: Record<string, string>): string | null {
  const sections = [
    ['岗位职责', ext.infos],
    ['任职要求', ext.requirements],
    ['岗位亮点', ext.jobStrength],
  ]
    .map(([label, value]) => {
      const cleaned = cleanText(value);
      return cleaned ? `${label}\n${cleaned}` : null;
    })
    .filter((value): value is string => Boolean(value));

  return sections.length > 0 ? sections.join('\n\n') : null;
}

function normalizeCity(jobCityList: string[] | undefined, jobCity: string | null | undefined): string {
  const rawValue = firstNonEmpty(...(jobCityList ?? []), jobCity);
  if (!rawValue) {
    return '';
  }

  const city = rawValue
    .split(/[\/、|·]/u)[0]
    .replace(/省$/u, '')
    .replace(/市$/u, '')
    .trim();

  return city;
}

function normalizeRecruitType(recruitType: number | undefined): string {
  switch (recruitType) {
    case 1:
      return '校招';
    case 2:
      return '实习';
    case 3:
      return '社招';
    default:
      return '校招';
  }
}

function normalizeDeadline(timestamp: number | null | undefined): string | null {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return null;
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() > new Date().getUTCFullYear() + 5) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function detectRemote(payload: NiukeJobCard): boolean {
  const text = [
    payload.jobCity,
    payload.jobAddress,
    payload.jobKeys,
    payload.jobName,
  ]
    .filter(Boolean)
    .join(' ');

  return /远程|居家|remote/i.test(text);
}

function buildDetailUrl(jobId: number): string {
  return `https://www.nowcoder.com/jobs/detail/${jobId}`;
}

function cleanText(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\u003c/gu, '<')
    .replace(/\u003e/gu, '>')
    .replace(/\u0026/gu, '&')
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/\n[ \t]+/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .replace(/[ \t]{2,}/gu, ' ')
    .trim();
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
