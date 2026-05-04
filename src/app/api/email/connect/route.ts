import { NextResponse } from 'next/server';
import { createEmailOAuthClient } from '@/server/email';
import { createLogger } from '@/lib/logger';

const log = createLogger('api/email/connect');

export async function GET() {
  try {
    const oauth2Client = createEmailOAuthClient();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
      ],
      prompt: 'consent',
    });

    log.debug({}, 'Redirecting to Gmail OAuth');
    return NextResponse.redirect(authUrl);
  } catch (err) {
    log.error({ err }, 'Failed to generate OAuth URL');
    return NextResponse.json({ error: '生成授权链接失败' }, { status: 500 });
  }
}
