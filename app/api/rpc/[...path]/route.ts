import { cookies } from 'next/headers';
import { buildRpcForwardHeaders } from '@/lib/api/rpc-forward-headers';
import {
  shouldExpireSessionCookies,
  shouldRetryOpenApiWithoutSession,
  shouldRetryWithNextTarget,
} from '@/lib/api/rpc-proxy';
import {
  appendExpiredSessionCookies,
  buildCookieHeader,
  getSessionCookieNames,
  hasCookieNamed,
} from '@/lib/auth/session-cookie';
import { getApiUrl, getSessionCookieName } from '@/lib/env';
import { getPublicApiUrl } from '@/lib/public-runtime-config';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('rpc-proxy-api');

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
function buildApiTargets(): string[] {
  const targets = [getApiUrl(), getPublicApiUrl()].map((url) => url.replace(/\/+$/, ''));
  return [...new Set(targets)];
}

function buildForwardUrl(baseUrl: string, pathString: string): string {
  return `${baseUrl}/${pathString}`;
}

async function forwardRpcRequest(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const cookieStore = await cookies();
  const sessionCookieNames = getSessionCookieNames(getSessionCookieName());
  const cookieHeader = buildCookieHeader(cookieStore.getAll());

  const { path } = await params;
  const pathString = path.join('/');
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();
  const forwardHeaders = buildRpcForwardHeaders(request.headers, cookieHeader);
  const anonymousForwardHeaders = buildRpcForwardHeaders(request.headers, '');
  const apiTargets = buildApiTargets();
  const hasSessionCookie = hasCookieNamed(cookieHeader, sessionCookieNames);

  let response: Response | null = null;
  let lastError: unknown = null;
  let clearedInvalidSessionCookies = false;
  for (let i = 0; i < apiTargets.length; i += 1) {
    const targetUrl = buildForwardUrl(apiTargets[i], pathString);
    try {
      let candidate = await fetch(targetUrl, {
        method: request.method,
        headers: forwardHeaders,
        body,
        cache: 'no-store',
      });

      if (hasSessionCookie && shouldRetryOpenApiWithoutSession(candidate.status, pathString)) {
        clearedInvalidSessionCookies = true;
        candidate = await fetch(targetUrl, {
          method: request.method,
          headers: anonymousForwardHeaders,
          body,
          cache: 'no-store',
        });
      }

      if (i < apiTargets.length - 1 && shouldRetryWithNextTarget(candidate.status, pathString)) {
        response = candidate;
        continue;
      }

      response = candidate;
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!response) {
    logger.error('RPC proxy upstream fetch failed', {
      data: {
        path: pathString,
        targetsTried: apiTargets,
        error: lastError instanceof Error ? lastError.message : String(lastError),
      },
    });
    return new Response('Bad Gateway', { status: 502 });
  }

  const shouldClearSessionCookies =
    hasSessionCookie && (clearedInvalidSessionCookies || shouldExpireSessionCookies(response.status));

  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  if (contentType.startsWith('application/connect+')) {
    if (!shouldClearSessionCookies) {
      return response;
    }

    const connectHeaders = new Headers(response.headers);
    appendExpiredSessionCookies(connectHeaders, {
      requestUrl: request.url,
      sessionCookieNames,
    });
    const connectBody =
      request.method === 'HEAD' || response.status === 204 || response.status === 304
        ? null
        : await response.arrayBuffer();
    return new Response(connectBody, {
      status: response.status,
      headers: connectHeaders,
    });
  }

  // Forward response headers (excluding hop-by-hop headers)
  const responseHeaders = new Headers();
  response.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lowerKey) && !RESPONSE_HEADERS_TO_STRIP.has(lowerKey)) {
      responseHeaders.append(key, value);
    }
  });
  if (shouldClearSessionCookies) {
    appendExpiredSessionCookies(responseHeaders, {
      requestUrl: request.url,
      sessionCookieNames,
    });
  }

  const responseBody =
    request.method === 'HEAD' || response.status === 204 || response.status === 304
      ? null
      : await response.arrayBuffer();

  return new Response(responseBody, {
    status: response.status,
    headers: responseHeaders,
  });
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return forwardRpcRequest(request, context);
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return forwardRpcRequest(request, context);
}
