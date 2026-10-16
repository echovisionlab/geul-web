import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  publicApiUrl: 'https://api.example',
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }));
vi.mock('@/lib/env', () => ({ getApiUrl: () => 'https://api.example', getSessionCookieName: () => 'session' }));
vi.mock('@/lib/public-runtime-config.server', () => ({
  getServerPublicRuntimeConfig: () => ({ apiUrl: mocks.publicApiUrl }),
}));
vi.mock('@/lib/utils/logger', () => ({ createLogger: () => mocks }));
const context = () => ({ params: Promise.resolve({ path: ['test.Service', 'Call'] }) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.publicApiUrl = 'https://api.example';
  vi.stubGlobal('fetch', mocks.fetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

describe('RPC proxy failure logging', () => {
  it('preserves the cause of a failed attempt even when a later target succeeds', async () => {
    mocks.publicApiUrl = 'https://api.fallback';
    const cause = new Error('connection refused');
    mocks.fetch.mockRejectedValueOnce(cause).mockResolvedValueOnce(new Response('ok'));
    const response = await GET(new Request('http://web.test/api/rpc/test.Service/Get'), context());
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
    expect(mocks.warn).toHaveBeenCalledWith('RPC proxy upstream attempt failed', {
      error: cause,
      data: { operation: 'test.Service/Call', attempt: 1 },
    });
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('logs the last original error before returning the existing 502 response', async () => {
    mocks.publicApiUrl = 'https://api.fallback';
    const cause = new Error('connection refused');
    mocks.fetch.mockRejectedValue(cause);
    const response = await GET(new Request('http://web.test/api/rpc/test.Service/Get'), context());
    expect(response.status).toBe(502);
    expect(mocks.error).toHaveBeenCalledWith('RPC proxy upstream fetch failed', {
      error: cause,
      data: { operation: 'test.Service/Call', attempts: 2 },
    });
  });
});
