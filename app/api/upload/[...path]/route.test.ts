import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, PUT } from './route';

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

  it('streams a URL source with canonical filename and size metadata through authenticated GET', async () => {
    const upstream = new Response(new Uint8Array([1, 2, 3, 4]), {
      headers: {
        'content-type': 'audio/wav',
        'content-disposition': 'attachment; filename=original.wav',
        'content-length': '4',
        'x-upload-source-size': '4',
        'cache-control': 'no-store',
      },
    });
    const fetchMock = vi.fn<typeof fetch>(async () => upstream);
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request(
      'https://web.example/api/upload/source?uploadType=7&url=https%3A%2F%2Fsource.example%2Fa.wav',
    );
    const response = await GET(request, { params: Promise.resolve({ path: ['source'] }) });
    const [url, init] = fetchMock.mock.calls[0]!;

    expect(url).toBe('https://gateway.example/upload/source?uploadType=7&url=https%3A%2F%2Fsource.example%2Fa.wav');
    expect(init).toMatchObject({ method: 'GET', cache: 'no-store', signal: request.signal });
    expect(init!.body).toBeUndefined();
    expect(Object.fromEntries((init!.headers as Headers).entries())).toEqual({ cookie: 'session=owned' });
    expect(response.body).toBe(upstream.body);
    expect(response.headers.get('content-disposition')).toBe('attachment; filename=original.wav');
    expect(response.headers.get('content-length')).toBeNull();
    expect(response.headers.get('x-upload-source-size')).toBe('4');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it('preserves an interrupted source stream as an error instead of a successful partial download', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('Source stream interrupted'));
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(stream)),
    );
    const response = await GET(new Request('https://web.example/api/upload/source'), {
      params: Promise.resolve({ path: ['source'] }),
    });

    await expect(response.arrayBuffer()).rejects.toThrow('Source stream interrupted');
  });
});
