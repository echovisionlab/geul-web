'use server';

import { timestampDate } from '@bufbuild/protobuf/wkt';
import { createMemberClient } from '@/lib/api/server-client';
import { isAuthenticationConnectError, isConnectError } from '@/lib/api/connect-error';
import { COOKIE_CONSENT_VERSION } from '@/lib/cookie-consent';

export interface PersistCookieConsentInput {
  analytics: boolean;
  source?: string;
  version?: number;
}

export interface PersistCookieConsentResult {
  success: boolean;
  persisted: boolean;
  error?: string;
  consent?: {
    essential: boolean;
    analytics: boolean;
    version: number;
    source: string;
    updated_at: string | null;
  };
}

export async function persistCurrentUserCookieConsentAction(
  input: PersistCookieConsentInput,
): Promise<PersistCookieConsentResult> {
  try {
    const memberClient = await createMemberClient();
    const response = await memberClient.updateMyPreferences({
      cookieConsent: {
        analytics: input.analytics,
        version: input.version ?? COOKIE_CONSENT_VERSION,
        source: input.source,
      },
    });

    const consent = response.settings?.cookieConsent;
    if (!consent) {
      return {
        success: false,
        persisted: false,
        error: 'Missing consent response from server',
      };
    }

    return {
      success: true,
      persisted: true,
      consent: {
        essential: consent.essential,
        analytics: consent.analytics,
        version: consent.version,
        source: consent.source,
        updated_at: consent.updatedAt ? timestampDate(consent.updatedAt).toISOString() : null,
      },
    };
  } catch (err) {
    if (isAuthenticationConnectError(err)) {
      // Anonymous users rely on browser-cookie consent only.
      return { success: true, persisted: false };
    }
    if (isConnectError(err)) {
      return { success: false, persisted: false, error: err.message };
    }

    return {
      success: false,
      persisted: false,
      error: err instanceof Error ? err.message : 'Failed to persist cookie consent',
    };
  }
}
