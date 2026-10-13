'use client';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { IconCookie } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { Alert } from '@/components/core/Alert';
import { Switch } from '@/components/core/Input';
import { notifications } from '@/components/core/Notification';
import { TextButton } from '@/components/core/TextButton';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { persistCurrentUserCookieConsentAction } from '@/lib/actions/cookie-consent';
import {
  buildCookieConsentPreferences,
  COOKIE_CONSENT_CHANGE_EVENT,
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  COOKIE_CONSENT_VERSION,
  getCookieValue,
  isCookieConsentCurrent,
  parseCookieConsentPreferences,
  serializeCookieConsentPreferences,
  type CookieConsentPreferences,
} from '@/lib/cookie-consent';

interface CookieConsentSettingsProps {
  initialAnalytics: boolean | null;
  persistAction?: typeof persistCurrentUserCookieConsentAction;
  initialUpdatedAt: string | null;
}

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

export function CookieConsentSettings({
  initialAnalytics,
  initialUpdatedAt,
  persistAction = persistCurrentUserCookieConsentAction,
}: CookieConsentSettingsProps) {
  const t = useTranslations('settings.cookieConsent');
  const tSettingsPage = useTranslations('settings.page');
  const tCookieConsentCommon = useTranslations('cookieConsentCommon');
  const tCommon = useTranslations('common.actions');
  const dateTime = useDateTimeFormatter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [requiresReview, setRequiresReview] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(initialAnalytics ?? false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(initialUpdatedAt);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const cookieConsent = readConsentFromCookie();
    if (cookieConsent) {
      setAnalyticsEnabled(cookieConsent.analytics);
      setRequiresReview(!isCookieConsentCurrent(cookieConsent));
      return;
    }

    if (typeof initialAnalytics === 'boolean') {
      const preferences = buildCookieConsentPreferences(initialAnalytics);
      writeConsentCookie(preferences);
      emitConsentChange(preferences);
      setAnalyticsEnabled(initialAnalytics);
      setRequiresReview(false);
    }
  }, [initialAnalytics]);

  const updatedAtLabel = useMemo(() => {
    if (!lastUpdatedAt) {
      return t('noRecord');
    }
    const date = new Date(lastUpdatedAt);
    return Number.isNaN(date.getTime())
      ? t('noRecord')
      : dateTime.dateTime(date, { dateStyle: 'medium', timeStyle: 'short' });
  }, [dateTime, lastUpdatedAt, t]);
  const controlsDisabled = !isHydrated || isPending;

  const saveConsent = (analytics: boolean) => {
    const preferences = buildCookieConsentPreferences(analytics);
    writeConsentCookie(preferences);
    emitConsentChange(preferences);
    setAnalyticsEnabled(analytics);
    setRequiresReview(false);

    startTransition(async () => {
      const result = await persistAction({
        analytics,
        source: 'my_settings',
        version: preferences.version,
      });

      if (!result.success) {
        notifications.show({
          title: tSettingsPage('cookiePreferencesTitle'),
          message: result.error ?? t('syncError'),
          tone: 'danger',
        });
        return;
      }

      if (result.persisted && result.consent?.updated_at) {
        setLastUpdatedAt(result.consent.updated_at);
      }

      notifications.show({
        title: tSettingsPage('cookiePreferencesTitle'),
        message: result.persisted ? t('savedAccount') : t('savedBrowser'),
        tone: 'positive',
      });
    });
  };

  return (
    <DsLayoutStack gap="sm" data-testid="my-cookie-consent-section">
      {requiresReview && (
        <Alert tone="warning" data-testid="my-cookie-consent-version-warning">
          {t('versionWarning', { version: COOKIE_CONSENT_VERSION })}
        </Alert>
      )}

      <Alert icon={<IconCookie size={16} />}>{t('essentialIntro')}</Alert>

      <Switch
        checked={analyticsEnabled}
        disabled={controlsDisabled}
        onChange={(event) => setAnalyticsEnabled(event.currentTarget.checked)}
        label={tCookieConsentCommon('analyticsLabel')}
        data-testid="my-cookie-consent-analytics-switch"
      />

      <DsLayoutInline gap="action-group" justify="end">
        <TextButton
          size="xs"
          controlSize="xs"
          density="chrome"

          disabled={controlsDisabled}
          onClick={() => saveConsent(false)}
          data-testid="my-cookie-consent-reject"
        >
          {tCommon('rejectNonEssential')}
        </TextButton>
        <TextButton
          size="xs"
          controlSize="xs"
          density="chrome"

          disabled={controlsDisabled}
          onClick={() => saveConsent(analyticsEnabled)}
          data-testid="my-cookie-consent-save"
        >
          {tCommon('savePreferences')}
        </TextButton>
      </DsLayoutInline>

      <DsText size="xs" tone="secondary" data-testid="my-cookie-consent-updated-at">
        {t('lastSynced', { value: updatedAtLabel })}
      </DsText>
    </DsLayoutStack>
  );
}
