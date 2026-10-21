'use client';

import { useCallback, useEffect, useState } from 'react';
import { useWindowEvent } from '@mantine/hooks';
import {
  COOKIE_CONSENT_CHANGE_EVENT,
  COOKIE_CONSENT_COOKIE_NAME,
  getCookieValue,
  hasValidAnalyticsConsent,
  parseCookieConsentPreferences,
} from '@/lib/cookie-consent';

/**
 * Current-version consent to the single optional category (analytics and
 * external media). It is false until the visitor decides and during SSR.
 */
export function useOptionalCookieConsent(): boolean {
  const [allowed, setAllowed] = useState(false);
  const sync = useCallback(() => {
    setAllowed(
      typeof document !== 'undefined' &&
        hasValidAnalyticsConsent(
          parseCookieConsentPreferences(getCookieValue(document.cookie, COOKIE_CONSENT_COOKIE_NAME)),
        ),
    );
  }, []);
  useEffect(sync, [sync]);
  useWindowEvent(COOKIE_CONSENT_CHANGE_EVENT, sync);
  return allowed;
}
