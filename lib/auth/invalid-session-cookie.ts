import 'server-only';

import { cookies } from 'next/headers';
import { env, getSessionCookieName } from '@/lib/env';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('auth');
const IPV4_HOST_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

export async function clearInvalidSessionCookie(): Promise<void> {
  const sessionCookieName = getSessionCookieName();
  try {
    const cookieStore = await cookies();
    cookieStore.delete(sessionCookieName);
    const host = env.HOST.split(':')[0];
    if (host === 'localhost' || IPV4_HOST_RE.test(host) || !host.includes('.')) {
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
