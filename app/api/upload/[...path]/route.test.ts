import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUT } from './route';

vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [{ name: 'session', value: 'owned' }] }) }));
vi.mock('@/lib/env', () => ({ getApiUrl: () => 'https://gateway.example' }));
afterEach(() => vi.unstubAllGlobals());

describe('artifact upload proxy', () => {
  it('streams the body, carries cancellation and forwards safe metadata and server cookies', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204, headers: { 'x-request-id': 'id-1' } }));
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request('https://web.example/api/upload/media-artifact?bundleId=bundle&path=master.m3u8', {
      method: 'PUT',
      body: 'data',
      headers: {
        'content-length': '4',
        'content-type': 'application/vnd.apple.mpegurl',
        cookie: 'injected=value',
        'x-member-id': 'injected',
      },
    });
    const response = await PUT(request, { params: Promise.resolve({ path: ['media-artifact'] }) });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://gateway.example/upload/media-artifact?bundleId=bundle&path=master.m3u8');
    expect(init.body).toBe(request.body);
    expect(init.signal).toBe(request.signal);
    expect(init.duplex).toBe('half');
    expect(Object.fromEntries(init.headers)).toEqual({
      'content-length': '4',
      'content-type': 'application/vnd.apple.mpegurl',
      cookie: 'session=owned',
    });
    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(response.headers.get('x-request-id')).toBe('id-1');
  });

  it('retains upstream failure status and streamed response body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('invalid hash', { status: 422 })));
    const response = await PUT(
      new Request('https://web.example/api/upload/media-artifact', { method: 'PUT', body: 'bad' }),
      { params: Promise.resolve({ path: ['media-artifact'] }) },
    );
    expect(response.status).toBe(422);
    expect(await response.text()).toBe('invalid hash');
  });

  it('returns Bad Gateway when the upstream cannot acknowledge the request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('connection failed')));
    const response = await PUT(
      new Request('https://web.example/api/upload/media-artifact', { method: 'PUT', body: 'data' }),
      { params: Promise.resolve({ path: ['media-artifact'] }) },
    );
    expect(response.status).toBe(502);
    expect(await response.text()).toBe('Bad Gateway');
  });
});
