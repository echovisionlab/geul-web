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

const RESPONSE_HEADERS_TO_STRIP = new Set(['content-length', 'content-encoding']);

/** Keep target order stable while avoiding duplicate fallback requests. */
export function normalizeRpcTargets(...urls: string[]): string[] {
  return [...new Set(urls.map((url) => url.replace(/\/+$/, '')))];
}

/** The proxy buffers/re-encodes the body, so upstream transport lengths no longer apply. */
export function buildRpcResponseHeaders(upstream: Headers): Headers {
  const forwarded = new Headers();
  upstream.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lowerKey) && !RESPONSE_HEADERS_TO_STRIP.has(lowerKey)) {
      forwarded.append(key, value);
    }
  });
  return forwarded;
}

const OPEN_API_PATH_PREFIX = 'api.open.v1.';

export function isOpenApiPath(path: string): boolean {
  return path.startsWith(OPEN_API_PATH_PREFIX);
}

export function shouldRetryOpenApiWithoutSession(status: number, path: string): boolean {
  return status === 401 && isOpenApiPath(path);
}

export function shouldExpireSessionCookies(status: number): boolean {
  return status === 401;
}

export function shouldRetryWithNextTarget(status: number, path: string): boolean {
  if (status >= 500) {
    return true;
  }

  if (!isOpenApiPath(path)) {
    return false;
  }

  // Open APIs are auth-optional; if the first upstream enforces auth, try the public upstream.
  return status === 401 || status === 403 || status === 404;
}
