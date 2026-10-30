import 'server-only';

import { cookies } from 'next/headers';
import { env, getSessionCookieName } from '@/lib/env';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('auth');
const IPV4_HOST_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Expires the session cookie the API rejected. The cookie store keeps one entry per name, so a
 * single Set-Cookie is written, with the attributes the original cookie needs to be replaced:
 * a __Host- cookie only with Secure, Path=/ and no Domain (browsers ignore anything else), other
 * cookies on the parent domain where Kratos sets them.
 */
export async function clearInvalidSessionCookie(): Promise<void> {
  const sessionCookieName = getSessionCookieName();
  try {
    const cookieStore = await cookies();
    if (sessionCookieName.startsWith('__Host-')) {
      cookieStore.set(sessionCookieName, '', {
        path: '/',
        expires: new Date(0),
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
      });
      return;
    }
    const host = env.HOST.split(':')[0];
    if (host === 'localhost' || IPV4_HOST_RE.test(host) || !host.includes('.')) {
      cookieStore.set(sessionCookieName, '', { path: '/', expires: new Date(0) });
      return;
    }
    cookieStore.set(sessionCookieName, '', {
      domain: `.${host.split('.').slice(-2).join('.')}`,
      path: '/',
      expires: new Date(0),
    });
  } catch (error) {
    logger.warn('Failed to clear session cookie', { error });
  }
}
