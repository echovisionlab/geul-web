import { buildClientRenderFailedRecord } from '@echovisionlab/geul-telemetry';
import { isRequestId } from '@echovisionlab/geul-telemetry/request-id';
import { NextResponse, type NextRequest } from 'next/server';
import { emitSystemRecord } from '@/lib/logging/system-record';
import { createLogger } from '@/lib/utils/logger';
import {
  CLIENT_RENDER_FAILURE_MAX_BODY_BYTES,
  parseClientRenderFailurePayload,
} from '@/lib/observability/client-render-failure-payload';
import { clientRenderFailureRateLimit } from '@/lib/observability/client-render-failure-rate-limit';
import { REQUEST_ID_HEADER } from '@/lib/observability/request-correlation';

const loggerModule = 'client-render-failure-intake';
const logger = createLogger(loggerModule);

function emptyResponse(status: number): NextResponse {
  return new NextResponse(null, { status, headers: { 'cache-control': 'no-store' } });
}

function rateLimitedResponse(retryAfterSeconds: number): NextResponse {
  return new NextResponse(null, {
    status: 429,
    headers: {
      'cache-control': 'no-store',
      'retry-after': String(retryAfterSeconds),
    },
  });
}

function isSameOriginBrowserRequest(request: NextRequest): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') {
    return false;
  }
  const origin = request.headers.get('origin');
  if (!origin) {
    // The production ingress can remove both browser metadata headers. This
    // endpoint only records a rate-limited, canonical failure classification,
    // so accept that stripped form while still rejecting explicit cross-site
    // metadata or an explicit foreign Origin.
    return !fetchSite;
  }
  try {
    const requestedOrigin = new URL(origin).origin;
    const allowedOrigins = new Set([request.nextUrl.origin]);
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',', 1)[0]?.trim();
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',', 1)[0]?.trim() || 'https';
    if (forwardedHost) {
      allowedOrigins.add(`${forwardedProto}://${forwardedHost}`);
    }
    const configuredHost = process.env.HOST?.trim();
    if (configuredHost) {
      allowedOrigins.add(configuredHost.includes('://') ? new URL(configuredHost).origin : `https://${configuredHost}`);
    }
    return allowedOrigins.has(requestedOrigin);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginBrowserRequest(request)) {
    return emptyResponse(403);
  }

  if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
    return emptyResponse(415);
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > CLIENT_RENDER_FAILURE_MAX_BODY_BYTES) {
    return emptyResponse(413);
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > CLIENT_RENDER_FAILURE_MAX_BODY_BYTES) {
    return emptyResponse(413);
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(body);
  } catch {
    return emptyResponse(400);
  }
  const payload = parseClientRenderFailurePayload(decoded);
  if (!payload) {
    return emptyResponse(400);
  }
  const admission = clientRenderFailureRateLimit.admit(payload.report_id);
  if (admission.outcome === 'duplicate') {
    return emptyResponse(204);
  }
  if (admission.outcome === 'rate_limited') {
    return rateLimitedResponse(admission.retryAfterSeconds);
  }

  const requestId = request.headers.get(REQUEST_ID_HEADER)?.trim();
  const record = buildClientRenderFailedRecord(
    {
      occurred_at: new Date().toISOString(),
      ...(requestId && isRequestId(requestId) ? { request_id: requestId } : {}),
    },
    payload.surface,
  );
  await emitSystemRecord(loggerModule, record);
  if (payload.react_error_code !== undefined) {
    await logger.info('client.render.classified', {
      data: {
        react_error_code: Number(payload.react_error_code),
        ...(requestId && isRequestId(requestId) ? { request_id: requestId } : {}),
      },
    });
  }
  return emptyResponse(204);
}
