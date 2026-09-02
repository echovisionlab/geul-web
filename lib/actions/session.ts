'use server';

import { isConnectErrorCode } from '@/lib/api/connect-error';
import { Code } from '@connectrpc/connect';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { createAccountClient } from '@/lib/api/server-client';
import type { SessionInfo } from '@/lib/types/user/model';
import { createLogger } from '@/lib/utils/logger';
import { getSession } from '@/lib/utils/session.server';

const logger = createLogger('session-actions');

export type SessionActionErrorCode = 'UNAUTHORIZED' | 'UNKNOWN';

interface SessionActionResult {
  error?: string;
  errorCode?: SessionActionErrorCode;
}

function mapError(err: unknown, fallback: string): SessionActionResult {
  if (isConnectErrorCode(err, Code.Unauthenticated, Code.PermissionDenied)) {
    return { error: err.message, errorCode: 'UNAUTHORIZED' };
  }
  logger.error(fallback, { error: err });
  return { error: fallback, errorCode: 'UNKNOWN' };
}

export async function listSessionsAction(): Promise<SessionInfo[]> {
  const session = await getSession();
  if (!session?.user?.id) {
    return [];
  }

  try {
    const client = await createAccountClient();
    const response = await client.getMySecurity({});
    return (response.security?.sessions ?? []).map((item) => ({
      id: item.id,
      active: item.active,
      current: item.current,
      authenticated_at: item.authenticatedAt ? timestampDate(item.authenticatedAt).toISOString() : '',
    }));
  } catch (err) {
    logger.error('Failed to list sessions', { error: err });
    return [];
  }
}

export async function revokeSessionAction(sessionId: string): Promise<SessionActionResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { error: 'Unauthorized', errorCode: 'UNAUTHORIZED' };
  }

  try {
    const client = await createAccountClient();
    await client.revokeMySession({ sessionId });
    return {};
  } catch (err) {
    return mapError(err, 'Failed to revoke session');
  }
}

export async function revokeOtherSessionsAction(): Promise<SessionActionResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { error: 'Unauthorized', errorCode: 'UNAUTHORIZED' };
  }

  try {
    const client = await createAccountClient();
    await client.revokeMyOtherSessions({});
    return {};
  } catch (err) {
    return mapError(err, 'Failed to revoke sessions');
  }
}
