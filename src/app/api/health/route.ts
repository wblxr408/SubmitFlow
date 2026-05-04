import { NextResponse } from 'next/server';
import { healthCheck } from '@/lib/db';
import { validateKey } from '@/lib/crypto';

export async function GET() {
  const dbOk = await healthCheck();
  const cryptoOk = validateKey();
  const healthy = dbOk && cryptoOk;
  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: { db: dbOk, crypto: cryptoOk },
    },
    { status: healthy ? 200 : 503 },
  );
}
