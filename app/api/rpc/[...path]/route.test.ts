import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }));
vi.mock('@/lib/env', () => ({ getApiUrl: () => 'https://api.example', getSessionCookieName: () => 'session' }));
vi.mock('@/lib/public-runtime-config', () => ({ getPublicApiUrl: () => 'https://api.example' }));
vi.mock('@/lib/utils/logger', () => ({ createLogger: () => ({ error: vi.fn() }) }));
const context = () => ({ params: Promise.resolve({ path: ['test.Service', 'Call'] }) });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
});
describe('RPC proxy transport failures', () => {
  it('rejects an unreadable request before calling upstream', async () => {
    const request = new Request('https://www.dsub.io/api/rpc/test.Service/Call', { method: 'POST', body: 'data' });
    vi.spyOn(request, 'arrayBuffer').mockRejectedValueOnce(new Error('private read error'));
    const response = await POST(request, context());
    expect(response.status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain('private');
  });
  it('maps an upstream body failure to 502', async () => {
    const upstream = new Response('response', { headers: { 'content-type': 'application/json' } });
    vi.spyOn(upstream, 'arrayBuffer').mockRejectedValueOnce(new Error('private upstream details'));
    mocks.fetch.mockResolvedValue(upstream);
    const response = await GET(new Request('https://www.dsub.io/api/rpc/test.Service/Call'), context());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('private');
  });
  it('preserves an ordinary upstream client failure', async () => {
    mocks.fetch.mockResolvedValue(
      new Response('{"code":"invalid_argument"}', { status: 400, headers: { 'content-type': 'application/json' } }),
    );
    const response = await GET(new Request('https://www.dsub.io/api/rpc/test.Service/Call'), context());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: 'invalid_argument' });
  });
});
