const FORWARDED_UPLOAD_REQUEST_HEADERS = new Set([
  'content-length',
  'content-range',
  'content-type',
  'if-range',
  'range',
  'x-request-id',
]);

const STRIPPED_UPLOAD_RESPONSE_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

export function buildUploadProxyRequestHeaders(requestHeaders: Headers, cookieHeader: string): Headers {
  const headers = new Headers();
  requestHeaders.forEach((value, key) => {
    if (FORWARDED_UPLOAD_REQUEST_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  if (cookieHeader) {
    headers.set('cookie', cookieHeader);
  }

  return headers;
}

export function buildUploadProxyResponseHeaders(upstreamHeaders: Headers): Headers {
  const headers = new Headers();
  upstreamHeaders.forEach((value, key) => {
    if (!STRIPPED_UPLOAD_RESPONSE_HEADERS.has(key.toLowerCase())) {
      headers.append(key, value);
    }
  });
  return headers;
}

export function isUploadPartRequest(method: string, path: string[]): boolean {
  return method.toUpperCase() === 'PUT' && path.length === 1 && path[0] === 'part';
}

export function resolveUploadProxyBaseUrl(input: { method: string; path: string[]; apiUrl: string }): string {
  return input.apiUrl;
}
