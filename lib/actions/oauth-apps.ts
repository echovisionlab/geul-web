'use server';

import { create } from '@bufbuild/protobuf';
import { timestampDate, type Timestamp } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import {
  SignInAccess,
  SignInAppAuthMethod,
  SignInAppScope,
  SignInAppSettingsSchema,
  SignInTokenLifespan,
  type ConnectedTool,
  type SignInApp,
} from '@echovisionlab/geul-proto/secure/oauth_app_pb.ts';
import type {
  OAuthClientAuthMethod,
  OAuthConnectionDetail,
  OAuthSignInAccess,
  OAuthSignInApp,
  OAuthSignInAppDraft,
  OAuthSignInAppSummary,
  OAuthSignInScope,
  OAuthTokenLifespan,
} from '@/features/admin/oauth-app/model';
import type { ActionResult } from '@/lib/actions/action-result';
import { createCommittedMutationRevalidator } from '@/lib/actions/revalidate-after-commit';
import { runAction } from '@/lib/actions/run-action';
import { queryResult } from '@/lib/api/query-result';
import { createOAuthAppClient } from '@/lib/api/server-client';

const SCOPE = 'oauth-app-actions';
const LIST_PATH = '/admin/oauth-apps';
const revalidateAfterCommit = createCommittedMutationRevalidator(SCOPE, 'oauth-apps');
const STALE_MESSAGE = 'This app changed after you opened it. Reload it before saving.';

const ACCESS_TO_MESSAGE: Record<OAuthSignInAccess, SignInAccess> = {
  none: SignInAccess.NONE,
  admins: SignInAccess.ADMINS,
  members: SignInAccess.MEMBERS,
  memberCriteria: SignInAccess.MEMBER_CRITERIA,
};
const AUTH_METHOD_TO_MESSAGE: Record<OAuthClientAuthMethod, SignInAppAuthMethod> = {
  client_secret_basic: SignInAppAuthMethod.CLIENT_SECRET_BASIC,
  client_secret_post: SignInAppAuthMethod.CLIENT_SECRET_POST,
  none: SignInAppAuthMethod.NONE,
};
const SCOPE_TO_MESSAGE: Record<OAuthSignInScope, SignInAppScope> = {
  email: SignInAppScope.EMAIL,
  profile: SignInAppScope.PROFILE,
};
const LIFESPAN_TO_MESSAGE: Record<OAuthTokenLifespan, SignInTokenLifespan> = {
  '5m': SignInTokenLifespan.FIVE_MINUTES,
  '15m': SignInTokenLifespan.FIFTEEN_MINUTES,
  '1h': SignInTokenLifespan.ONE_HOUR,
};

function invert<K extends string, V extends number>(record: Record<K, V>): Map<V, K> {
  return new Map(Object.entries(record).map(([key, value]) => [value as V, key as K]));
}

const ACCESS_FROM_MESSAGE = invert(ACCESS_TO_MESSAGE);
const AUTH_METHOD_FROM_MESSAGE = invert(AUTH_METHOD_TO_MESSAGE);
const SCOPE_FROM_MESSAGE = invert(SCOPE_TO_MESSAGE);
const LIFESPAN_FROM_MESSAGE = invert(LIFESPAN_TO_MESSAGE);

function isoString(timestamp: Timestamp | undefined): string | null {
  return timestamp ? timestampDate(timestamp).toISOString() : null;
}

function redirectHost(uri: string): string {
  try {
    return new URL(uri).host;
  } catch {
    return uri;
  }
}

function draftOf(app: SignInApp): OAuthSignInAppDraft {
  return {
    name: app.name,
    clientId: app.clientId,
    signInAccess: ACCESS_FROM_MESSAGE.get(app.access) ?? 'none',
    memberCriteriaIds: app.memberCriteria.map((criteria) => criteria.id),
    redirectUris: app.redirectUris,
    postLogoutRedirectUris: app.postLogoutRedirectUris,
    scopes: app.scopes.flatMap((scope) => SCOPE_FROM_MESSAGE.get(scope) ?? []),
    authMethod: AUTH_METHOD_FROM_MESSAGE.get(app.authMethod) ?? 'client_secret_basic',
    accessTokenLifespan: LIFESPAN_FROM_MESSAGE.get(app.accessTokenLifespan) ?? '15m',
    idTokenLifespan: LIFESPAN_FROM_MESSAGE.get(app.idTokenLifespan) ?? '15m',
  };
}

function linkedCriteria(app: SignInApp) {
  return app.memberCriteria.map((criteria) => ({ id: criteria.id, name: criteria.name }));
}

function appOf(app: SignInApp): OAuthSignInApp {
  return {
    draft: draftOf(app),
    memberCriteria: linkedCriteria(app),
    revision: app.revision,
    createdAt: isoString(app.createdAt) ?? '',
  };
}

function summaryOf(app: SignInApp): OAuthSignInAppSummary {
  return {
    clientId: app.clientId,
    name: app.name,
    signInAccess: ACCESS_FROM_MESSAGE.get(app.access) ?? 'none',
    memberCriteria: linkedCriteria(app),
    redirectHosts: [...new Set(app.redirectUris.map(redirectHost))],
    createdAt: isoString(app.createdAt) ?? '',
  };
}

