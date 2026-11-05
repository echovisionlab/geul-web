'use client';

import { formatLocaleCode } from '@/components/core/Typography/locale-code';
import { Text as DsText } from '@/components/core/Typography';
import { PageHeader } from '@/components/core/PageHeader';
import { SettingsSection } from '@/components/core/Section';
import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';

import { useEffect, useMemo, useRef, useState } from 'react';

import { IconDeviceFloppy, IconSettings2 } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
import { Button, SaveButton } from '@/components/core/Button';
import { Select } from '@/components/core/Input';

import { PageLoader } from '@/features/site/PageLoader';
import { createTranslationClient } from '@/lib/api/browser/secure-translation';
import { getTranslationActionErrorMessage } from '@/lib/translation/action-error';
import {
  buildSettingsUpdateMutation,
  mergeRefreshedSettingsForm,
  preserveSettingsEditsMadeDuringSave,
  settingsFormsEqual,
  toUpdateSettingsRequest,
  type FormState,
  type SettingsUpdateMutation,
} from './settings-form';

const settingsQueryKey = ['translation-settings'] as const;
const localesQueryKey = ['translation-locales'] as const;

export type TranslationSettingsPageClient = Pick<
  ReturnType<typeof createTranslationClient>,
  'getTranslationSettings' | 'listTranslationLocales' | 'updateTranslationSettings'
>;

export function TranslationSettingsPage({ client }: { client?: TranslationSettingsPageClient } = {}) {
  const t = useTranslations('translationSettingsPage');
  const tCommonLabels = useTranslations('common.labels');
  const queryClient = useQueryClient();
  const translationClient = useMemo(() => client ?? createTranslationClient(), [client]);

  const settingsQuery = useQuery({
    queryKey: settingsQueryKey,
    queryFn: async () => translationClient.getTranslationSettings({}),
  });

  const localesQuery = useQuery({
    queryKey: localesQueryKey,
    queryFn: async () => translationClient.listTranslationLocales({}),
  });

  const [form, setForm] = useState<FormState>({ defaultLocale: 'en' });
  const [persistedForm, setPersistedForm] = useState<FormState | null>(null);
  const formRef = useRef(form);
  const persistedFormRef = useRef<FormState | null>(null);

  useEffect(() => {
    const settings = settingsQuery.data?.settings;
    if (!settings) {
      return;
    }
    const nextForm = { defaultLocale: settings.defaultLocale };
    const mergedForm = mergeRefreshedSettingsForm(formRef.current, persistedFormRef.current, nextForm);
    formRef.current = mergedForm;
    setForm(mergedForm);
    persistedFormRef.current = nextForm;
    setPersistedForm(nextForm);
  }, [settingsQuery.data]);

  const updateSettingsForm = (update: (current: FormState) => FormState) => {
    const nextForm = update(formRef.current);
    formRef.current = nextForm;
    setForm(nextForm);
  };

  const hasSettingsChanges = persistedForm !== null && !settingsFormsEqual(form, persistedForm);

  const saveMutation = useMutation({
    mutationFn: async (mutation: SettingsUpdateMutation) =>
      translationClient.updateTranslationSettings(toUpdateSettingsRequest(mutation)),
    onSuccess: async (result, mutation) => {
      const savedForm = { defaultLocale: result.settings?.defaultLocale ?? mutation.form.defaultLocale };
      const nextForm = preserveSettingsEditsMadeDuringSave(formRef.current, mutation.form, savedForm);
      formRef.current = nextForm;
      setForm(nextForm);
      persistedFormRef.current = savedForm;
      setPersistedForm(savedForm);
      notifications.show({
        tone: 'positive',
        message: t('notifications.saved'),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['translation-overview'] }),
      ]);
    },
    onError: (error) => {
      notifications.show({
        tone: 'danger',
        message: getTranslationActionErrorMessage(error, t('notifications.saveFailed')),
      });
    },
  });

  const localeOptions = (localesQuery.data?.locales ?? []).map((locale) => ({
    value: locale.code,
    label: `${locale.displayName} (${formatLocaleCode(locale.code)})`,
  }));

  if (settingsQuery.isLoading || localesQuery.isLoading) {
    return <PageLoader />;
  }

  if (settingsQuery.isError || localesQuery.isError) {
    return (
      <DsText role="alert" size="sm" tone="danger">
        {t('states.loadFailed')}
      </DsText>
    );
  }

  return (
    <DsLayoutStack gap="lg">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <DsLayoutInline gap="sm">
            <Button
              href="/admin/translations"
              tone="neutral"
              emphasis="medium"
              leftSection={<IconSettings2 size={16} />}
            >
              {tCommonLabels('overview')}
            </Button>
            <SaveButton
              type="button"
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={() => {
                const baseline = persistedFormRef.current;
                if (!baseline) {
                  return;
                }
                const mutation = buildSettingsUpdateMutation(baseline, form);
                if (mutation) {
                  saveMutation.mutate(mutation);
                }
              }}
              loading={saveMutation.isPending}
              disabled={!hasSettingsChanges}
            >
              {t('actions.save')}
            </SaveButton>
          </DsLayoutInline>
        }
      />

      <SettingsSection title={t('sections.runtime')} description={t('sections.runtimeDescription')}>
        <Select
          label={t('fields.defaultLocale.label')}
          description={t('fields.defaultLocale.description')}
          data={localeOptions}
          value={form.defaultLocale}
          onChange={(value) =>
            updateSettingsForm((current) => ({ ...current, defaultLocale: value ?? current.defaultLocale }))
          }
          allowDeselect={false}
        />
      </SettingsSection>
    </DsLayoutStack>
  );
}

export default function Page() {
  return <TranslationSettingsPage />;
}
