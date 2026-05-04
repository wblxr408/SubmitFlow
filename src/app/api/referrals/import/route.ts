import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import type { Referral } from '@/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/referrals/import');
const DEFAULT_PROFILE_ID = 1;

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

    const imported: Referral[] = [];
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.company_name) {
        errors.push({ index: i, error: 'company_name is required' });
        continue;
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
            item.company_name,
            item.job_title ?? null,
            item.referrer_name ?? null,
            item.referrer_contact ?? null,
            item.referral_code ?? null,
            item.entry_url ?? null,
            item.notes ?? null,
          ],
        );
        if (result) imported.push(result);
      } catch {
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
