import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('favicon-proxy');

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const RESPONSE_HEADERS_TO_STRIP = new Set([
  'age',
  'cache-control',
  'cdn-cache-control',
  'cloudflare-cdn-cache-control',
  'content-encoding',
  'content-length',
]);

const FAVICON_PROXY_HTTP_CACHE_SECONDS = 300;
const FAVICON_PROXY_CACHE_CONTROL = `public, max-age=${FAVICON_PROXY_HTTP_CACHE_SECONDS}, s-maxage=${FAVICON_PROXY_HTTP_CACHE_SECONDS}, must-revalidate`;
const ICO_CONTENT_TYPES = new Set(['image/x-icon', 'image/vnd.microsoft.icon']);
const CANONICAL_ICO_ASSET_PATH =
  /^\/asset\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/favicon\.ico$/;
const ICO_HEADER_SIZE = 6;
const ICO_DIRECTORY_ENTRY_SIZE = 16;

export interface FaviconProxyOptions {
  allowedCdnUrl: string;
  method?: string;
  requestHeaders?: HeadersInit;
  sourceUrl: string | null;
  fetchImpl?: typeof fetch;
}

function buildFallbackHeaders(): Headers {
  return new Headers({
    'Cache-Control': 'no-store',
  });
}

function buildProxyHeaders(headers: Headers): Headers {
  const responseHeaders = new Headers();

  headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lowerKey) && !RESPONSE_HEADERS_TO_STRIP.has(lowerKey)) {
      responseHeaders.append(key, value);
    }
  });

  responseHeaders.set('Cache-Control', FAVICON_PROXY_CACHE_CONTROL);
  responseHeaders.set('Content-Type', 'image/x-icon');

  return responseHeaders;
}

function isIcoContentType(contentType: string | null): boolean {
  return ICO_CONTENT_TYPES.has(contentType?.split(';', 1)[0]?.trim().toLowerCase() ?? '');
}

function isIcoFile(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < ICO_HEADER_SIZE) {
    return false;
  }

  const view = new DataView(bytes);
  const reserved = view.getUint16(0, true);
  const type = view.getUint16(2, true);
  const count = view.getUint16(4, true);
  const directoryEnd = ICO_HEADER_SIZE + count * ICO_DIRECTORY_ENTRY_SIZE;

  if (reserved !== 0 || type !== 1 || count === 0 || directoryEnd > bytes.byteLength) {
    return false;
  }

  for (let index = 0; index < count; index += 1) {
    const entryOffset = ICO_HEADER_SIZE + index * ICO_DIRECTORY_ENTRY_SIZE;
    const width = view.getUint8(entryOffset) || 256;
    const height = view.getUint8(entryOffset + 1) || 256;
    const bytesInResource = view.getUint32(entryOffset + 8, true);
    const imageOffset = view.getUint32(entryOffset + 12, true);
    const imageEnd = imageOffset + bytesInResource;

    if (width !== height || bytesInResource === 0 || imageOffset < directoryEnd || imageEnd > bytes.byteLength) {
      return false;
    }
  }

  return true;
}

function isAllowedFaviconSource(sourceUrl: string, allowedCdnUrl: string): boolean {
  try {
    const source = new URL(sourceUrl);
    const allowedCdn = new URL(allowedCdnUrl);

    return (
      source.protocol === 'https:' &&
      allowedCdn.protocol === 'https:' &&
      source.origin === allowedCdn.origin &&
      source.username === '' &&
      source.password === '' &&
      source.search === '' &&
      source.hash === '' &&
      CANONICAL_ICO_ASSET_PATH.test(source.pathname)
    );
  } catch {
    return false;
  }
}

function buildUpstreamHeaders(requestHeaders?: HeadersInit): Headers {
  const upstreamHeaders = new Headers();
  const headers = new Headers(requestHeaders);

  for (const key of ['accept', 'if-none-match', 'if-modified-since']) {
    const value = headers.get(key);
    if (value) {
      upstreamHeaders.set(key, value);
    }
  }

  return upstreamHeaders;
}

export async function proxyFaviconRequest({
  allowedCdnUrl,
  method = 'GET',
  requestHeaders,
  sourceUrl,
  fetchImpl = fetch,
}: FaviconProxyOptions): Promise<Response> {
  if (!sourceUrl) {
    return new Response(null, {
      status: 404,
      headers: buildFallbackHeaders(),
    });
  }

  if (!isAllowedFaviconSource(sourceUrl, allowedCdnUrl)) {
    logger.error('Generated favicon asset URL is not a canonical public CDN asset', {
      data: { sourceUrl },
    });
    return new Response('Bad Gateway', {
      status: 502,
      headers: buildFallbackHeaders(),
    });
  }

  let upstream: Response;
  const upstreamHeaders = buildUpstreamHeaders(requestHeaders);
  try {
    upstream = await fetchImpl(sourceUrl, {
      method,
      // Generated favicon URLs are content-addressed by asset ID. Reuse the
      // validated immutable response instead of making the Web server wait on
      // the CDN for every legacy /favicon.ico cache miss.
      cache: 'force-cache',
      redirect: 'manual',
      headers: upstreamHeaders,
    });
  } catch (err) {
    logger.error('Favicon proxy upstream fetch failed', {
      data: {
        sourceUrl,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return new Response('Bad Gateway', {
      status: 502,
      headers: buildFallbackHeaders(),
    });
  }

  const isConditionalRequest = upstreamHeaders.has('if-none-match') || upstreamHeaders.has('if-modified-since');
  const isAllowedStatus = upstream.status === 200 || (upstream.status === 304 && isConditionalRequest);

  if (!isAllowedStatus) {
    return new Response(null, {
      status: upstream.status,
      headers: buildFallbackHeaders(),
    });
  }

  const responseBody =
    method === 'HEAD' || upstream.status === 204 || upstream.status === 304 ? null : await upstream.arrayBuffer();

  if (
    upstream.ok &&
    (!isIcoContentType(upstream.headers.get('Content-Type')) || (responseBody !== null && !isIcoFile(responseBody)))
  ) {
    logger.error('Generated favicon asset is not a valid ICO', {
      data: {
        sourceUrl,
        contentType: upstream.headers.get('Content-Type'),
      },
    });
    return new Response('Bad Gateway', {
      status: 502,
      headers: buildFallbackHeaders(),
    });
  }

  return new Response(responseBody, {
    status: upstream.status,
    headers: buildProxyHeaders(upstream.headers),
  });
}
