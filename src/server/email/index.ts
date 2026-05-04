import { google } from 'googleapis';
import { encrypt, safeDecrypt } from '@/lib/crypto';
import { execute, query, queryOne } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { ApplicationTracker } from '@/server/application';
import type { ApplicationStatus, ParseResolution, UserEmailConnection } from '@/types';

const DEFAULT_PROFILE_ID = 1;
const log = createLogger('email');

const RECRUIT_KEYWORDS = [
  '笔试',
  '面试',
  'offer',
  '录用',
  '入职',
  'thank you for your interest',
  'application status',
  'interview',
  'job offer',
  'hired',
  'rejection',
  'online assessment',
  'oa',
  'coding challenge',
];

const STATUS_RULES: Array<{
  status: ApplicationStatus;
  confidence: number;
  patterns: RegExp[];
}> = [
  {
    status: 'offer',
    confidence: 0.98,
    patterns: [/offer/i, /录用/, /入职/, /offer\s*letter/i, /恭喜.*通过/],
  },
  {
    status: 'rejected',
    confidence: 0.95,
    patterns: [/遗憾/, /未通过/, /rejection/i, /unfortunately/i, /not move forward/i],
  },
  {
    status: 'interview',
    confidence: 0.9,
    patterns: [/面试/, /interview/i, /约面/, /终面/, /初面/, /复试/],
  },
  {
    status: 'written_test',
    confidence: 0.86,
    patterns: [/笔试/, /\boa\b/i, /online assessment/i, /coding challenge/i, /测评/],
  },
];

interface MatchableApplication {
  application_id: number;
  status: ApplicationStatus;
  job_title: string;
  company_name: string;
  alias_names: string[];
  brand_names: string[];
}

interface ParsedMessage {
  messageId: string;
  subject: string;
  from: string;
  snippet: string;
  text: string;
}

interface ParsedRecruitmentResult {
  company: string | null;
  role: string | null;
  status: ApplicationStatus | null;
  confidence: number;
  matchedApplicationId: number | null;
  resolution: ParseResolution;
}

export interface GmailSyncResult {
  success: true;
  pulled: number;
  parsed: number;
  updated: number;
  pending: number;
  ignored: number;
}

export interface PendingEmailParse {
  id: number;
  message_id: string;
  parsed_company: string | null;
  parsed_role: string | null;
  parsed_status: ApplicationStatus | null;
  confidence: number | null;
  matched_application_id: number | null;
  matched_company_name: string | null;
  matched_job_title: string | null;
  created_at: string;
}

export function createEmailOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3208/api/email/callback',
  );
}

export async function upsertEmailConnection(profileId: number, tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
}, options?: { resetLastSyncedAt?: boolean }) {
  const encryptedToken = encrypt(
    JSON.stringify({
      access_token: tokens.access_token ?? null,
      refresh_token: tokens.refresh_token ?? null,
      expiry_date: tokens.expiry_date ?? null,
    }),
  );
  const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;

  await execute(
    `INSERT INTO user_email_connections
     (profile_id, provider, auth_payload_encrypted, token_expires_at, status)
     VALUES ($1, 'gmail', $2, $3, 'active')
     ON CONFLICT (profile_id) DO UPDATE
     SET auth_payload_encrypted = $2,
         token_expires_at = $3,
         status = 'active',
         last_synced_at = CASE WHEN $4 THEN NULL ELSE user_email_connections.last_synced_at END`,
    [profileId, encryptedToken, expiresAt, options?.resetLastSyncedAt ?? false],
  );
}

export async function listEmailConnections(profileId = DEFAULT_PROFILE_ID) {
  return query<UserEmailConnection>(
    `SELECT id, provider, status, last_synced_at, token_expires_at, created_at
     FROM user_email_connections
     WHERE profile_id = $1
     ORDER BY created_at DESC`,
    [profileId],
  );
}

export async function listPendingEmailParses(profileId = DEFAULT_PROFILE_ID) {
  return query<PendingEmailParse>(
    `SELECT
       epl.id,
       epl.message_id,
       epl.parsed_company,
       epl.parsed_role,
       epl.parsed_status,
       epl.confidence,
       epl.matched_application_id,
       c.name AS matched_company_name,
       j.title AS matched_job_title,
       epl.created_at
     FROM email_parse_logs epl
     LEFT JOIN applications a ON a.id = epl.matched_application_id
     LEFT JOIN jobs j ON j.id = a.job_id
     LEFT JOIN companies c ON c.id = j.company_id
     WHERE epl.profile_id = $1
       AND epl.resolution = 'pending'
     ORDER BY epl.created_at DESC
     LIMIT 20`,
    [profileId],
  );
}

export async function disconnectEmailConnection(profileId = DEFAULT_PROFILE_ID) {
  await execute(
    `UPDATE user_email_connections
     SET status = 'expired'
     WHERE profile_id = $1`,
    [profileId],
  );
}

