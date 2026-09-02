import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const mocks = vi.hoisted(() => ({
  acceptHydraLogin: vi.fn(),
  getSessionFromCookie: vi.fn(),
  isMcpAuthor: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/features/auth/hydra-mcp-oauth', () => ({
  acceptHydraLogin: mocks.acceptHydraLogin,
  isMcpAuthor: mocks.isMcpAuthor,
  parseHydraChallenge: (value: unknown) =>
    typeof value === 'string' && value.length > 0 && value.length <= 8_192 ? value : null,
}));

vi.mock('@/lib/auth', () => ({ getSessionFromCookie: mocks.getSessionFromCookie }));
vi.mock('@/lib/env', () => ({ getSiteOrigin: () => 'https://site.example' }));
vi.mock('@/lib/utils/logger', () => ({ createLogger: () => ({ error: mocks.loggerError }) }));

describe('MCP OAuth login route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionFromCookie.mockResolvedValue({ account_identity_id: crypto.randomUUID() });
    mocks.isMcpAuthor.mockReturnValue(true);
    mocks.acceptHydraLogin.mockResolvedValue('https://sso.example/oauth2/auth?login_verifier=accepted');
  });

  it('returns to the same challenge through the ordinary login page when unauthenticated', async () => {
    mocks.getSessionFromCookie.mockResolvedValue(null);

    const response = await GET(
      new NextRequest('https://0.0.0.0:3000/oauth/authorize/login?login_challenge=challenge-1'),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://site.example/login?redirect=%2Foauth%2Fauthorize%2Flogin%3Flogin_challenge%3Dchallenge-1',
    );
    expect(mocks.acceptHydraLogin).not.toHaveBeenCalled();
  });

  it('accepts the challenge only for the authenticated Author or Admin session', async () => {
    const response = await GET(
      new NextRequest('https://site.example/oauth/authorize/login?login_challenge=challenge-1'),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://sso.example/oauth2/auth?login_verifier=accepted');
    expect(mocks.acceptHydraLogin).toHaveBeenCalledOnce();
  });

  it('preserves the padded opaque challenge emitted by Hydra', async () => {
    const response = await GET(
      new NextRequest('https://site.example/oauth/authorize/login?login_challenge=opaque%2B%2F%3D'),
    );

    expect(response.status).toBe(307);
    expect(mocks.acceptHydraLogin).toHaveBeenCalledWith('opaque+/=', expect.anything());
  });

  it('hides MCP from an authenticated ordinary user', async () => {
    mocks.isMcpAuthor.mockReturnValue(false);

    const response = await GET(
      new NextRequest('https://site.example/oauth/authorize/login?login_challenge=challenge-1'),
    );

    expect(response.status).toBe(404);
    expect(mocks.acceptHydraLogin).not.toHaveBeenCalled();
  });

  it('rejects duplicate or unknown query parameters before session lookup', async () => {
    for (const query of [
      'login_challenge=one&login_challenge=two',
      'login_challenge=one&redirect=https://attacker.example',
    ]) {
      const response = await GET(new NextRequest(`https://site.example/oauth/authorize/login?${query}`));
      expect(response.status).toBe(400);
    }
    expect(mocks.getSessionFromCookie).not.toHaveBeenCalled();
  });

  it('fails closed and logs when Hydra Admin is unavailable', async () => {
    const error = new Error('unavailable');
    mocks.acceptHydraLogin.mockRejectedValue(error);

    const response = await GET(
      new NextRequest('https://site.example/oauth/authorize/login?login_challenge=challenge-1'),
    );

    expect(response.status).toBe(502);
    expect(mocks.loggerError).toHaveBeenCalledWith('Failed to accept Hydra MCP login', { error });
  });
});
