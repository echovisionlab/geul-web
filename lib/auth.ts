import { cookies } from 'next/headers';
import { Code } from '@connectrpc/connect';
import { connectErrorCode, isConnectErrorCode } from '@/lib/api/connect-error';
import { createMemberClient } from '@/lib/api/server-client';
import { getSessionCookieName } from '@/lib/env';
import { createLogger } from '@/lib/utils/logger';
import { parseCurrentSession } from './auth/current-session';
import { clearInvalidSessionCookie } from './auth/invalid-session-cookie';
import type { SessionWithUser } from './auth/types';

export type { GeoInfo, SessionUser, SessionWithUser } from './auth/types';

const logger = createLogger('auth');

export async function getSessionFromCookie(): Promise<SessionWithUser | null> {
  const cookieStore = await cookies();
  if (!cookieStore.has(getSessionCookieName())) {
    return null;
  }

  try {
    const memberClient = await createMemberClient();
    const session = parseCurrentSession(await memberClient.getCurrentSession({}));
    if (!session) {
      logger.error('GetCurrentSession returned an invalid session projection');
    }
    return session;
  } catch (error) {
    if (isConnectErrorCode(error, Code.Unauthenticated)) {
      await clearInvalidSessionCookie();
      return null;
    }
    const rpcCode = connectErrorCode(error);
    logger.error('GetCurrentSession failed', {
      error,
      data: rpcCode === undefined ? undefined : { rpc_code: rpcCode },
    });
    return null;
  }
}
