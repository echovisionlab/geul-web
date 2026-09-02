'use server';

import { isConnectError } from '@/lib/api/connect-error';
import { Code } from '@connectrpc/connect';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import type { AccountSecurity } from '@echovisionlab/geul-proto/secure/account_pb.ts';
import { createAccountClient } from '@/lib/api/server-client';
import { createLogger } from '@/lib/utils/logger';
import { getSession } from '@/lib/utils/session.server';
import type { OidcProvider } from '@/lib/types/identity/provider';

const logger = createLogger('identity-actions');

export type { OidcProvider } from '@/lib/types/identity/provider';

export interface ConnectedProvider {
  provider: OidcProvider;
  identifier: string;
}

interface IdentityAuthInfo {
  providers: ConnectedProvider[];
  canonicalEmail: string;
  emailCodeAvailable: boolean;
}

interface IdentityAuthActionResult extends IdentityAuthInfo {
  error?: string;
}

function emptyAuthInfo(error?: string): IdentityAuthActionResult {
  return {
    providers: [],
    canonicalEmail: '',
    emailCodeAvailable: false,
    error,
  };
}

function normalizeProvider(provider: string): OidcProvider | null {
  if (provider === 'google' || provider === 'github') {
    return provider;
  }
  return null;
}

function mapAuthDetails(details: AccountSecurity | undefined): IdentityAuthInfo {
  if (!details) {
    return emptyAuthInfo();
  }

  return {
    canonicalEmail: details.canonicalEmail,
    emailCodeAvailable: Boolean(details.emailCodeAvailable),
    providers: details.providers
      .map((provider) => {
        const normalizedProvider = normalizeProvider(provider.provider);
        return normalizedProvider ? { provider: normalizedProvider, identifier: provider.identifier } : null;
      })
      .filter((provider): provider is ConnectedProvider => Boolean(provider)),
  };
}

function actionError(err: unknown, fallback: string): string {
  if (isConnectError(err)) {
    if (err.code === Code.Unauthenticated) {
      return 'not_authenticated';
    }
    if (err.code === Code.PermissionDenied) {
      return 'forbidden';
    }
    if (err.code === Code.FailedPrecondition) {
      const message = err.message.toLowerCase();
      if (message.includes('reauthenticate')) {
        return 'reauth_required';
      }
      if (message.includes('last usable') || message.includes('only usable')) {
        return 'last_auth_method';
      }
      if (message.includes('verified account email')) {
        return 'email_not_verified';
      }
      if (message.includes('recoverable') || message.includes('social sign-in')) {
        return 'recoverable_auth_method';
      }
    }
  }
  return fallback;
}

export interface MySecurityActionResult extends IdentityAuthActionResult {
  sessions: import('@/lib/types/user/model').SessionInfo[];
  passkeyCount: number;
}

function mapSessions(details: AccountSecurity | undefined): import('@/lib/types/user/model').SessionInfo[] {
  return (details?.sessions ?? []).map((session) => ({
    id: session.id,
    active: session.active,
    current: session.current,
    authenticated_at: session.authenticatedAt ? timestampDate(session.authenticatedAt).toISOString() : '',
  }));
}

export async function getMySecurityAction(): Promise<MySecurityActionResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ...emptyAuthInfo('Not authenticated'), sessions: [], passkeyCount: 0 };
  }

  try {
    const accountClient = await createAccountClient();
    const response = await accountClient.getMySecurity({});
    return {
      ...mapAuthDetails(response.security),
      sessions: mapSessions(response.security),
      passkeyCount: response.security?.passkeyCount ?? 0,
    };
  } catch (err) {
    logger.error('Failed to get connected providers', { error: err });
    return { ...emptyAuthInfo('Failed to get connected providers'), sessions: [], passkeyCount: 0 };
  }
}

export async function getConnectedProvidersAction(): Promise<IdentityAuthActionResult> {
  return getMySecurityAction();
}

export async function revokeMySessionAction(sessionId: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { error: 'not_authenticated' };
  }
  try {
    const accountClient = await createAccountClient();
    await accountClient.revokeMySession({ sessionId });
    return {};
  } catch (err) {
    logger.error('Failed to revoke account session', { error: err });
    return { error: actionError(err, 'revoke_failed') };
  }
}

export async function revokeMyOtherSessionsAction(): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { error: 'not_authenticated' };
  }
  try {
    const accountClient = await createAccountClient();
    await accountClient.revokeMyOtherSessions({});
    return {};
  } catch (err) {
    logger.error('Failed to revoke other account sessions', { error: err });
    return { error: actionError(err, 'revoke_failed') };
  }
}
