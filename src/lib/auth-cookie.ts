import type { NextRequest } from 'next/server';

const AUTH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function isSecureRequest(request?: Pick<NextRequest, 'headers' | 'nextUrl'>): boolean {
  if (!request) {
    return process.env.NODE_ENV === 'production' && process.env.DOCKER_ENV !== '1';
  }

  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedProto) {
    return forwardedProto.split(',')[0]?.trim() === 'https';
  }

  return request.nextUrl.protocol === 'https:';
}

export function getAuthCookieOptions(
  request?: Pick<NextRequest, 'headers' | 'nextUrl'>,
) {
  return {
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: 'lax' as const,
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  };
}
