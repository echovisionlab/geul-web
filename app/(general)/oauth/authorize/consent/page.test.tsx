import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en.json';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getRequest: vi.fn(),
  assertRequest: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
}));

vi.mock('next/navigation', () => ({ notFound: vi.fn(), redirect: vi.fn() }));
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
  assertMcpConsentRequest: mocks.assertRequest,
  getHydraConsentRequest: mocks.getRequest,
  isMcpAuthor: () => true,
  mcpClientDisplayName: () => 'Example AI client',
  mcpDelegationDisplayName: () => 'Example AI client on behalf of Test Author',
  parseHydraChallenge: (value: string) => value,
}));

import McpConsentPage from './page';

async function renderConsent(scopes: string[]) {
  mocks.getRequest.mockResolvedValue({ requested_scope: scopes });
  const page = await McpConsentPage({
    searchParams: Promise.resolve({ consent_challenge: 'test-challenge' }),
  });
  return renderToStaticMarkup(<MantineProvider env="test">{page}</MantineProvider>);
}

describe('MCP consent explanation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: 'author-id', role: 'author' } });
  });

  it('explains account permissions, content and attachment changes, revocation and client attribution', async () => {
    const html = await renderConsent(['mcp']);

    expect(html).toContain(messages.security.mcpIntegration.consentDescription);
    expect(html).toContain('You can revoke this connection in Settings → Remote MCP.');
    expect(html).toContain('Example AI client on behalf of Test Author');
    expect(html).toContain('Example AI client');
    expect(html).not.toContain(messages.security.mcpIntegration.description);
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
