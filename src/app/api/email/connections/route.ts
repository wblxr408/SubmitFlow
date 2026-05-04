import { NextResponse } from 'next/server';
import { listEmailConnections } from '@/server/email';

export const dynamic = 'force-dynamic';

export async function GET() {
  const connections = await listEmailConnections();
  return NextResponse.json({ connections });
}
