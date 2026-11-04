import { fromBinary } from '@bufbuild/protobuf';
import {
  MCPAuthenticatedContextSchema,
  MCPDelegationMethod,
} from '@echovisionlab/geul-proto/intra/gateway_authorization_pb.ts';
import { SignInDecision } from '@echovisionlab/geul-proto/secure/oauth_app_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import type { SessionWithUser } from '@/lib/auth/types';
import {
  acceptHydraConsent,
  acceptHydraLogin,
  acceptHydraSignInConsent,
  assertSignInConsentRequest,
  assertMcpConsentRequest,
  getHydraConsentRequest,
  listMcpOAuthGrants,
  mcpDelegationDisplayName,
  parseHydraChallenge,
  revokeMcpOAuthGrant,
} from './hydra-mcp-oauth';

const mocks = vi.hoisted(() => ({ authorizeOAuthSignIn: vi.fn() }));

vi.mock('@/lib/env', () => ({
  getHydraAdminUrl: () => 'http://hydra.internal:4445',
  getMcpOAuthIssuerUrl: () => 'https://sso.example',
  getSiteOrigin: () => 'https://site.example',
}));

vi.mock('@/lib/api/server-client', () => ({
  createOAuthAppClient: async () => ({ authorizeOAuthSignIn: mocks.authorizeOAuthSignIn }),
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
    mocks.authorizeOAuthSignIn.mockReset();
    mocks.authorizeOAuthSignIn.mockResolvedValue({ decision: SignInDecision.NOT_SIGN_IN_APP });
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

  it.each([
    { decision: SignInDecision.ALLOWED, role: 'user' as const, continuation: 'https://sso.example/oidc/oauth2/auth' },
    { decision: SignInDecision.DENIED, role: 'admin' as const, continuation: null },
    {
      decision: SignInDecision.NOT_SIGN_IN_APP,
      role: 'author' as const,
      continuation: 'https://sso.example/oauth2/auth',
    },
    { decision: SignInDecision.NOT_SIGN_IN_APP, role: 'user' as const, continuation: null },
  ])('follows the API sign-in decision ($decision, $role)', async ({ decision, role, continuation }) => {
    mocks.authorizeOAuthSignIn.mockResolvedValue({ decision });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ client: { client_id: 'monitor-client' } }))
      .mockResolvedValueOnce(jsonResponse({ redirect_to: 'https://sso.example/oauth2/auth?login_verifier=accepted' }));
    vi.stubGlobal('fetch', fetchMock);

    const accepted = await acceptHydraLogin(challenge, { ...session, user: { ...session.user, role } });

    expect(mocks.authorizeOAuthSignIn).toHaveBeenCalledWith({ clientId: 'monitor-client' });
    expect(accepted).toBe(continuation && `${continuation}?login_verifier=accepted`);
    expect(fetchMock).toHaveBeenCalledTimes(continuation ? 2 : 1);
  });

  it('hides an MCP client from an ordinary user', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ client: { client_id: 'example-client' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      acceptHydraLogin(challenge, { ...session, user: { ...session.user, role: 'user' } }),
    ).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('signs a Member in to a sign-in app with identity claims and no MCP audience or delegation', async () => {
    const admin: SessionWithUser = { ...session, user: { ...session.user, role: 'admin', email: 'admin@example.com' } };
    const request = {
      client: { client_id: 'monitor-client' },
      requested_access_token_audience: [],
      requested_scope: ['openid', 'email', 'profile'],
      subject: session.account_identity_id,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ redirect_to: 'https://sso.example/oauth2/auth?consent_verifier=accepted' }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(acceptHydraSignInConsent(challenge, request, admin)).resolves.toBe(
      'https://sso.example/oidc/oauth2/auth?consent_verifier=accepted',
    );
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      grant_access_token_audience: [],
      grant_scope: ['openid', 'email', 'profile'],
      remember: false,
      session: {
        id_token: {
          role: 'admin',
          email: 'admin@example.com',
          name: 'Example Member',
          preferred_username: 'Example Member',
        },
      },
    });
  });

  it('shares the Member avatar as the picture claim with the profile scope only', async () => {
    const image = '/asset/11111111-1111-4111-8111-111111111111/avatar.webp';
    const admin: SessionWithUser = { ...session, user: { ...session.user, role: 'admin', image } };
    const picture = buildManagedImageUrl(image, MANAGED_IMAGE_PRESET.AVATAR_SM);
    expect(picture).toContain('/asset/11111111-1111-4111-8111-111111111111/avatar.webp?w=96&h=96');
    const idToken = async (scopes: string[]) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ redirect_to: 'https://sso.example/oauth2/auth?consent_verifier=accepted' }),
        );
      vi.stubGlobal('fetch', fetchMock);
      const request = {
        client: { client_id: 'monitor-client' },
        requested_access_token_audience: [],
        requested_scope: scopes,
        subject: session.account_identity_id,
      };
      await acceptHydraSignInConsent(challenge, request, admin);
      return JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)).session.id_token;
    };

    expect(await idToken(['openid', 'profile'])).toEqual({
      role: 'admin',
      name: 'Example Member',
      preferred_username: 'Example Member',
      picture,
    });
    expect(await idToken(['openid'])).toEqual({ role: 'admin' });
  });

  it('refuses a sign-in app consent that does not ask for identity scopes for the Member', () => {
    const admin: SessionWithUser = { ...session, user: { ...session.user, role: 'admin' } };
    const request = {
      client: { client_id: 'monitor-client' },
      requested_access_token_audience: [] as string[],
      requested_scope: ['openid', 'email'],
      subject: session.account_identity_id,
    };
    expect(() => assertSignInConsentRequest(request, admin)).not.toThrow();
    const cases: [string, typeof request, SessionWithUser][] = [
      ['another subject', { ...request, subject: crypto.randomUUID() }, admin],
      ['the MCP scope', { ...request, requested_scope: ['openid', 'mcp'] }, admin],
      ['no openid scope', { ...request, requested_scope: ['email'] }, admin],
      ['a repeated scope', { ...request, requested_scope: ['openid', 'openid'] }, admin],
      ['an audience', { ...request, requested_access_token_audience: ['https://site.example/mcp'] }, admin],
    ];
    for (const [name, candidate, member] of cases) {
      expect(() => assertSignInConsentRequest(candidate, member), name).toThrow('does not match a sign-in app sign-in');
    }
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

  it.each(['login', 'consent'] as const)('keeps an MCP %s continuation on the MCP endpoint', async (kind) => {
    const redirect = { redirect_to: `https://sso.example/oidc/oauth2/auth?${kind}_verifier=accepted` };
    const fetchMock = vi.fn();
    if (kind === 'login') {
      fetchMock.mockResolvedValueOnce(jsonResponse({ client: consentRequest.client }));
    }
    fetchMock.mockResolvedValueOnce(jsonResponse(redirect));
    vi.stubGlobal('fetch', fetchMock);
    const continuation =
      kind === 'login' ? acceptHydraLogin(challenge, session) : acceptHydraConsent(challenge, consentRequest, session);
    await expect(continuation).resolves.toBe(`https://sso.example/oauth2/auth?${kind}_verifier=accepted`);
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
    // Hydra answers 400 when subject accompanies consent_request_id.
    expect(revokeUrl.searchParams.has('subject')).toBe(false);
    expect(revokeUrl.searchParams.get('consent_request_id')).toBe('consent-request-1');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'DELETE' });
  });
});
