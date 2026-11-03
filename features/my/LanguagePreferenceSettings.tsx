'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconCheck } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
import { SaveButton } from '@/components/core/Button';
import { Select } from '@/components/core/Input';
import { updatePreferredLocaleAction } from '@/lib/actions/user-preference';
import { DEFAULT_LOCALE, getSupportedLocaleOptions, normalizeLocale, type SupportedLocale } from '@/lib/i18n/locale';
import { writeLocaleCookie } from '@/lib/i18n/locale-cookie';

interface LanguagePreferenceSettingsProps {
  initialLocale: string | null;
  updateAction?: typeof updatePreferredLocaleAction;
  refresh?: () => void;
}

export function LanguagePreferenceSettings({
  initialLocale,
  updateAction = updatePreferredLocaleAction,
  refresh,
}: LanguagePreferenceSettingsProps) {
  const router = useRouter();
  const t = useTranslations('settings.languagePreference');
  const tNotifications = useTranslations('common.notifications');
  const initialValue = normalizeLocale(initialLocale) ?? DEFAULT_LOCALE;
  const [savedLocale, setSavedLocale] = useState<SupportedLocale>(initialValue);
  const [selectedLocale, setSelectedLocale] = useState<string | null>(initialValue);

  const updateLocaleMutation = useMutation({
    mutationFn: async () => updateAction(selectedLocale ?? DEFAULT_LOCALE),
    onError: () => {
      notifications.show({ title: t('errorTitle'), message: t('errorMessage'), tone: 'danger' });
    },
    onSuccess: (result) => {
      if (result.success && result.preferred_locale) {
        const nextLocale = result.preferred_locale as SupportedLocale;
        setSavedLocale(nextLocale);
        setSelectedLocale(nextLocale);
        writeLocaleCookie(nextLocale);
        notifications.show({
          message: tNotifications('saveSuccess'),
          tone: 'positive',
          icon: <IconCheck size={16} />,
        });
        startTransition(() => {
          (refresh ?? router.refresh)();
        });
        return;
      }

      notifications.show({
        title: t('errorTitle'),
        message: result.error ?? t('errorMessage'),
        tone: 'danger',
      });
    },
  });

  return (
    <DsLayoutStack gap="md">
      <Select
        label={t('label')}
        data={getSupportedLocaleOptions()}
        value={selectedLocale}
        onChange={setSelectedLocale}
        allowDeselect={false}
        searchable={false}
        disabled={updateLocaleMutation.isPending}
      />

      <SaveButton
        type="button"
        onClick={() => updateLocaleMutation.mutate()}
        loading={updateLocaleMutation.isPending}
        disabled={!selectedLocale || selectedLocale === savedLocale}
      >
        {t('save')}
      </SaveButton>
    </DsLayoutStack>
  );
}
