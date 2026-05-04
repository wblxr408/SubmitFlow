/**
 * 投递追踪服务
 * 状态机 + 事件历史
 */
import { query, execute, queryOne, transaction } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { sendFeishuNotification } from '@/server/notification/feishu';
import type { Application, ApplicationEvent, ApplicationStatus } from '@/types';

const log = createLogger('application');

const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  screening: ['written_test', 'interview', 'offer', 'rejected', 'withdrawn'],
  written_test: ['interview', 'offer', 'rejected', 'withdrawn'],
  interview: ['offer', 'rejected', 'withdrawn'],
  offer: ['rejected', 'withdrawn'],
  rejected: [],
  withdrawn: [],
};

export class ApplicationTracker {
  constructor(private readonly profileId: number) {}

  async create(
    jobId: number,
    jobEntrypointId: number | null,
  ): Promise<Application> {
    const existing = await queryOne<Application>(
      `SELECT * FROM applications WHERE profile_id = $1 AND job_id = $2`,
      [this.profileId, jobId],
    );
    if (existing) {
      throw new Error('Application already exists');
    }
    const row = await queryOne<Application>(
      `INSERT INTO applications (profile_id, job_id, job_entrypoint_id, status, applied_at)
       VALUES ($1, $2, $3, 'screening', NOW())
       RETURNING *`,
      [this.profileId, jobId, jobEntrypointId],
    );
    await this.recordEvent(row!.id, null, 'screening', 'manual', null);
    log.info({ applicationId: row!.id, jobId }, 'Application created');
    return row!;
  }

  async updateStatus(
    applicationId: number,
    newStatus: ApplicationStatus,
    source: 'manual' | 'email' | 'manual_feishu' = 'manual',
    sourceRef?: string,
  ): Promise<ApplicationEvent> {
    const app = await queryOne<Application>(
      `SELECT * FROM applications WHERE id = $1 AND profile_id = $2`,
      [applicationId, this.profileId],
    );
    if (!app) throw new Error('Application not found');

    const fromStatus = app.status as ApplicationStatus;
    if (!this.isValidTransition(fromStatus, newStatus)) {
      throw new Error(`Invalid status transition: ${fromStatus} -> ${newStatus}`);
    }

    await execute(
      `UPDATE applications SET status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, applicationId],
    );
    const event = await this.recordEvent(applicationId, fromStatus, newStatus, source, sourceRef ?? null);
    await this.notifyStatusChange(applicationId, newStatus, source);
    log.info({ applicationId, fromStatus, newStatus, source }, 'Status updated');
    return event;
  }

  private isValidTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  private async recordEvent(
    applicationId: number,
    fromStatus: ApplicationStatus | null,
    toStatus: ApplicationStatus,
    source: string,
    sourceRef: string | null,
  ): Promise<ApplicationEvent> {
    const row = await queryOne<ApplicationEvent>(
      `INSERT INTO application_events
       (application_id, from_status, to_status, source, source_ref)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [applicationId, fromStatus, toStatus, source, sourceRef],
    );
    return row!;
  }

  async list(
    filters: { status?: ApplicationStatus | ApplicationStatus[]; page?: number; pageSize?: number } = {},
  ) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    let whereClause = `WHERE a.profile_id = $1`;
    const params: unknown[] = [this.profileId];

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        whereClause += ` AND a.status = ANY($${params.length + 1})`;
        params.push(filters.status);
      } else {
        whereClause += ` AND a.status = $${params.length + 1}`;
        params.push(filters.status);
      }
    }

    const [rows, countRow] = await Promise.all([
      query<Application & { job_title: string; company_name: string; job_city: string }>(
        `SELECT a.*, j.title as job_title, c.name as company_name, j.city as job_city
         FROM applications a
         JOIN jobs j ON j.id = a.job_id
         JOIN companies c ON c.id = j.company_id
         ${whereClause}
         ORDER BY a.updated_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, offset],
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM applications a ${whereClause}`,
        params,
      ),
    ]);

    return {
      items: rows,
      total: parseInt(countRow?.count ?? '0', 10),
      page,
      pageSize,
    };
  }

  async getEvents(applicationId: number): Promise<ApplicationEvent[]> {
    const app = await queryOne<Application>(
      `SELECT * FROM applications WHERE id = $1 AND profile_id = $2`,
      [applicationId, this.profileId],
    );
    if (!app) throw new Error('Application not found');
    return query<ApplicationEvent>(
      `SELECT * FROM application_events WHERE application_id = $1 ORDER BY created_at ASC`,
      [applicationId],
    );
  }

  private async notifyStatusChange(
    applicationId: number,
    status: ApplicationStatus,
    source: 'manual' | 'email' | 'manual_feishu',
  ): Promise<void> {
    try {
      const detail = await queryOne<{ company_name: string; job_title: string }>(
        `SELECT c.name AS company_name, j.title AS job_title
         FROM applications a
         JOIN jobs j ON j.id = a.job_id
         JOIN companies c ON c.id = j.company_id
         WHERE a.id = $1 AND a.profile_id = $2`,
        [applicationId, this.profileId],
      );

      if (!detail) {
        return;
      }

      await sendFeishuNotification({
        company: detail.company_name,
        job: detail.job_title,
        status,
        source,
      });
    } catch (err) {
      log.warn({ err, applicationId, status }, 'Failed to send status notification');
    }
  }
}
