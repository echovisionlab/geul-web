'use client';

import { useCallback, useEffect, useState } from 'react';
import Script from 'next/script';
import { useWindowEvent } from '@mantine/hooks';
import {
  clearGoogleAnalyticsCookies,
  COOKIE_CONSENT_CHANGE_EVENT,
  COOKIE_CONSENT_COOKIE_NAME,
  getCookieValue,
  hasValidAnalyticsConsent,
  parseCookieConsentPreferences,
} from '@/lib/cookie-consent';

interface GoogleAnalyticsLoaderProps {
  googleAnalyticsId: string | null;
}

function isAnalyticsEnabled(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const raw = getCookieValue(document.cookie, COOKIE_CONSENT_COOKIE_NAME);
  const preferences = parseCookieConsentPreferences(raw);
  return hasValidAnalyticsConsent(preferences);
}

function setGoogleAnalyticsDisabled(id: string, disabled: boolean) {
  (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = disabled;
}

export function GoogleAnalyticsLoader({ googleAnalyticsId }: GoogleAnalyticsLoaderProps) {
  const [enabled, setEnabled] = useState(false);

  const syncAnalyticsConsent = useCallback(() => {
    if (!googleAnalyticsId) {
      setEnabled(false);
      return;
    }

    setEnabled(isAnalyticsEnabled());
  }, [googleAnalyticsId]);

  useEffect(() => {
    syncAnalyticsConsent();
  }, [syncAnalyticsConsent]);
  useWindowEvent(COOKIE_CONSENT_CHANGE_EVENT, syncAnalyticsConsent);

  useEffect(() => {
    if (!googleAnalyticsId) {
      return;
    }
    setGoogleAnalyticsDisabled(googleAnalyticsId, !enabled);
    if (!enabled) {
      clearGoogleAnalyticsCookies(googleAnalyticsId);
    }
  }, [enabled, googleAnalyticsId]);

  if (!googleAnalyticsId || !enabled) {
    return null;
  }

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${googleAnalyticsId}');
        `}
      </Script>
    </>
  );
}
