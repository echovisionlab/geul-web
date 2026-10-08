import { NextRequest } from 'next/server';
import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({ session: vi.fn(), settings: vi.fn(), home: vi.fn(), content: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSessionFromCookie: mocks.session }));
vi.mock('@/lib/queries/manifest', () => ({ getSettings: mocks.settings }));
vi.mock('@/lib/utils/logger', () => ({ createLogger: () => ({ error: vi.fn() }) }));
vi.mock('@/lib/utils/og-image', async () => ({
  ...(await import('@/lib/utils/og-config')),
  generateHomeOgImage: mocks.home,
  generateOgImage: mocks.content,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { role: 'admin' } });
  mocks.settings.mockResolvedValue({ site_title: 'DSUB' });
  mocks.home.mockResolvedValue(Buffer.from('image'));
});
const request = (body: string) => new NextRequest('https://www.dsub.io/api/og-preview', { method: 'POST', body });
describe('OG preview HTTP boundary', () => {
  it.each(['bad JSON', 'null', '[]', '{}', '{"type":"invalid"}', '{"type":"home","config":{}}'])(
    'rejects %s with 400 before rendering',
    async (body) => {
      expect((await POST(request(body))).status).toBe(400);
      expect(mocks.settings).not.toHaveBeenCalled();
      expect(mocks.home).not.toHaveBeenCalled();
    },
  );
  it('distinguishes anonymous and Author callers', async () => {
    mocks.session.mockResolvedValue(null);
    expect((await POST(request('{"type":"home"}'))).status).toBe(401);
    mocks.session.mockResolvedValue({ user: { role: 'author' } });
    expect((await POST(request('{"type":"home"}'))).status).toBe(403);
    expect(mocks.settings).not.toHaveBeenCalled();
  });
  it('preserves a settings dependency outage as 503', async () => {
    mocks.settings.mockRejectedValue(new ConnectError('private database details', Code.Unavailable));
    const response = await POST(request('{"type":"home"}'));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private');
  });

  it('preserves an authentication dependency outage as 503', async () => {
    mocks.session.mockRejectedValue(new ConnectError('private authentication details', Code.Unavailable));
    const response = await POST(request('{"type":"home"}'));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private');
    expect(mocks.settings).not.toHaveBeenCalled();
  });
  it('returns 500 for a genuine renderer failure without details', async () => {
    mocks.home.mockRejectedValue(new Error('private renderer/font path'));
    const response = await POST(request('{"type":"home"}'));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('private');
  });
  it('accepts the current home request', async () => {
    expect((await POST(request('{"type":"home"}'))).status).toBe(200);
  });
});
