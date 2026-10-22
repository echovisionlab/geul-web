import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { renderToStaticMarkup } from 'react-dom/server';

import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en.json';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getRequest: vi.fn(),
  assertRequest: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  acceptSignIn: vi.fn(),
  signInClient: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('not-found');
  }),
  redirect: vi.fn((location: string) => {
    throw new Error(`redirect:${location}`);
  }),
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: 'common.actions' | 'common.labels' | 'security.mcpIntegration') =>
    createTranslator({ locale: 'en', messages, namespace }),
}));
vi.mock('@/lib/auth', () => ({ getSessionFromCookie: mocks.getSession }));
vi.mock('@/lib/auth/login-page', () => ({ buildLoginRedirectHref: vi.fn() }));
vi.mock('@/features/auth/hydra-mcp-oauth-actions', () => ({
  approveMcpConsent: mocks.approve,
  rejectMcpConsentAction: mocks.reject,
}));
vi.mock('@/features/auth/hydra-mcp-oauth', () => ({
  acceptHydraSignInConsent: mocks.acceptSignIn,
  assertMcpConsentRequest: mocks.assertRequest,
  isSignInClient: mocks.signInClient,
  getHydraConsentRequest: mocks.getRequest,
  isMcpAuthor: () => true,
  mcpClientDisplayName: () => 'Example AI client',
  mcpDelegationDisplayName: () => 'Example AI client on behalf of Test Author',
  parseHydraChallenge: (value: string) => value,
}));

import McpConsentPage from './page';

async function renderConsent(scopes: string[]) {
  mocks.getRequest.mockResolvedValue({ client: { client_id: 'example-client' }, requested_scope: scopes });
  const page = await McpConsentPage({
    searchParams: Promise.resolve({ consent_challenge: 'test-challenge' }),
  });
  return renderToStaticMarkup(<DesignSystemProvider forceColorScheme="light">{page}</DesignSystemProvider>);
}

describe('MCP consent explanation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: 'author-id', role: 'author' } });
    mocks.signInClient.mockReturnValue(false);
  });

  it('signs an Admin in to an operator tool without a consent screen', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'admin-id', role: 'admin' } });
    mocks.signInClient.mockReturnValue(true);
    mocks.acceptSignIn.mockResolvedValue('https://sso.example/oauth2/auth?consent_verifier=accepted');

    await expect(renderConsent(['openid', 'email'])).rejects.toThrow(
      'redirect:https://sso.example/oauth2/auth?consent_verifier=accepted',
    );
    expect(mocks.acceptSignIn).toHaveBeenCalledOnce();
    expect(mocks.assertRequest).not.toHaveBeenCalled();
  });

  it('hides an operator tool from an Author', async () => {
    mocks.signInClient.mockReturnValue(true);

    await expect(renderConsent(['openid', 'email'])).rejects.toThrow('not-found');
    expect(mocks.acceptSignIn).not.toHaveBeenCalled();
  });

  it('explains account permissions, content and attachment changes, revocation and client attribution', async () => {
    const html = await renderConsent(['mcp']);

    expect(html).toContain(messages.security.mcpIntegration.consentDescription);
    expect(html).toContain('You can revoke this connection in Settings → Remote MCP.');
    expect(html).toContain('Example AI client on behalf of Test Author');
    expect(html).toContain('Example AI client');
    expect(html).not.toContain(messages.security.mcpIntegration.consentOfflineAccess);
    expect(mocks.assertRequest).toHaveBeenCalledOnce();
    expect(mocks.approve).not.toHaveBeenCalled();
    expect(mocks.reject).not.toHaveBeenCalled();
  });

  it('explains continuation beyond the browser session when offline access is requested', async () => {
    const html = await renderConsent(['mcp', 'offline_access']);

    expect(html).toContain(messages.security.mcpIntegration.consentOfflineAccess);
    expect(html).toContain(messages.security.mcpIntegration.consentDescription);
    expect(html).toContain('You can revoke this connection in Settings → Remote MCP.');
  });
});
