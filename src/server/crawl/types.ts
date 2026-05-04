/**
 * 抓取系统：SourceAdapter 接口
 */
export interface DiscoveredItem {
  source_job_id: string;
  title: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface RawJobRecord {
  source_name: string;
  source_job_id: string;
  raw_payload: Record<string, unknown>;
}

export interface NormalizedJob {
  company_name: string;
  title: string;
  city: string;
  is_remote: boolean;
  internship_type: string;
  deadline: string | null;
  jd_text: string | null;
}

export interface JobEntrypointInput {
  entry_type: 'official' | 'public_referral' | 'private_referral' | 'internal';
  entry_url: string;
  visibility: 'public' | 'private';
  requires_auth: boolean;
  referrer_name?: string;
  source_job_id?: string;
}

export interface CrawlContext {
  profile_id: number;
  source_id: number;
  auth_payload_encrypted?: string;
  session_status: string;
}

export interface SourceAdapter {
  sourceName: string;
  sourceType: 'public' | 'public_referral' | 'private_import' | 'auth_required';
  discover(ctx: CrawlContext): Promise<DiscoveredItem[]>;
  fetchDetail(item: DiscoveredItem, ctx: CrawlContext): Promise<RawJobRecord>;
  normalize(raw: RawJobRecord): Promise<NormalizedJob>;
  extractEntrypoints(job: NormalizedJob): Promise<JobEntrypointInput[]>;
  needsReauth(error: unknown): boolean;
}
