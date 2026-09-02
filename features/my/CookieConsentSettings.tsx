'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { IconCookie } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Group, Stack, Text } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { Switch } from '@/components/core/Input';
import { notifications } from '@mantine/notifications';
import { Button } from '@/components/core/Button';
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

export function CookieConsentSettings({ initialAnalytics, initialUpdatedAt }: CookieConsentSettingsProps) {
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
      const result = await persistCurrentUserCookieConsentAction({
        analytics,
        source: 'my_settings',
        version: preferences.version,
      });

      if (!result.success) {
        notifications.show({
          title: tSettingsPage('cookiePreferencesTitle'),
          message: result.error ?? t('syncError'),
          color: 'red',
        });
        return;
      }

      if (result.persisted && result.consent?.updated_at) {
        setLastUpdatedAt(result.consent.updated_at);
      }

      notifications.show({
        title: tSettingsPage('cookiePreferencesTitle'),
        message: result.persisted ? t('savedAccount') : t('savedBrowser'),
        color: 'green',
      });
    });
  };

  return (
    <Stack gap="sm" data-testid="my-cookie-consent-section">
      {requiresReview && (
        <Alert tone="warning" data-testid="my-cookie-consent-version-warning">
          {t('versionWarning', { version: COOKIE_CONSENT_VERSION })}
        </Alert>
      )}

      <Alert icon={<IconCookie size={16} />} tone="accent">
        {t('essentialIntro')}
      </Alert>

      <Switch checked disabled label={tCookieConsentCommon('essentialLabel')} />
      <Switch
        checked={analyticsEnabled}
        disabled={controlsDisabled}
        onChange={(event) => setAnalyticsEnabled(event.currentTarget.checked)}
        label={tCookieConsentCommon('analyticsLabel')}
        data-testid="my-cookie-consent-analytics-switch"
      />

      <Group gap="xs">
        <Button
          size="xs"
          tone="neutral"
          emphasis="medium"
          disabled={controlsDisabled}
          onClick={() => saveConsent(false)}
          loading={isPending}
          data-testid="my-cookie-consent-reject"
        >
          {tCommon('rejectNonEssential')}
        </Button>
        <Button
          size="xs"
          disabled={controlsDisabled}
          onClick={() => saveConsent(true)}
          loading={isPending}
          data-testid="my-cookie-consent-accept"
        >
          {tCommon('acceptAll')}
        </Button>
        <Button
          size="xs"
          emphasis="medium"
          disabled={controlsDisabled}
          onClick={() => saveConsent(analyticsEnabled)}
          loading={isPending}
          data-testid="my-cookie-consent-save"
        >
          {tCommon('savePreferences')}
        </Button>
      </Group>

      <Text size="xs" c="dimmed" data-testid="my-cookie-consent-updated-at">
        {t('lastSynced', { value: updatedAtLabel })}
      </Text>
    </Stack>
  );
}
