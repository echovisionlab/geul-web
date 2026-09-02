import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { appendExpiredSessionCookies, buildCookieHeader, getSessionCookieNames } from '@/lib/auth/session-cookie';
import { USER_DISPLAY_COOKIE_NAME } from '@/lib/auth/user-display-cookie';
import { getSessionCookieName, getKratosUrl } from '@/lib/env';
import { createLogger } from '@/lib/utils/logger';
import { getCanonicalUrl } from '@/lib/utils/url.server';

const logger = createLogger('auth-logout-api');

function redirectHome({ expireSession }: { expireSession: boolean }) {
  const canonicalUrl = getCanonicalUrl();
  const response = NextResponse.redirect(new URL('/', canonicalUrl));
  response.cookies.set(USER_DISPLAY_COOKIE_NAME, '', {
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
  });

  if (expireSession) {
    appendExpiredSessionCookies(response.headers, {
      requestUrl: canonicalUrl,
      sessionCookieNames: getSessionCookieNames(getSessionCookieName()),
    });
  }

  return response;
}

function redirectToLogoutUrl(logoutUrl: string) {
  const response = NextResponse.redirect(new URL(logoutUrl, getCanonicalUrl()));
  response.cookies.set(USER_DISPLAY_COOKIE_NAME, '', {
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
  });
  return response;
}

export function resolveTrustedLogoutUrl(value: unknown, kratosUrl: string): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  try {
    const expectedOrigin = new URL(kratosUrl).origin;
    const candidate = new URL(value);
    if (
      candidate.origin !== expectedOrigin ||
      candidate.pathname !== '/self-service/logout' ||
      (candidate.protocol !== 'https:' && candidate.protocol !== 'http:') ||
      candidate.username !== '' ||
      candidate.password !== '' ||
      candidate.hash !== '' ||
      !candidate.searchParams.get('token')?.trim() ||
      [...candidate.searchParams.keys()].some((key) => key !== 'token')
    ) {
      return null;
    }
    // Keep the browser on the Web origin. The gateway owns this exact auth
    // path and forwards the one-time logout token to Kratos.
    return `/api/auth/self-service/logout?token=${encodeURIComponent(candidate.searchParams.get('token') as string)}`;
  } catch {
    return null;
  }
}

/**
 * Logout: Get logout URL from Kratos and redirect to it.
 */
export async function GET() {
  const cookieStore = await cookies();
  const cookieHeader = buildCookieHeader(cookieStore.getAll());

  try {
    // Get logout URL from Kratos
    const res = await fetch(`${getKratosUrl()}/self-service/logout/browser`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });

    if (!res.ok) {
      await logger.warn('Kratos logout URL request failed', {
        data: { status: res.status },
      });
      return redirectHome({ expireSession: true });
    }

    const data = (await res.json()) as { logout_url?: unknown };

    const logoutUrl = resolveTrustedLogoutUrl(data.logout_url, getKratosUrl());
    if (logoutUrl) {
      return redirectToLogoutUrl(logoutUrl);
    }

    await logger.warn('Kratos logout URL response was missing or untrusted');
    return redirectHome({ expireSession: true });
  } catch (error) {
    await logger.error('Kratos logout URL request threw', {
      error,
    });
    return redirectHome({ expireSession: true });
  }
}

export async function POST() {
  return GET();
}
