import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/ai/models');

export async function GET() {
  try {
    const rows = await query(
      `SELECT
         m.id,
         m.provider_id,
         p.provider_key,
         p.display_name AS provider_name,
         m.model_name,
         m.supports_chat,
         m.supports_structured_output,
         m.supports_streaming,
         m.supports_vision
       FROM ai_model_catalog m
       JOIN ai_providers p ON p.id = m.provider_id
       WHERE p.is_system_enabled = TRUE
       ORDER BY p.display_name, m.model_name`,
    );
    return NextResponse.json({ models: rows });
  } catch (err) {
    log.error({ err }, 'Failed to list AI models');
    return NextResponse.json({ error: '获取模型列表失败' }, { status: 500 });
  }
}
