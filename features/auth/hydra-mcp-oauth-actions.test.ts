import { beforeEach, describe, expect, it, vi } from 'vitest';
import { approveMcpConsent, rejectMcpConsentAction } from './hydra-mcp-oauth-actions';

const mocks = vi.hoisted(() => ({
  acceptHydraConsent: vi.fn(),
  assertMcpConsentRequest: vi.fn(),
  getHydraConsentRequest: vi.fn(),
  getSessionFromCookie: vi.fn(),
  isMcpAuthor: vi.fn(),
  rejectHydraConsent: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  redirect: (location: string) => {
    throw new Error(`NEXT_REDIRECT:${location}`);
  },
}));

vi.mock('@/features/auth/hydra-mcp-oauth', () => ({
  acceptHydraConsent: mocks.acceptHydraConsent,
  assertMcpConsentRequest: mocks.assertMcpConsentRequest,
  getHydraConsentRequest: mocks.getHydraConsentRequest,
  isMcpAuthor: mocks.isMcpAuthor,
  parseHydraChallenge: (value: unknown) =>
    typeof value === 'string' && value.length > 0 && value.length <= 8_192 ? value : null,
  rejectHydraConsent: mocks.rejectHydraConsent,
}));

vi.mock('@/lib/auth', () => ({ getSessionFromCookie: mocks.getSessionFromCookie }));

describe('MCP OAuth consent actions', () => {
  const session = { account_identity_id: crypto.randomUUID(), user: { role: 'author' } };
  const request = { subject: session.account_identity_id };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionFromCookie.mockResolvedValue(session);
    mocks.isMcpAuthor.mockReturnValue(true);
    mocks.getHydraConsentRequest.mockResolvedValue(request);
    mocks.acceptHydraConsent.mockResolvedValue('https://sso.example/oauth2/auth?consent_verifier=accepted');
    mocks.rejectHydraConsent.mockResolvedValue('https://sso.example/oauth2/auth?error=access_denied');
  });

  it('rechecks the current session and exact Hydra request before approval', async () => {
    await expect(approveMcpConsent('challenge-1')).rejects.toThrow(
      'NEXT_REDIRECT:https://sso.example/oauth2/auth?consent_verifier=accepted',
    );

    expect(mocks.getHydraConsentRequest).toHaveBeenCalledWith('challenge-1');
    expect(mocks.assertMcpConsentRequest).toHaveBeenCalledWith(request, session);
    expect(mocks.acceptHydraConsent).toHaveBeenCalledWith('challenge-1', request, session);
  });

  it('rechecks the current session and Hydra grant before rejection', async () => {
    await expect(rejectMcpConsentAction('challenge-1')).rejects.toThrow(
      'NEXT_REDIRECT:https://sso.example/oauth2/auth?error=access_denied',
    );

    expect(mocks.rejectHydraConsent).toHaveBeenCalledWith('challenge-1', session);
  });

  it('resumes the same consent challenge through login when the session is missing', async () => {
    mocks.getSessionFromCookie.mockResolvedValue(null);

    await expect(approveMcpConsent('challenge-1')).rejects.toThrow(
      'NEXT_REDIRECT:/login?redirect=%2Foauth%2Fauthorize%2Fconsent%3Fconsent_challenge%3Dchallenge-1',
    );
    expect(mocks.getHydraConsentRequest).not.toHaveBeenCalled();
  });

  it('hides the action from ordinary users and rejects malformed challenges', async () => {
    mocks.isMcpAuthor.mockReturnValue(false);
    await expect(approveMcpConsent('challenge-1')).rejects.toThrow('NEXT_NOT_FOUND');

    vi.clearAllMocks();
    await expect(approveMcpConsent('')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.getSessionFromCookie).not.toHaveBeenCalled();
  });
});