async function getActiveConnection(profileId: number) {
  return queryOne<UserEmailConnection>(
    `SELECT * FROM user_email_connections
     WHERE profile_id = $1 AND status = 'active'`,
    [profileId],
  );
}

async function ensureValidToken(conn: UserEmailConnection) {
  const oauth2Client = createEmailOAuthClient();
  const payload = safeDecrypt(conn.auth_payload_encrypted);
  const storedCredentials = payload ? JSON.parse(payload) as { refresh_token?: string | null } : {};
  oauth2Client.setCredentials(payload ? JSON.parse(payload) : {});

  if (!conn.token_expires_at) {
    return oauth2Client;
  }

  const expiresIn = new Date(conn.token_expires_at).getTime() - Date.now();
  if (expiresIn >= 5 * 60 * 1000) {
    return oauth2Client;
  }

  const { credentials } = await oauth2Client.refreshAccessToken();
  await upsertEmailConnection(conn.profile_id, {
    access_token: credentials.access_token ?? null,
    refresh_token: credentials.refresh_token ?? storedCredentials.refresh_token ?? null,
    expiry_date: credentials.expiry_date ?? null,
  });

  oauth2Client.setCredentials(credentials);
  return oauth2Client;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function detectStatus(text: string): { status: ApplicationStatus; confidence: number } | null {
  for (const rule of STATUS_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return { status: rule.status, confidence: rule.confidence };
    }
  }

  return null;
}

function extractSenderDomain(from: string): string {
  const match = from.match(/@([^>\s]+)/);
  return match?.[1]?.toLowerCase() ?? '';
}

function scoreApplicationMatch(message: ParsedMessage, application: MatchableApplication) {
  const normalizedText = normalizeText(message.text);
  const senderDomain = extractSenderDomain(message.from);
  const candidates = [
    application.company_name,
    ...application.alias_names,
    ...application.brand_names,
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  let companyHit = false;
  let domainHit = false;
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeText(candidate);
    if (!normalizedCandidate || normalizedCandidate.length < 2) {
      continue;
    }

    if (normalizedText.includes(normalizedCandidate)) {
      companyHit = true;
    }

    if (/^[a-z0-9]+$/i.test(normalizedCandidate) && senderDomain.includes(normalizedCandidate)) {
      domainHit = true;
    }
  }

  const normalizedTitle = normalizeText(application.job_title);
  const roleHit = normalizedTitle.length >= 2 && normalizedText.includes(normalizedTitle);
  const score = (companyHit ? 100 : 0) + (domainHit ? 30 : 0) + (roleHit ? 40 : 0);

  return {
    score,
    companyHit,
    roleHit,
  };
}

