import 'server-only';

import { create, toBinary } from '@bufbuild/protobuf';
import {
  MCPAuthenticatedContextSchema,
  MCPDelegationMethod,
} from '@echovisionlab/geul-proto/intra/gateway_authorization_pb.ts';
import { z } from 'zod';
import type { SessionWithUser } from '@/lib/auth';
import { getHydraAdminUrl, getMcpOAuthIssuerUrl, getSiteOrigin } from '@/lib/env';

const MCP_SCOPE = 'mcp';
const OFFLINE_ACCESS_SCOPE = 'offline_access';
const HYDRA_TIMEOUT_MS = 5_000;
const MAX_DELEGATION_ID_BYTES = 2_048;
const MAX_DELEGATION_NAME_BYTES = 400;

const challengeSchema = z.string().min(1).max(8_192);
const redirectResponseSchema = z.object({ redirect_to: z.url() });
const hydraClientSchema = z.object({
  client_id: z
    .string()
    .min(1)
    .refine((value) => Buffer.byteLength(value, 'utf8') <= MAX_DELEGATION_ID_BYTES),
  client_name: z
    .string()
    .refine((value) => Buffer.byteLength(value, 'utf8') <= MAX_DELEGATION_NAME_BYTES)
    .optional(),
});
const loginRequestSchema = z.object({
  client: hydraClientSchema,
});
const consentRequestSchema = z.object({
  client: hydraClientSchema,
  requested_access_token_audience: z.array(z.string()),
  requested_scope: z.array(z.string()),
  subject: z.uuid(),
});

const consentSessionSchema = z.object({
  consent_request_id: z.string().min(1).max(256),
  consent_request: z.object({
    client: hydraClientSchema,
    requested_access_token_audience: z.array(z.string()),
    requested_scope: z.array(z.string()),
    subject: z.uuid(),
  }),
  grant_access_token_audience: z.array(z.string()),
  grant_scope: z.array(z.string()),
  handled_at: z.string().optional(),
});
const consentSessionsSchema = z.array(consentSessionSchema).max(500);
const consentRequestIdSchema = z.string().min(1).max(256);

export type HydraConsentRequest = z.infer<typeof consentRequestSchema>;

export interface McpOAuthGrant {
  id: string;
  clientName: string;
  connectedAt: string | null;
}

function mcpOAuthContract() {
  const issuerURL = getMcpOAuthIssuerUrl();
  const siteOrigin = getSiteOrigin();
  if (issuerURL === siteOrigin) {
    throw new Error('MCP OAuth issuer and site origins must differ');
  }
  return { issuerURL, resourceURL: `${siteOrigin}/mcp` };
}

export function parseHydraChallenge(value: string | string[] | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const result = challengeSchema.safeParse(value);
  return result.success ? result.data : null;
}

function hydraAdminURL(path: string, challengeName: string, challenge: string): string {
  const url = new URL(path, `${getHydraAdminUrl()}/`);
  url.searchParams.set(challengeName, challenge);
  return url.toString();
}

