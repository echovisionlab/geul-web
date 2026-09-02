'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useWindowEvent } from '@mantine/hooks';
import { useSession } from '@/lib/auth/client';
import {
  buildCookieConsentPreferences,
  COOKIE_CONSENT_CHANGE_EVENT,
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  COOKIE_CONSENT_OPEN_EVENT,
  COOKIE_CONSENT_VERSION,
  getCookieValue,
  isCookieConsentCurrent,
  parseCookieConsentPreferences,
  serializeCookieConsentPreferences,
  type CookieConsentPreferences,
} from '@/lib/cookie-consent';
import {
  CookieConsentBannerView,
  type CookieConsentBannerViewModel,
  type CookieConsentLearnMoreSegment,
} from './ui/CookieConsentBannerView';

function readConsentFromCookie(): CookieConsentPreferences | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const raw = getCookieValue(document.cookie, COOKIE_CONSENT_COOKIE_NAME);
  return parseCookieConsentPreferences(raw);
}

function writeConsentCookie(preferences: CookieConsentPreferences) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const value = serializeCookieConsentPreferences(preferences);

  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${value}; Path=/; Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

function emitConsentChange(preferences: CookieConsentPreferences) {
  window.dispatchEvent(
    new CustomEvent(COOKIE_CONSENT_CHANGE_EVENT, {
      detail: preferences,
    }),
  );
}

async function fetchCurrentUserConsent(): Promise<CookieConsentPreferences | null> {
  try {
    const response = await fetch('/api/cookie-consent', {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as {
      success?: boolean;
      consent?: {
        essential?: boolean;
        analytics?: boolean;
        version?: number;
        updated_at?: string | null;
      } | null;
    };
    const consent = body.consent;

    if (!body.success || !consent) {
      return null;
    }
    if (consent.essential !== true || typeof consent.analytics !== 'boolean') {
      return null;
    }

    return {
      version:
        typeof consent.version === 'number' && Number.isFinite(consent.version)
          ? Math.max(0, Math.trunc(consent.version))
          : COOKIE_CONSENT_VERSION,
      essential: true,
      analytics: consent.analytics,
      updatedAt:
        typeof consent.updated_at === 'string' && consent.updated_at.length > 0
          ? consent.updated_at
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function syncConsentToAccount(analytics: boolean, version: number, source: string) {
  try {
    await fetch('/api/cookie-consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        analytics,
        version,
        source,
      }),
      credentials: 'include',
    });
  } catch {
    // Cookie-level consent still applies even when account sync fails.
  }
}

function parseLearnMoreSegments(message: string): CookieConsentLearnMoreSegment[] {
  const segments: CookieConsentLearnMoreSegment[] = [];
  const linkPattern = /<(privacy|terms)>(.*?)<\/\1>/g;
  let offset = 0;
  let match = linkPattern.exec(message);

  while (match) {
    if (match.index > offset) {
      segments.push({ text: message.slice(offset, match.index) });
    }
    segments.push({
      text: match[2] ?? '',
      href: match[1] === 'privacy' ? '/privacy' : '/terms',
    });
    offset = match.index + match[0].length;
    match = linkPattern.exec(message);
  }

  if (offset < message.length) {
    segments.push({ text: message.slice(offset) });
  }

  return segments.length > 0 ? segments : [{ text: message }];
}

export function CookieConsentBanner() {
  const t = useTranslations('cookieConsentBanner');
  const tCookieConsentCommon = useTranslations('cookieConsentCommon');
  const tCommon = useTranslations('common.actions');
  const pathname = usePathname();
  const { data: session, isPending: isSessionPending } = useSession();
  const [isHydrated, setIsHydrated] = useState(false);
  const [isBannerOpen, setIsBannerOpen] = useState(false);
  const [requiresRenewal, setRequiresRenewal] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [, startTransition] = useTransition();

  const syncFromCookie = useCallback(() => {
    const consent = readConsentFromCookie();
    if (consent) {
      const currentConsent = isCookieConsentCurrent(consent);
      setRequiresRenewal(!currentConsent);
      setAnalyticsEnabled(consent.analytics);
      setShowPreferences(!currentConsent);
      setIsBannerOpen(!currentConsent);
    } else {
      if (isSessionPending || session?.user?.id) {
        return;
      }
      setRequiresRenewal(false);
      setAnalyticsEnabled(false);
      setShowPreferences(false);
      setIsBannerOpen(true);
    }
  }, [isSessionPending, session?.user?.id]);

  useEffect(() => {
    syncFromCookie();
    setIsHydrated(true);
  }, [syncFromCookie]);
  useWindowEvent(COOKIE_CONSENT_CHANGE_EVENT, syncFromCookie);

  useEffect(() => {
    if (isSessionPending || !session?.user?.id) {
      return;
    }
    if (readConsentFromCookie()) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const preferences = await fetchCurrentUserConsent();
      if (cancelled || !preferences) {
        if (!cancelled) {
          setRequiresRenewal(false);
          setAnalyticsEnabled(false);
          setShowPreferences(false);
          setIsBannerOpen(true);
        }
        return;
      }
      writeConsentCookie(preferences);
      emitConsentChange(preferences);
    })();

    return () => {
      cancelled = true;
    };
  }, [isSessionPending, session?.user?.id]);

  useWindowEvent(COOKIE_CONSENT_OPEN_EVENT, () => {
    setIsBannerOpen(true);
    setShowPreferences(true);
  });

  const saveConsent = (analytics: boolean) => {
    const preferences = buildCookieConsentPreferences(analytics);
    writeConsentCookie(preferences);
    emitConsentChange(preferences);
    setRequiresRenewal(false);
    setAnalyticsEnabled(analytics);
    setShowPreferences(false);
    setIsBannerOpen(false);

    if (session?.user?.id) {
      startTransition(() => {
        void syncConsentToAccount(analytics, preferences.version, 'banner');
      });
    }
  };

  const isAccountFlow =
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/verify' ||
    pathname.startsWith('/account/');

  if (!isHydrated || pathname === '/my/settings' || isAccountFlow) {
    return null;
  }

  const rawLearnMore = t.raw('learnMore');
  const model: CookieConsentBannerViewModel = {
    isOpen: isBannerOpen,
    requiresRenewal,
    showPreferences,
    analyticsEnabled,
    labels: {
      renewalNotice: t('renewalNotice'),
      intro: t('intro'),
      rejectNonEssential: tCommon('rejectNonEssential'),
      hidePreferences: t('actions.hidePreferences'),
      customize: t('actions.customize'),
      acceptAll: tCommon('acceptAll'),
      essential: tCookieConsentCommon('essentialLabel'),
      analytics: tCookieConsentCommon('analyticsLabel'),
      savePreferences: tCommon('savePreferences'),
    },
    learnMore: parseLearnMoreSegments(typeof rawLearnMore === 'string' ? rawLearnMore : ''),
  };

  return (
    <CookieConsentBannerView
      model={model}
      onRejectNonEssential={() => saveConsent(false)}
      onTogglePreferences={() => setShowPreferences((value) => !value)}
      onAcceptAll={() => saveConsent(true)}
      onAnalyticsChange={setAnalyticsEnabled}
      onSavePreferences={() => saveConsent(analyticsEnabled)}
    />
  );
}