function matchApplication(message: ParsedMessage, applications: MatchableApplication[]) {
  const scored = applications
    .map((application) => ({
      application,
      ...scoreApplicationMatch(message, application),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  if (scored.length === 0) {
    return null;
  }

  const top = scored[0];
  const second = scored[1];
  const uniqueEnough = !second || top.score - second.score >= 40;

  if (top.score < 100 || !uniqueEnough) {
    return null;
  }

  return {
    application: top.application,
    company: top.companyHit ? top.application.company_name : null,
    role: top.roleHit ? top.application.job_title : null,
  };
}

async function loadApplications(profileId: number) {
  return query<MatchableApplication>(
    `SELECT
       a.id AS application_id,
       a.status,
       j.title AS job_title,
       c.name AS company_name,
       c.alias_names,
       c.brand_names
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     JOIN companies c ON c.id = j.company_id
     WHERE a.profile_id = $1`,
    [profileId],
  );
}

function buildMessage(headers: Array<{ name?: string | null; value?: string | null }>, snippet: string, messageId: string) {
  const subject = headers.find((header) => header.name === 'Subject')?.value ?? '';
  const from = headers.find((header) => header.name === 'From')?.value ?? '';
  const text = `${subject}\n${from}\n${snippet}`;

  return {
    messageId,
    subject,
    from,
    snippet,
    text,
  } satisfies ParsedMessage;
}

function parseRecruitmentMessage(message: ParsedMessage, applications: MatchableApplication[]): ParsedRecruitmentResult {
  const detectedStatus = detectStatus(message.text);
  const matched = matchApplication(message, applications);

  if (!detectedStatus) {
    return {
      company: matched?.company ?? null,
      role: matched?.role ?? null,
      status: null,
      confidence: matched ? 0.5 : 0.2,
      matchedApplicationId: matched?.application.application_id ?? null,
      resolution: 'ignored',
    };
  }

  if (!matched) {
    return {
      company: null,
      role: null,
      status: detectedStatus.status,
      confidence: Math.max(0.55, detectedStatus.confidence - 0.2),
      matchedApplicationId: null,
      resolution: 'pending',
    };
  }

  const confidence = matched.role ? detectedStatus.confidence : Math.max(0.75, detectedStatus.confidence - 0.08);
  return {
    company: matched.company,
    role: matched.role,
    status: detectedStatus.status,
    confidence,
    matchedApplicationId: matched.application.application_id,
    resolution: confidence >= 0.85 ? 'auto_updated' : 'pending',
  };
}

export async function syncGmail(profileId = DEFAULT_PROFILE_ID): Promise<GmailSyncResult> {
  const conn = await getActiveConnection(profileId);
  if (!conn) {
    throw new Error('Gmail not connected');
  }

  const auth = await ensureValidToken(conn);
  const gmail = google.gmail({ version: 'v1', auth });
  const applications = await loadApplications(profileId);
  const tracker = new ApplicationTracker(profileId);
  const after = conn.last_synced_at
    ? new Date(conn.last_synced_at).getTime() / 1000
    : (Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000;

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 50,
    q: `(${RECRUIT_KEYWORDS.join(' OR ')}) after:${Math.floor(after)}`,
  });

  const messageRefs = listRes.data.messages ?? [];
  const stats = {
    success: true as const,
    pulled: messageRefs.length,
    parsed: 0,
    updated: 0,
    pending: 0,
    ignored: 0,
  };

  for (const item of messageRefs) {
    const messageId = item.id;
    if (!messageId) {
      continue;
    }

    const existing = await queryOne<{ id: number }>(
      `SELECT id FROM email_parse_logs WHERE profile_id = $1 AND message_id = $2`,
      [profileId, messageId],
    );
    if (existing) {
      continue;
    }

    const messageRes = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Date'],
    });

    const headers = messageRes.data.payload?.headers ?? [];
    const parsedMessage = buildMessage(headers, messageRes.data.snippet ?? '', messageId);
    const parsed = parseRecruitmentMessage(parsedMessage, applications);
    let resolution = parsed.resolution;

    if (parsed.status && parsed.matchedApplicationId) {
      const application = applications.find((item) => item.application_id === parsed.matchedApplicationId);
      if (application?.status === parsed.status) {
        resolution = 'ignored';
      } else if (parsed.confidence >= 0.85 && resolution === 'auto_updated') {
        try {
          await tracker.updateStatus(parsed.matchedApplicationId, parsed.status, 'email', messageId);
          stats.updated++;
          if (application) {
            application.status = parsed.status;
          }
        } catch (err) {
          log.warn({ err, messageId }, 'Automatic email status update failed');
          resolution = 'pending';
        }
      } else {
        resolution = 'pending';
      }
    }

    if (resolution === 'pending') {
      stats.pending++;
    } else if (resolution === 'ignored') {
      stats.ignored++;
    }

    await execute(
      `INSERT INTO email_parse_logs
       (profile_id, message_id, parsed_company, parsed_role, parsed_status, confidence, matched_application_id, resolution)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        profileId,
        messageId,
        parsed.company,
        parsed.role,
        parsed.status,
        parsed.confidence,
        parsed.matchedApplicationId,
        resolution,
      ],
    );

    stats.parsed++;
  }

  await execute(
    `UPDATE user_email_connections
     SET last_synced_at = NOW()
     WHERE id = $1`,
    [conn.id],
  );

  log.info(stats, 'Gmail sync completed');
  return stats;
}

export async function confirmEmailParse(input: {
  logId: number;
  action: 'confirm' | 'ignore';
  profileId?: number;
  applicationId?: number;
}) {
  const profileId = input.profileId ?? DEFAULT_PROFILE_ID;
  const logRow = await queryOne<{
    id: number;
    parsed_status: ApplicationStatus | null;
    matched_application_id: number | null;
    message_id: string;
    resolution: ParseResolution;
  }>(
    `SELECT id, parsed_status, matched_application_id, message_id, resolution
     FROM email_parse_logs
     WHERE id = $1 AND profile_id = $2`,
    [input.logId, profileId],
  );

  if (!logRow) {
    throw new Error('Email parse log not found');
  }

  if (input.action === 'ignore') {
    await execute(
      `UPDATE email_parse_logs
       SET resolution = 'ignored'
       WHERE id = $1`,
      [logRow.id],
    );
    return { success: true, resolution: 'ignored' as const };
  }

  if (!logRow.parsed_status) {
    throw new Error('Parsed status is missing');
  }

  const applicationId = input.applicationId ?? logRow.matched_application_id;
  if (!applicationId) {
    throw new Error('Application id is required for confirmation');
  }

  const tracker = new ApplicationTracker(profileId);
    await tracker.updateStatus(applicationId, logRow.parsed_status, 'email', logRow.message_id);
    await execute(
    `UPDATE email_parse_logs
     SET matched_application_id = $1, resolution = 'auto_updated'
     WHERE id = $2`,
    [applicationId, logRow.id],
  );

  return { success: true, resolution: 'auto_updated' as const };
}
