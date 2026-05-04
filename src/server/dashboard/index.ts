import { query } from '@/lib/db';
import type { Application, Job } from '@/types';

const DEFAULT_PROFILE_ID = 1;

export interface DashboardData {
  upcomingDeadlines: Array<Job & { company_name: string }>;
  recentApplications: Array<Application & { job_title: string; company_name: string }>;
  pendingEmailCount: number;
}

export async function getDashboardData(profileId = DEFAULT_PROFILE_ID): Promise<DashboardData> {
  const [upcomingDeadlines, recentApplications, pendingEmails] = await Promise.all([
    query<Job & { company_name: string }>(
      `SELECT j.*, c.name AS company_name
       FROM jobs j
       JOIN companies c ON c.id = j.company_id
       WHERE j.status = 'valid' AND j.deadline IS NOT NULL
       ORDER BY j.deadline ASC
       LIMIT 5`,
    ),
    query<Application & { job_title: string; company_name: string }>(
      `SELECT a.*, j.title AS job_title, c.name AS company_name
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       JOIN companies c ON c.id = j.company_id
       WHERE a.profile_id = $1
       ORDER BY a.updated_at DESC
       LIMIT 5`,
      [profileId],
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM email_parse_logs
       WHERE profile_id = $1 AND resolution = 'pending'`,
      [profileId],
    ),
  ]);

  return {
    upcomingDeadlines,
    recentApplications,
    pendingEmailCount: Number.parseInt(pendingEmails[0]?.count ?? '0', 10),
  };
}
