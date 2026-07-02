import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import type { Referral } from '@/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/referrals/import');
const DEFAULT_PROFILE_ID = 1;

interface ImportItem {
  company_name?: string;
  job_title?: string;
  referrer_name?: string;
  referrer_contact?: string;
  referral_code?: string;
  entry_url?: string;
  notes?: string;
}

/**
 * POST /api/referrals/import
 * 批量导入内推信息
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items is required and must be non-empty' }, { status: 400 });
    }

    // 限制单次导入数量，防止滥用
    if (items.length > 100) {
      return NextResponse.json({ error: '单次导入最多 100 条' }, { status: 400 });
    }

    const imported: Referral[] = [];
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item: ImportItem = items[i];

      // 验证必填字段
      if (!item.company_name || typeof item.company_name !== 'string' || !item.company_name.trim()) {
        errors.push({ index: i, error: 'company_name is required' });
        continue;
      }

      // 验证 URL 格式（如果提供）
      if (item.entry_url && typeof item.entry_url === 'string' && item.entry_url.trim()) {
        try {
          const url = new URL(item.entry_url);
          if (!['http:', 'https:'].includes(url.protocol)) {
            errors.push({ index: i, error: 'entry_url must be http or https' });
            continue;
          }
        } catch {
          errors.push({ index: i, error: 'entry_url format is invalid' });
          continue;
        }
      }

      try {
        const result = await queryOne<Referral>(
          `INSERT INTO referrals (
             profile_id, company_name, job_title, referrer_name,
             referrer_contact, referral_code, entry_url, notes, source
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'import')
           RETURNING *`,
          [
            DEFAULT_PROFILE_ID,
            item.company_name.trim().substring(0, 255),
            item.job_title?.trim().substring(0, 255) || null,
            item.referrer_name?.trim().substring(0, 255) || null,
            item.referrer_contact?.trim().substring(0, 255) || null,
            item.referral_code?.trim().substring(0, 255) || null,
            item.entry_url?.trim() || null,
            item.notes?.trim().substring(0, 1000) || null,
          ],
        );
        if (result) imported.push(result);
      } catch (err) {
        log.warn({ err, index: i, item }, 'Failed to import referral item, skipping');
        errors.push({ index: i, error: 'Database insert failed' });
      }
    }

    log.debug({ importedCount: imported.length, errorCount: errors.length }, 'Imported referrals');

    return NextResponse.json({
      imported: imported.length,
      errors: errors.length,
      items: imported,
      errorDetails: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    log.error({ err }, 'Failed to import referrals');
    return NextResponse.json({ error: '批量导入失败' }, { status: 500 });
  }
}
