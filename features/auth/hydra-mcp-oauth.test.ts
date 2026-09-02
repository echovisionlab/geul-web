import { fromBinary } from '@bufbuild/protobuf';
import {
  MCPAuthenticatedContextSchema,
  MCPDelegationMethod,
} from '@echovisionlab/geul-proto/intra/gateway_authorization_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionWithUser } from '@/lib/auth';
import {
  acceptHydraConsent,
  acceptHydraLogin,
  assertMcpConsentRequest,
  getHydraConsentRequest,
  listMcpOAuthGrants,
  mcpDelegationDisplayName,
  parseHydraChallenge,
  revokeMcpOAuthGrant,
} from './hydra-mcp-oauth';

vi.mock('@/lib/env', () => ({
  getHydraAdminUrl: () => 'http://hydra.internal:4445',
  getMcpOAuthIssuerUrl: () => 'https://sso.example',
  getSiteOrigin: () => 'https://site.example',
}));

const challenge = 'challenge-123';
const session: SessionWithUser = {
  account_identity_id: 'b5c20411-cd95-4eb8-8ed7-bd1a0ab83c45',
  user: {
    id: '646b433a-e294-47cf-9b40-5e368c0b0f64',
    nickname: 'Example Member',
    email: null,
    image: null,
    preferred_locale: 'ko',
    role: 'author',
    status: 'active',
  },
  geo: null,
  onboarded: true,
  nickname_suggestion: null,
};

const consentRequest = {
  client: { client_id: 'example-client', client_name: 'Example Client' },
  requested_access_token_audience: ['https://site.example/mcp'],
  requested_scope: ['mcp', 'offline_access'],
  subject: session.account_identity_id,
};

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' }, status: 200 });
}

describe('Hydra MCP OAuth controller', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts a bounded opaque Hydra challenge without constraining its encoding', () => {
    expect(parseHydraChallenge(challenge)).toBe(challenge);
    expect(parseHydraChallenge('opaque+/=_-.')).toBe('opaque+/=_-.');
    expect(parseHydraChallenge(['one', 'two'])).toBeNull();
    expect(parseHydraChallenge('')).toBeNull();
    expect(parseHydraChallenge('x'.repeat(8_193))).toBeNull();
  });

  it('uses the API-resolved account identity as the Hydra login subject', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ client: { client_id: 'example-client', client_name: 'Example Client' } }))
      .mockResolvedValueOnce(jsonResponse({ redirect_to: 'https://sso.example/oauth2/auth?login_verifier=accepted' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(acceptHydraLogin(challenge, session)).resolves.toContain('login_verifier=accepted');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const acceptInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(acceptInit.body))).toEqual({
      remember: false,
      subject: session.account_identity_id,
    });
  });

  it('writes the exact MCP audience, scope, and delegation attribution to the access token session', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(consentRequest))
      .mockResolvedValueOnce(
        jsonResponse({ redirect_to: 'https://sso.example/oauth2/auth?consent_verifier=accepted' }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const request = await getHydraConsentRequest(challenge);
    await expect(acceptHydraConsent(challenge, request, session)).resolves.toContain('consent_verifier=accepted');

    const acceptInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const body = JSON.parse(String(acceptInit.body));
    expect(body.grant_scope).toEqual(['mcp', 'offline_access']);
    expect(body.grant_access_token_audience).toEqual(['https://site.example/mcp']);
    expect(body.remember).toBe(false);
    expect(Object.keys(body.session.access_token)).toEqual(['authenticated_context_b64']);
    const context = fromBinary(
      MCPAuthenticatedContextSchema,
      Buffer.from(body.session.access_token.authenticated_context_b64, 'base64url'),
    );
    expect(context).toMatchObject({
      identityId: session.account_identity_id,
      memberId: session.user.id,
      delegationId: 'example-client',
      delegationName: 'Example Member · Example Client',
      delegationMethod: MCPDelegationMethod.MCP_DELEGATION_METHOD_OAUTH,
    });
  });

  it('fails closed when Hydra subject, scope, or audience differs from the current grant', () => {
    expect(() => assertMcpConsentRequest({ ...consentRequest, requested_scope: ['mcp'] }, session)).not.toThrow();
    expect(() => assertMcpConsentRequest({ ...consentRequest, subject: crypto.randomUUID() }, session)).toThrow();
    expect(() => assertMcpConsentRequest({ ...consentRequest, requested_scope: ['mcp:write'] }, session)).toThrow();
    expect(() =>
      assertMcpConsentRequest({ ...consentRequest, requested_scope: ['mcp', 'offline_access', 'openid'] }, session),
    ).toThrow();
    expect(() =>
      assertMcpConsentRequest(
        { ...consentRequest, requested_access_token_audience: ['https://other.example'] },
        session,
      ),
    ).toThrow();
  });

  it('bounds untrusted OAuth client attribution to the gateway contract', () => {
    const longClient = {
      ...consentRequest,
      client: { ...consentRequest.client, client_name: '가'.repeat(134) },
    };
    expect(mcpDelegationDisplayName(longClient, session)).toBe('Example Member · MCP Client');
  });

  it('rejects a client id larger than the gateway delegation contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse({
          ...consentRequest,
          client: { client_id: '가'.repeat(683), client_name: 'Example Client' },
        }),
      ),
    );

    await expect(getHydraConsentRequest(challenge)).rejects.toThrow();
  });

  it('rejects a Hydra continuation outside the canonical issuer', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ client: { client_id: 'example-client' } }))
        .mockResolvedValueOnce(jsonResponse({ redirect_to: 'https://attacker.example/callback' })),
    );

    await expect(acceptHydraLogin(challenge, session)).rejects.toThrow('invalid authorization continuation');
  });

  it('lists only the current subject MCP grants and exposes bounded display data', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse([
        {
          consent_request_id: 'consent-request-1',
          consent_request: consentRequest,
          grant_access_token_audience: ['https://site.example/mcp'],
          grant_scope: ['mcp', 'offline_access'],
          handled_at: '2026-08-28T09:00:00Z',
        },
        {
          consent_request_id: 'other-resource',
          consent_request: { ...consentRequest, requested_access_token_audience: ['https://other.example'] },
          grant_access_token_audience: ['https://other.example'],
          grant_scope: ['mcp'],
          handled_at: '2026-08-28T10:00:00Z',
        },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(listMcpOAuthGrants(session)).resolves.toEqual([
      { id: 'consent-request-1', clientName: 'Example Client', connectedAt: '2026-08-28T09:00:00Z' },
    ]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(`subject=${session.account_identity_id}`);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('page_size=500');
  });

  it('rechecks grant ownership before revoking the exact consent token chain', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            consent_request_id: 'consent-request-1',
            consent_request: consentRequest,
            grant_access_token_audience: ['https://site.example/mcp'],
            grant_scope: ['mcp', 'offline_access'],
            handled_at: '2026-08-28T09:00:00Z',
          },
        ]),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(revokeMcpOAuthGrant(session, 'consent-request-1')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const revokeUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(revokeUrl.searchParams.get('subject')).toBe(session.account_identity_id);
    expect(revokeUrl.searchParams.get('consent_request_id')).toBe('consent-request-1');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'DELETE' });
  });
});
