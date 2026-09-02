import { describe, expect, it, vi } from 'vitest';
import { proxyFaviconRequest } from './favicon-proxy';

const ALLOWED_CDN_URL = 'https://cdn.example.com';
const ICO_ASSET_URL = `${ALLOWED_CDN_URL}/asset/11111111-1111-4111-8111-111111111111/favicon.ico`;

function createIco(sizes: number[] = [16, 32, 48], payloadSize = 8): Uint8Array {
  const directoryEnd = 6 + sizes.length * 16;
  const bytes = new Uint8Array(directoryEnd + sizes.length * payloadSize);
  const view = new DataView(bytes.buffer);

  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, sizes.length, true);

  sizes.forEach((size, index) => {
    const entryOffset = 6 + index * 16;
    const imageOffset = directoryEnd + index * payloadSize;

    view.setUint8(entryOffset, size === 256 ? 0 : size);
    view.setUint8(entryOffset + 1, size === 256 ? 0 : size);
    view.setUint16(entryOffset + 4, 1, true);
    view.setUint16(entryOffset + 6, 32, true);
    view.setUint32(entryOffset + 8, payloadSize, true);
    view.setUint32(entryOffset + 12, imageOffset, true);
    bytes.fill(index + 1, imageOffset, imageOffset + payloadSize);
  });

  return bytes;
}

const VALID_ICO = createIco();

function toResponseBody(bytes: Uint8Array): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

function faviconRequestOptions(
  overrides: Partial<Parameters<typeof proxyFaviconRequest>[0]> = {},
): Parameters<typeof proxyFaviconRequest>[0] {
  return {
    allowedCdnUrl: ALLOWED_CDN_URL,
    sourceUrl: ICO_ASSET_URL,
    ...overrides,
  };
}

