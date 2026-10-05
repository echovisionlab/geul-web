import { createConnectTransport } from '@connectrpc/connect-web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticatedBrowserFetch } from '@/lib/auth/session-events';
import { createPublicBrowserTransport } from './public-transport';
import { createBrowserTransport } from './secure-transport';

vi.mock('@connectrpc/connect-web', () => ({
  createConnectTransport: vi.fn(() => ({})),
}));

vi.mock('@/lib/auth/session-events', () => ({
  authenticatedBrowserFetch: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function lastOptions() {
  const options = vi.mocked(createConnectTransport).mock.calls.at(-1)?.[0];
  if (!options?.fetch) {
    throw new Error('Browser transport must supply a fetch implementation');
  }
  return { ...options, fetch: options.fetch };
}

describe('browser RPC transports', () => {
  it('keeps the authenticated session fetch on the secure transport', () => {
    createBrowserTransport();
    expect(lastOptions()).toMatchObject({
      baseUrl: '/api/rpc',
      fetch: authenticatedBrowserFetch,
    });
  });

  it('overrides locale without mutating request headers or other fetch options', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal('fetch', fetchMock);
    createPublicBrowserTransport('ko');
    const headers = new Headers({ 'Accept-Language': 'en', 'X-Request-ID': 'request-1' });
    const signal = new AbortController().signal;
    await lastOptions().fetch('/api/rpc/public', { method: 'POST', credentials: 'omit', headers, signal });

    const [url, init] = fetchMock.mock.calls[0];
    expect(lastOptions().baseUrl).toBe('/api/rpc');
    expect(url).toBe('/api/rpc/public');
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit', signal });
    expect(init.headers.get('Accept-Language')).toBe('ko');
    expect(init.headers.get('X-Request-ID')).toBe('request-1');
    expect(headers.get('Accept-Language')).toBe('en');
    expect(authenticatedBrowserFetch).not.toHaveBeenCalled();
  });

  it.each([undefined, null, ''])('preserves request locale when the override is %s', async (override) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal('fetch', fetchMock);
    createPublicBrowserTransport(override);
    await lastOptions().fetch('/api/rpc/public', { headers: { 'Accept-Language': 'ja' } });

    expect(fetchMock.mock.calls[0][1].headers.get('Accept-Language')).toBe('ja');
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('credentials');
  });
});
