import { NextRequest, NextResponse } from 'next/server';
import { createEmailOAuthClient, upsertEmailConnection } from '@/server/email';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/email/callback');
const DEFAULT_PROFILE_ID = 1;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    log.warn({ error }, 'Gmail OAuth error');
    return NextResponse.redirect(`/?email_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect('/settings/integrations?error=no_code');
  }

  try {
    const oauth2Client = createEmailOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    await upsertEmailConnection(DEFAULT_PROFILE_ID, tokens);

    log.info({}, 'Gmail connected successfully');
    return NextResponse.redirect('/settings/integrations?connected=true');
  } catch (err) {
    log.error({ err }, 'Failed to exchange OAuth code');
    return NextResponse.redirect('/settings/integrations?error=token_exchange_failed');
  }
}