function connectionOf(tool: ConnectedTool): OAuthConnectionDetail {
  return {
    clientId: tool.clientId,
    name: tool.name,
    publisher: tool.publisher ?? null,
    stale: tool.stale,
    createdAt: isoString(tool.createdAt),
    redirectUris: tool.redirectUris,
    resource: tool.resource,
    authMethod: tool.authMethod,
  };
}

function settingsOf(draft: OAuthSignInAppDraft) {
  return create(SignInAppSettingsSchema, {
    name: draft.name.trim(),
    access: ACCESS_TO_MESSAGE[draft.signInAccess],
    memberCriteriaIds: draft.signInAccess === 'memberCriteria' ? draft.memberCriteriaIds : [],
    redirectUris: draft.redirectUris,
    postLogoutRedirectUris: draft.postLogoutRedirectUris,
    scopes: draft.scopes.map((scope) => SCOPE_TO_MESSAGE[scope]),
    authMethod: AUTH_METHOD_TO_MESSAGE[draft.authMethod],
    accessTokenLifespan: LIFESPAN_TO_MESSAGE[draft.accessTokenLifespan],
    idTokenLifespan: LIFESPAN_TO_MESSAGE[draft.idTokenLifespan],
  });
}

export async function listSignInAppsAction() {
  return queryResult(async () => {
    const response = await (await createOAuthAppClient()).listSignInApps({});
    return response.apps.map(summaryOf);
  });
}

export async function getSignInAppAction(clientId: string) {
  return queryResult(async () => appOf(await (await createOAuthAppClient()).getSignInApp({ clientId })));
}

export async function listConnectedToolsAction() {
  return queryResult(async (): Promise<OAuthConnectionDetail[]> => {
    const response = await (await createOAuthAppClient()).listConnectedTools({});
    return response.tools.map(connectionOf);
  });
}

export async function createSignInAppAction(
  draft: OAuthSignInAppDraft,
): Promise<ActionResult<{ clientId: string; secret: string | null }>> {
  return runAction(
    SCOPE,
    'createSignInAppAction',
    async () => {
      const response = await (
        await createOAuthAppClient()
      ).createSignInApp({
        clientId: draft.clientId.trim(),
        settings: settingsOf(draft),
      });
      revalidateAfterCommit(LIST_PATH);
      return { clientId: response.app?.clientId ?? '', secret: response.clientSecret ?? null };
    },
    { fallback: 'Failed to create the app', messages: { [Code.AlreadyExists]: 'An app already uses this client ID.' } },
  );
}

export async function updateSignInAppAction(input: {
  draft: OAuthSignInAppDraft;
  revision: string;
}): Promise<ActionResult<{ app: OAuthSignInApp; secret: string | null }>> {
  return runAction(
    SCOPE,
    'updateSignInAppAction',
    async () => {
      const response = await (
        await createOAuthAppClient()
      ).updateSignInApp({
        clientId: input.draft.clientId,
        expectedRevision: input.revision,
        settings: settingsOf(input.draft),
      });
      revalidateAfterCommit(LIST_PATH);
      if (!response.app) {
        throw new Error('The API returned no app');
      }
      return { app: appOf(response.app), secret: response.clientSecret ?? null };
    },
    { fallback: 'Failed to save the app', messages: { [Code.Aborted]: STALE_MESSAGE } },
  );
}

export async function rotateSignInAppSecretAction(input: {
  clientId: string;
  revision: string;
}): Promise<ActionResult<{ app: OAuthSignInApp; secret: string }>> {
  return runAction(
    SCOPE,
    'rotateSignInAppSecretAction',
    async () => {
      const response = await (
        await createOAuthAppClient()
      ).rotateSignInAppSecret({
        clientId: input.clientId,
        expectedRevision: input.revision,
      });
      if (!response.app) {
        throw new Error('The API returned no app');
      }
      return { app: appOf(response.app), secret: response.clientSecret };
    },
    { fallback: 'Failed to issue a new secret', messages: { [Code.Aborted]: STALE_MESSAGE } },
  );
}

export async function deleteSignInAppAction(input: {
  clientId: string;
  revision: string;
}): Promise<ActionResult<{ success: true }>> {
  return runAction(
    SCOPE,
    'deleteSignInAppAction',
    async () => {
      await (
        await createOAuthAppClient()
      ).deleteSignInApp({ clientId: input.clientId, expectedRevision: input.revision });
      revalidateAfterCommit(LIST_PATH);
      return { success: true as const };
    },
    { fallback: 'Failed to delete the app', messages: { [Code.Aborted]: STALE_MESSAGE } },
  );
}

export async function disconnectConnectedToolAction(clientId: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    SCOPE,
    'disconnectConnectedToolAction',
    async () => {
      await (await createOAuthAppClient()).disconnectConnectedTool({ clientId });
      revalidateAfterCommit(LIST_PATH);
      return { success: true as const };
    },
    { fallback: 'Failed to disconnect the AI tool' },
  );
}
