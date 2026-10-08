import { NextResponse } from 'next/server';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { createMemberClient } from '@/lib/api/server-client';
import { isAuthenticationConnectError } from '@/lib/api/connect-error';
import { toHttpErrorResult } from '@/lib/api/http-error';
import { createLogger } from '@/lib/utils/logger';
import { COOKIE_CONSENT_VERSION } from '@/lib/cookie-consent';

const logger = createLogger('cookie-consent-api');

interface CookieConsentPayload {
  analytics?: unknown;
  source?: unknown;
  version?: unknown;
}

interface CookieConsentResponse {
  essential: boolean;
  analytics: boolean;
  version: number;
  source: string;
  updated_at: string | null;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asVersion(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.trunc(value) : COOKIE_CONSENT_VERSION;
}

function serializeConsent(
  consent: {
    essential: boolean;
    analytics: boolean;
    version: number;
    source: string;
    updatedAt?: unknown;
  } | null,
): CookieConsentResponse | null {
  if (!consent) {
    return null;
  }

  let updatedAt: string | null = null;
  if (consent.updatedAt) {
    try {
      updatedAt = timestampDate(consent.updatedAt as Parameters<typeof timestampDate>[0]).toISOString();
    } catch {
      updatedAt = null;
    }
  }

  return {
    essential: consent.essential,
    analytics: consent.analytics,
    version: consent.version,
    source: consent.source,
    updated_at: updatedAt,
  };
}

export async function GET() {
  try {
    const memberClient = await createMemberClient();
    const response = await memberClient.getMySettings({});
    const consent = serializeConsent(response.cookieConsent ?? null);

    return NextResponse.json({
      success: true,
      persisted: !!consent,
      consent,
    });
  } catch (err) {
    if (isAuthenticationConnectError(err)) {
      // Anonymous users have browser-only consent.
      return NextResponse.json({ success: true, persisted: false, consent: null });
    }

    logger.error('Failed to fetch cookie consent', { error: err });
    const { status, error } = toHttpErrorResult(err, 'Failed to fetch cookie consent');
    return NextResponse.json({ success: false, error }, { status });
  }
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    typeof (payload as CookieConsentPayload).analytics !== 'boolean'
  ) {
    return NextResponse.json({ success: false, error: '"analytics" must be a boolean' }, { status: 400 });
  }

  const consentPayload = payload as CookieConsentPayload & { analytics: boolean };
  try {
    const memberClient = await createMemberClient();
    const response = await memberClient.updateMyPreferences({
      cookieConsent: {
        analytics: consentPayload.analytics,
        version: asVersion(consentPayload.version),
        source: asOptionalString(consentPayload.source),
      },
    });
    const consent = serializeConsent(response.settings?.cookieConsent ?? null);

    return NextResponse.json({
      success: true,
      persisted: true,
      consent,
    });
  } catch (err) {
    if (isAuthenticationConnectError(err)) {
      // Anonymous users are expected to rely on browser-cookie consent.
      return NextResponse.json({ success: true, persisted: false });
    }

    logger.error('Failed to persist cookie consent', { error: err });
    const { status, error } = toHttpErrorResult(err, 'Failed to persist cookie consent');
    return NextResponse.json({ success: false, error }, { status });
  }
}
