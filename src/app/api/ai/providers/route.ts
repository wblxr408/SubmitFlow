import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import type { AiProvider, UserAiProviderConfig } from '@/types';
import { testProviderConnection } from '@/server/ai';

export async function GET() {
  const providers = await query<AiProvider>(
    `SELECT * FROM ai_providers WHERE is_system_enabled = TRUE ORDER BY id`,
  );
  const configs = await query<UserAiProviderConfig>(
    `SELECT c.*, p.provider_key, p.display_name
     FROM user_ai_provider_configs c
     JOIN ai_providers p ON p.id = c.provider_id
     WHERE c.profile_id = 1`,
  );
  return NextResponse.json({ providers, configs });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { provider_id, base_url, api_key, is_enabled } = body;
  if (!provider_id || !api_key) {
    return NextResponse.json({ error: 'provider_id and api_key are required' }, { status: 400 });
  }
  const provider = Number.isInteger(provider_id)
    ? await queryOne<AiProvider>(
        `SELECT * FROM ai_providers WHERE id = $1`,
        [provider_id],
      )
    : await queryOne<AiProvider>(
        `SELECT * FROM ai_providers WHERE provider_key = $1`,
        [provider_id],
      );

  if (!provider) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
  }

  const result = await testProviderConnection(provider.provider_key, api_key, base_url);
  if (!result.success) {
    return NextResponse.json({ error: `Connection failed: ${result.error}` }, { status: 400 });
  }
  await query(
    `INSERT INTO user_ai_provider_configs (profile_id, provider_id, base_url, api_key_encrypted, is_enabled)
     VALUES (1, $1, $2, $3, $4)
     ON CONFLICT (profile_id, provider_id) DO UPDATE
     SET base_url = $2, api_key_encrypted = $3, is_enabled = $4, updated_at = NOW()`,
    [provider.id, base_url ?? null, encrypt(api_key), is_enabled ?? true],
  );
  return NextResponse.json({ success: true, latency_ms: result.latency_ms });
}
