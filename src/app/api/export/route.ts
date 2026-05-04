import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/export');

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') ?? 'applications';
  const format = searchParams.get('format') ?? 'csv';
  const status = searchParams.get('status');

  if (format !== 'csv') {
    return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
  }

  try {
    if (type === 'applications') {
      let whereClause = `WHERE a.profile_id = 1`;
      const params: unknown[] = [];
      if (status) {
        whereClause += ` AND a.status = $1`;
        params.push(status);
      }
      const rows = await query<Record<string, unknown>>(
        `SELECT
           a.status,
           j.title AS job_title,
           c.name AS company_name,
           j.city,
           a.applied_at,
           a.updated_at
         FROM applications a
         JOIN jobs j ON j.id = a.job_id
         JOIN companies c ON c.id = j.company_id
         ${whereClause}
         ORDER BY a.updated_at DESC`,
        params,
      );

      const headers = ['公司', '岗位', '城市', '状态', '投递时间', '更新时间'];
      const csvRows = rows.map((r) =>
        [
          r.company_name,
          r.job_title,
          r.city ?? '',
          r.status,
          r.applied_at ? new Date(r.applied_at as string).toLocaleDateString('zh-CN') : '',
          r.updated_at ? new Date(r.updated_at as string).toLocaleDateString('zh-CN') : '',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      );

      const csv = [headers.join(','), ...csvRows].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="applications.csv"`,
        },
      });
    }

    if (type === 'favorites') {
      const rows = await query<Record<string, unknown>>(
        `SELECT
           f.created_at AS favorited_at,
           j.title AS job_title,
           c.name AS company_name,
           j.city,
           j.deadline,
           f.note
         FROM job_favorites f
         JOIN jobs j ON j.id = f.job_id
         JOIN companies c ON c.id = j.company_id
         WHERE f.profile_id = 1 AND f.status = 'active'
         ORDER BY f.created_at DESC`,
      );

      const headers = ['收藏时间', '公司', '岗位', '城市', '截止日期', '备注'];
      const csvRows = rows.map((r) =>
        [
          r.favorited_at ? new Date(r.favorited_at as string).toLocaleDateString('zh-CN') : '',
          r.company_name,
          r.job_title,
          r.city ?? '',
          r.deadline ?? '',
          r.note ?? '',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      );

      const csv = [headers.join(','), ...csvRows].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="favorites.csv"`,
        },
      });
    }

    return NextResponse.json({ error: 'Unknown export type' }, { status: 400 });
  } catch (err) {
    log.error({ err }, 'Export failed');
    return NextResponse.json({ error: '导出失败' }, { status: 500 });
  }
}
