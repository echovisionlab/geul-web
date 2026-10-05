import { cookies } from 'next/headers';
import { getApiUrl } from '@/lib/env';
import {
  buildUploadProxyRequestHeaders,
  buildUploadProxyResponseHeaders,
  resolveUploadProxyBaseUrl,
} from '@/lib/utils/upload-proxy';

export const runtime = 'nodejs';

function uploadUrl(request: Request, path: string[], baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const sourceUrl = new URL(request.url);
  const upstreamPath = path.join('/');
  const upstreamUrl = new URL(`${normalizedBaseUrl}/upload/${upstreamPath}`);
  upstreamUrl.search = sourceUrl.search;
  return upstreamUrl.toString();
}

async function proxyUpload(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');

  const { path } = await params;
  const upstreamUrl = uploadUrl(
    request,
    path,
    resolveUploadProxyBaseUrl({
      method: request.method,
      path,
      apiUrl: getApiUrl(),
    }),
  );
  const forwardHeaders = buildUploadProxyRequestHeaders(request.headers, cookieHeader);

  const requestBody = request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body;

  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: forwardHeaders,
    cache: 'no-store',
    body: requestBody,
    signal: request.signal,
  };
  if (requestBody) {
    init.duplex = 'half';
  }

  let response: Response;
  try {
    response = await fetch(upstreamUrl, init);
  } catch {
    return new Response('Bad Gateway', { status: 502 });
  }

  const responseHeaders = buildUploadProxyResponseHeaders(response.headers);

  const responseBody =
    request.method === 'HEAD' || response.status === 204 || response.status === 304 ? null : response.body;

  return new Response(responseBody, {
    status: response.status,
    headers: responseHeaders,
  });
}

export { proxyUpload as PUT, proxyUpload as POST, proxyUpload as OPTIONS, proxyUpload as GET };