describe('favicon-proxy', () => {
  it('returns 404 when no generated ICO is configured', async () => {
    const response = await proxyFaviconRequest(
      faviconRequestOptions({
        sourceUrl: null,
      }),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('proxies a structurally valid 16/32/48 ICO with bounded stable-route caching', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(toResponseBody(VALID_ICO), {
        status: 200,
        headers: {
          'Content-Type': 'image/vnd.microsoft.icon',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'CDN-Cache-Control': 'public, max-age=31536000, immutable',
          'Cloudflare-CDN-Cache-Control': 'public, max-age=31536000, immutable',
          Age: '527',
          ETag: '"favicon-v2"',
          'Last-Modified': 'Wed, 15 Jul 2026 10:00:00 GMT',
          'Content-Length': '999',
          'Content-Encoding': 'gzip',
        },
      });
    });

    const response = await proxyFaviconRequest(
      faviconRequestOptions({
        requestHeaders: new Headers({
          Accept: 'image/x-icon,*/*',
          'If-Modified-Since': 'Wed, 15 Jul 2026 10:00:00 GMT',
          'If-None-Match': '"favicon-v2"',
        }),
        fetchImpl: fetchMock as typeof fetch,
      }),
    );

    const fetchOptions = fetchMock.mock.calls[0]?.[1];
    expect(fetchMock).toHaveBeenCalledWith(
      ICO_ASSET_URL,
      expect.objectContaining({
        method: 'GET',
        cache: 'force-cache',
        redirect: 'manual',
      }),
    );
    expect(fetchOptions?.headers).toBeInstanceOf(Headers);
    expect((fetchOptions?.headers as Headers).get('accept')).toBe('image/x-icon,*/*');
    expect((fetchOptions?.headers as Headers).get('if-none-match')).toBe('"favicon-v2"');
    expect((fetchOptions?.headers as Headers).get('if-modified-since')).toBe('Wed, 15 Jul 2026 10:00:00 GMT');
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/x-icon');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300, s-maxage=300, must-revalidate');
    expect(response.headers.get('ETag')).toBe('"favicon-v2"');
    expect(response.headers.get('Last-Modified')).toBe('Wed, 15 Jul 2026 10:00:00 GMT');
    expect(response.headers.has('CDN-Cache-Control')).toBe(false);
    expect(response.headers.has('Cloudflare-CDN-Cache-Control')).toBe(false);
    expect(response.headers.has('Age')).toBe(false);
    expect(response.headers.has('Content-Length')).toBe(false);
    expect(response.headers.has('Content-Encoding')).toBe(false);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(VALID_ICO);
  });

  it('preserves a safe conditional 304 response without upstream cache directives', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: '"favicon-v2"',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'CDN-Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    });

    const response = await proxyFaviconRequest(
      faviconRequestOptions({
        requestHeaders: { 'If-None-Match': '"favicon-v2"' },
        fetchImpl: fetchMock as typeof fetch,
      }),
    );

    expect(response.status).toBe(304);
    expect(response.headers.get('ETag')).toBe('"favicon-v2"');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300, s-maxage=300, must-revalidate');
    expect(response.headers.has('CDN-Cache-Control')).toBe(false);
    expect(await response.text()).toBe('');
  });

  it('returns non-2xx upstream responses without caching or an icon content type', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response('<html>missing</html>', {
        status: 404,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'CDN-Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    });

    const response = await proxyFaviconRequest(faviconRequestOptions({ fetchImpl: fetchMock as typeof fetch }));

    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.has('Content-Type')).toBe(false);
    expect(response.headers.has('CDN-Cache-Control')).toBe(false);
    expect(await response.text()).toBe('');
  });

  it.each([204, 206])('rejects upstream status %i without caching a partial or empty icon response', async (status) => {
    const fetchMock = vi.fn(async () => {
      return new Response(status === 204 ? null : toResponseBody(VALID_ICO), {
        status,
        headers: {
          'Content-Type': 'image/x-icon',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    });

    const response = await proxyFaviconRequest(faviconRequestOptions({ fetchImpl: fetchMock as typeof fetch }));

    expect(response.status).toBe(status);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.has('Content-Type')).toBe(false);
    expect(await response.text()).toBe('');
  });

  it('does not accept an unsolicited 304 as a conditional favicon response', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: '"favicon-v2"',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    });

    const response = await proxyFaviconRequest(faviconRequestOptions({ fetchImpl: fetchMock as typeof fetch }));

    expect(response.status).toBe(304);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.has('Content-Type')).toBe(false);
    expect(response.headers.has('ETag')).toBe(false);
  });

  it.each([
    ['non-HTTPS protocol', 'http://cdn.example.com/asset/11111111-1111-4111-8111-111111111111/favicon.ico'],
    ['different origin', 'https://evil.example/asset/11111111-1111-4111-8111-111111111111/favicon.ico'],
    ['non-canonical path', 'https://cdn.example.com/asset/not-a-uuid/favicon.ico'],
    ['query string', `${ICO_ASSET_URL}?redirect=https://evil.example`],
  ])('rejects a favicon source with %s', async (_name, sourceUrl) => {
    const fetchMock = vi.fn();

    const response = await proxyFaviconRequest(
      faviconRequestOptions({
        sourceUrl,
        fetchImpl: fetchMock as typeof fetch,
      }),
    );

    expect(response.status).toBe(502);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Content-Type')).toBe('text/plain;charset=UTF-8');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not follow redirects from the configured CDN asset', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(null, {
        status: 302,
        headers: {
          Location: 'http://169.254.169.254/latest/meta-data',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    });

    const response = await proxyFaviconRequest(faviconRequestOptions({ fetchImpl: fetchMock as typeof fetch }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(ICO_ASSET_URL, expect.objectContaining({ redirect: 'manual' }));
    expect(response.status).toBe(302);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.has('Location')).toBe(false);
    expect(response.headers.has('Content-Type')).toBe(false);
  });

  it.each([
    ['prefix-only header', new Uint8Array([0, 0, 1, 0, 3, 0])],
    ['truncated directory or payload', VALID_ICO.slice(0, VALID_ICO.length - 1)],
    [
      'out-of-bounds image offset',
      (() => {
        const bytes = createIco();
        new DataView(bytes.buffer).setUint32(6 + 12, bytes.length + 100, true);
        return bytes;
      })(),
    ],
    [
      'non-square dimensions',
      (() => {
        const bytes = createIco();
        new DataView(bytes.buffer).setUint8(6 + 1, 32);
        return bytes;
      })(),
    ],
  ])('rejects a structurally invalid ICO with %s', async (_name, invalidIco) => {
    const fetchMock = vi.fn(async () => {
      return new Response(toResponseBody(invalidIco), {
        status: 200,
        headers: { 'Content-Type': 'image/x-icon' },
      });
    });

    const response = await proxyFaviconRequest(faviconRequestOptions({ fetchImpl: fetchMock as typeof fetch }));

    expect(response.status).toBe(502);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('rejects a PNG even when a bad upstream labels it as an icon', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: { 'Content-Type': 'image/x-icon' },
      });
    });

    const response = await proxyFaviconRequest(faviconRequestOptions({ fetchImpl: fetchMock as typeof fetch }));

    expect(response.status).toBe(502);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('rejects a head response with a non-ICO content type without reading a body', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(null, {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      });
    });

    const response = await proxyFaviconRequest(
      faviconRequestOptions({
        method: 'HEAD',
        fetchImpl: fetchMock as typeof fetch,
      }),
    );

    expect(response.status).toBe(502);
  });

  it('omits the response body for valid head requests', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(null, {
        status: 200,
        headers: {
          'Content-Type': 'image/x-icon',
          ETag: '"favicon-v2"',
        },
      });
    });

    const response = await proxyFaviconRequest(
      faviconRequestOptions({
        method: 'HEAD',
        fetchImpl: fetchMock as typeof fetch,
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/x-icon');
    expect(response.headers.get('ETag')).toBe('"favicon-v2"');
    expect(await response.text()).toBe('');
  });

  it('returns 502 when the generated ICO request fails', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('upstream unavailable');
    });

    const response = await proxyFaviconRequest(faviconRequestOptions({ fetchImpl: fetchMock as typeof fetch }));

    expect(response.status).toBe(502);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