async function hydraAdminRequest(path: string, challengeName: string, challenge: string, init?: RequestInit) {
  const response = await fetch(hydraAdminURL(path, challengeName, challenge), {
    ...init,
    cache: 'no-store',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    signal: AbortSignal.timeout(HYDRA_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Hydra Admin returned ${response.status}`);
  }
  return response.json() as Promise<unknown>;
}

async function hydraAdminSubjectRequest(path: string, subject: string, init?: RequestInit): Promise<Response> {
  const url = new URL(path, `${getHydraAdminUrl()}/`);
  url.searchParams.set('subject', subject);
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(HYDRA_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Hydra Admin returned ${response.status}`);
  }
  return response;
}

function exactStringSet(actual: string[], expected: string): boolean {
  return actual.length === 1 && actual[0] === expected;
}

function isMcpScopeSet(actual: string[]): boolean {
  if (actual.length === 1) {
    return actual[0] === MCP_SCOPE;
  }
  return actual.length === 2 && actual.includes(MCP_SCOPE) && actual.includes(OFFLINE_ACCESS_SCOPE);
}

export function assertMcpConsentRequest(request: HydraConsentRequest, session: SessionWithUser): void {
  const contract = mcpOAuthContract();
  if (
    request.subject !== session.account_identity_id ||
    !isMcpScopeSet(request.requested_scope) ||
    !exactStringSet(request.requested_access_token_audience, contract.resourceURL)
  ) {
    throw new Error('Hydra consent request does not match the authenticated MCP grant');
  }
}

export function isMcpAuthor(session: SessionWithUser): boolean {
  return session.user.role === 'author' || session.user.role === 'admin';
}

export function mcpClientDisplayName(request: HydraConsentRequest): string {
  const name = request.client.client_name?.replace(/\s+/g, ' ').trim();
  return name || 'MCP Client';
}

export function mcpDelegationDisplayName(request: HydraConsentRequest, session: SessionWithUser): string {
  const clientName = mcpClientDisplayName(request);
  const attribution = `${session.user.nickname} · ${clientName}`;
  if (Buffer.byteLength(attribution, 'utf8') <= MAX_DELEGATION_NAME_BYTES) {
    return attribution;
  }
  const fallback = `${session.user.nickname} · MCP Client`;
  if (Buffer.byteLength(fallback, 'utf8') > MAX_DELEGATION_NAME_BYTES) {
    throw new Error('MCP delegation display name exceeds the gateway contract');
  }
  return fallback;
}

export async function listMcpOAuthGrants(session: SessionWithUser): Promise<McpOAuthGrant[]> {
  if (!isMcpAuthor(session)) {
    throw new Error('MCP grants require an Author or Admin');
  }
  const url = new URL('/admin/oauth2/auth/sessions/consent', `${getHydraAdminUrl()}/`);
  url.searchParams.set('subject', session.account_identity_id);
  url.searchParams.set('page_size', '500');
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(HYDRA_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Hydra Admin returned ${response.status}`);
  }
  const sessions = consentSessionsSchema.parse(await response.json());
  const contract = mcpOAuthContract();
  return sessions
    .filter(
      (candidate) =>
        candidate.consent_request.subject === session.account_identity_id &&
        exactStringSet(candidate.grant_access_token_audience, contract.resourceURL) &&
        isMcpScopeSet(candidate.grant_scope),
    )
    .map((candidate) => ({
      id: candidate.consent_request_id,
      clientName: mcpClientDisplayName({
        client: candidate.consent_request.client,
        requested_access_token_audience: candidate.consent_request.requested_access_token_audience,
        requested_scope: candidate.consent_request.requested_scope,
        subject: candidate.consent_request.subject,
      }),
      connectedAt:
        candidate.handled_at && Number.isFinite(Date.parse(candidate.handled_at)) ? candidate.handled_at : null,
    }))
    .sort((left, right) => (right.connectedAt ?? '').localeCompare(left.connectedAt ?? ''));
}

export async function revokeMcpOAuthGrant(session: SessionWithUser, grantId: string): Promise<void> {
  const parsedGrantId = consentRequestIdSchema.parse(grantId);
  const grants = await listMcpOAuthGrants(session);
  if (!grants.some((grant) => grant.id === parsedGrantId)) {
    throw new Error('MCP grant is not active for the current account');
  }
  const path = new URL('/admin/oauth2/auth/sessions/consent', `${getHydraAdminUrl()}/`);
  path.searchParams.set('consent_request_id', parsedGrantId);
  await hydraAdminSubjectRequest(path.toString(), session.account_identity_id, { method: 'DELETE' });
}

function mcpAuthenticatedContext(
  request: HydraConsentRequest,
  session: SessionWithUser,
  delegationName: string,
): string {
  const context = create(MCPAuthenticatedContextSchema, {
    identityId: session.account_identity_id,
    memberId: session.user.id,
    delegationId: request.client.client_id,
    delegationName,
    delegationMethod: MCPDelegationMethod.MCP_DELEGATION_METHOD_OAUTH,
  });
  return Buffer.from(toBinary(MCPAuthenticatedContextSchema, context)).toString('base64url');
}

function assertHydraContinuation(value: unknown): string {
  const contract = mcpOAuthContract();
  const { redirect_to: redirectTo } = redirectResponseSchema.parse(value);
  const parsed = new URL(redirectTo);
  if (
    parsed.origin !== contract.issuerURL ||
    parsed.pathname !== '/oauth2/auth' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.hash !== ''
  ) {
    throw new Error('Hydra returned an invalid authorization continuation');
  }
  return parsed.toString();
}

export async function acceptHydraLogin(challenge: string, session: SessionWithUser): Promise<string> {
  const parsedChallenge = challengeSchema.parse(challenge);
  const loginRequest = loginRequestSchema.parse(
    await hydraAdminRequest('/admin/oauth2/auth/requests/login', 'login_challenge', parsedChallenge),
  );
  if (!loginRequest.client.client_id) {
    throw new Error('Hydra login request is missing its client');
  }
  return assertHydraContinuation(
    await hydraAdminRequest('/admin/oauth2/auth/requests/login/accept', 'login_challenge', parsedChallenge, {
      method: 'PUT',
      body: JSON.stringify({ remember: false, subject: session.account_identity_id }),
    }),
  );
}

export async function getHydraConsentRequest(challenge: string): Promise<HydraConsentRequest> {
  const parsedChallenge = challengeSchema.parse(challenge);
  return consentRequestSchema.parse(
    await hydraAdminRequest('/admin/oauth2/auth/requests/consent', 'consent_challenge', parsedChallenge),
  );
}

export async function acceptHydraConsent(
  challenge: string,
  request: HydraConsentRequest,
  session: SessionWithUser,
): Promise<string> {
  const parsedChallenge = challengeSchema.parse(challenge);
  assertMcpConsentRequest(request, session);
  const contract = mcpOAuthContract();
  const delegationName = mcpDelegationDisplayName(request, session);
  return assertHydraContinuation(
    await hydraAdminRequest('/admin/oauth2/auth/requests/consent/accept', 'consent_challenge', parsedChallenge, {
      method: 'PUT',
      body: JSON.stringify({
        grant_access_token_audience: [contract.resourceURL],
        grant_scope: request.requested_scope,
        remember: false,
        session: {
          access_token: {
            authenticated_context_b64: mcpAuthenticatedContext(request, session, delegationName),
          },
        },
      }),
    }),
  );
}

export async function rejectHydraConsent(challenge: string, session: SessionWithUser): Promise<string> {
  const parsedChallenge = challengeSchema.parse(challenge);
  const request = await getHydraConsentRequest(parsedChallenge);
  assertMcpConsentRequest(request, session);
  return assertHydraContinuation(
    await hydraAdminRequest('/admin/oauth2/auth/requests/consent/reject', 'consent_challenge', parsedChallenge, {
      method: 'PUT',
      body: JSON.stringify({ error: 'access_denied', error_description: 'The user declined the MCP connection.' }),
    }),
  );
}
