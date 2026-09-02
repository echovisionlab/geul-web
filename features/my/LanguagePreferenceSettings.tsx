'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconCheck, IconLanguage } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { Select } from '@/components/core/Input';
import { updatePreferredLocaleAction } from '@/lib/actions/user-preference';
import { DEFAULT_LOCALE, getSupportedLocaleOptions, normalizeLocale, type SupportedLocale } from '@/lib/i18n/locale';
import { writeLocaleCookie } from '@/lib/i18n/locale-cookie';

interface LanguagePreferenceSettingsProps {
  initialLocale: string | null;
}

export function LanguagePreferenceSettings({ initialLocale }: LanguagePreferenceSettingsProps) {
  const router = useRouter();
  const t = useTranslations('settings.languagePreference');
  const initialValue = normalizeLocale(initialLocale) ?? DEFAULT_LOCALE;
  const [savedLocale, setSavedLocale] = useState<SupportedLocale>(initialValue);
  const [selectedLocale, setSelectedLocale] = useState<string | null>(initialValue);

  const updateLocaleMutation = useMutation({
    mutationFn: async () => updatePreferredLocaleAction(selectedLocale ?? DEFAULT_LOCALE),
    onSuccess: (result) => {
      if (result.success && result.preferred_locale) {
        const nextLocale = result.preferred_locale as SupportedLocale;
        setSavedLocale(nextLocale);
        setSelectedLocale(nextLocale);
        writeLocaleCookie(nextLocale);
        notifications.show({
          title: t('successTitle'),
          message: t('successMessage'),
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        startTransition(() => {
          router.refresh();
        });
        return;
      }

      notifications.show({
        title: t('errorTitle'),
        message: result.error ?? t('errorMessage'),
        color: 'red',
      });
    },
  });

  return (
    <Stack gap="md">
      <Alert icon={<IconLanguage size={16} />} tone="accent">
        {t('intro')}
      </Alert>

      <Select
        label={t('label')}
        data={getSupportedLocaleOptions()}
        value={selectedLocale}
        onChange={setSelectedLocale}
        allowDeselect={false}
        searchable={false}
      />

      <Button
        onClick={() => updateLocaleMutation.mutate()}
        loading={updateLocaleMutation.isPending}
        disabled={!selectedLocale || selectedLocale === savedLocale}
      >
        {t('save')}
      </Button>

      <Text size="sm" c="dimmed">
        {t('helper')}
      </Text>
    </Stack>
  );
}
