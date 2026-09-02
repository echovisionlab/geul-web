'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { TranslationProviderType, type TranslationProvider } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { IconChecklist, IconDeviceFloppy, IconEdit, IconPlus, IconSettings2, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Group, Paper, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { Select, Switch, TagsInput } from '@/components/core/Input';
import { ConfirmModal } from '@/components/core/Modal';
import { PageLoader } from '@/features/site/PageLoader';
import { TranslationProviderModal } from '@/features/translation/settings/TranslationProviderModal';
import {
  buildProviderConfig,
  DEFAULT_PROVIDER_FORM,
  providerToForm,
  providerTypeToProto,
  type ProviderFormState,
  validateProviderForm,
} from '@/features/translation/settings/provider-form';
import { createTranslationClient } from '@/lib/api/browser-client';
import { getTranslationActionErrorMessage } from '@/lib/translation/action-error';
import { normalizeProtectedTerms } from '@/lib/translation/protected-terms';

const settingsQueryKey = ['translation-settings'] as const;
const localesQueryKey = ['translation-locales'] as const;
const providersQueryKey = ['translation-providers'] as const;

interface FormState {
  defaultLocale: string;
  protectedTerms: string[];
}

function canonicalizeSettingsForm(form: FormState): FormState {
  return {
    defaultLocale: form.defaultLocale,
    protectedTerms: normalizeProtectedTerms(form.protectedTerms),
  };
}

function settingsFormsEqual(left: FormState, right: FormState): boolean {
  return (
    left.defaultLocale === right.defaultLocale &&
    left.protectedTerms.length === right.protectedTerms.length &&
    left.protectedTerms.every((term, index) => term === right.protectedTerms[index])
  );
}

export default function TranslationSettingsPage() {
  const t = useTranslations('translationSettingsPage');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonActions = useTranslations('common.actions');
  const queryClient = useQueryClient();
  const translationClient = useMemo(() => createTranslationClient(), []);

  const settingsQuery = useQuery({
    queryKey: settingsQueryKey,
    queryFn: async () => translationClient.getTranslationSettings({}),
  });

  const localesQuery = useQuery({
    queryKey: localesQueryKey,
    queryFn: async () => translationClient.listTranslationLocales({}),
  });

  const providersQuery = useQuery({
    queryKey: providersQueryKey,
    queryFn: async () => translationClient.listTranslationProviders({}),
  });

  const [form, setForm] = useState<FormState>({
    defaultLocale: 'en',
    protectedTerms: [],
  });
  const [persistedForm, setPersistedForm] = useState<FormState | null>(null);
  const [providerForm, setProviderForm] = useState<ProviderFormState>(DEFAULT_PROVIDER_FORM);
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<TranslationProvider | null>(null);
  const [deleteProvider, setDeleteProvider] = useState<TranslationProvider | null>(null);

  useEffect(() => {
    const settings = settingsQuery.data?.settings;
    if (!settings) {
      return;
    }
    const nextForm = canonicalizeSettingsForm({
      defaultLocale: settings.defaultLocale,
      protectedTerms: normalizeProtectedTerms(settings.protectedTerms),
    });
    setForm(nextForm);
    setPersistedForm(nextForm);
  }, [settingsQuery.data]);

  const canonicalForm = useMemo(() => canonicalizeSettingsForm(form), [form]);
  const hasSettingsChanges = persistedForm !== null && !settingsFormsEqual(canonicalForm, persistedForm);

  const invalidateProviderState = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: providersQueryKey }),
      queryClient.invalidateQueries({ queryKey: settingsQueryKey }),
      queryClient.invalidateQueries({ queryKey: ['translation-overview'] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async () =>
      translationClient.updateTranslationSettings({
        settings: {
          defaultLocale: canonicalForm.defaultLocale,
          protectedTerms: canonicalForm.protectedTerms,
        },
      }),
    onSuccess: async (result) => {
      const savedForm = canonicalizeSettingsForm({
        defaultLocale: result.settings?.defaultLocale ?? canonicalForm.defaultLocale,
        protectedTerms: result.settings?.protectedTerms ?? canonicalForm.protectedTerms,
      });
      setForm(savedForm);
      setPersistedForm(savedForm);
      notifications.show({
        color: 'green',
        message: t('notifications.saved'),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['translation-overview'] }),
      ]);
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        message: getTranslationActionErrorMessage(error, t('notifications.saveFailed')),
      });
    },
  });

  const createProviderMutation = useMutation({
    mutationFn: async (values: ProviderFormState) =>
      translationClient.createTranslationProvider({
        name: values.name.trim(),
        type: providerTypeToProto(values.type),
        isActive: values.isActive,
        priority: values.priority,
        config: buildProviderConfig(values),
      }),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: t('notifications.providerCreated') });
      setProviderModalOpen(false);
      setProviderForm(DEFAULT_PROVIDER_FORM);
      await invalidateProviderState();
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        message: getTranslationActionErrorMessage(error, t('notifications.providerSaveFailed')),
      });
    },
  });

  const updateProviderMutation = useMutation({
    mutationFn: async (values: ProviderFormState & { id: string }) =>
      translationClient.updateTranslationProvider({
        id: values.id,
        name: values.name.trim(),
        type: providerTypeToProto(values.type),
        isActive: values.isActive,
        priority: values.priority,
        config: buildProviderConfig(values),
      }),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: t('notifications.providerUpdated') });
      setEditingProvider(null);
      setProviderModalOpen(false);
      setProviderForm(DEFAULT_PROVIDER_FORM);
      await invalidateProviderState();
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        message: getTranslationActionErrorMessage(error, t('notifications.providerSaveFailed')),
      });
    },
  });

  const toggleProviderMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      translationClient.updateTranslationProvider({ id, isActive }),
    onSuccess: invalidateProviderState,
    onError: (error) => {
      notifications.show({
        color: 'red',
        message: getTranslationActionErrorMessage(error, t('notifications.providerToggleFailed')),
      });
    },
  });

  const deleteProviderMutation = useMutation({
    mutationFn: async (id: string) => translationClient.deleteTranslationProvider({ id }),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: t('notifications.providerDeleted') });
      setDeleteProvider(null);
      await invalidateProviderState();
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        message: getTranslationActionErrorMessage(error, t('notifications.providerDeleteFailed')),
      });
    },
  });

  const localeOptions = (localesQuery.data?.locales ?? []).map((locale) => ({
    value: locale.code,
    label: `${locale.displayName} (${locale.code})`,
  }));
  const providers = providersQuery.data?.providers ?? [];
  const generationEnabled = settingsQuery.data?.generationEnabled ?? false;

  const openCreateProvider = () => {
    setEditingProvider(null);
    setProviderForm(DEFAULT_PROVIDER_FORM);
    setProviderModalOpen(true);
  };

  const openEditProvider = (provider: TranslationProvider) => {
    setEditingProvider(provider);
    setProviderForm(providerToForm(provider));
    setProviderModalOpen(true);
  };

  const submitProviderForm = () => {
    const validationError = validateProviderForm(providerForm, editingProvider);
    if (validationError) {
      notifications.show({ color: 'red', message: t(`validation.${validationError}`) });
      return;
    }
    if (editingProvider) {
      updateProviderMutation.mutate({ ...providerForm, id: editingProvider.id });
      return;
    }
    createProviderMutation.mutate(providerForm);
  };

  const getProviderTypeLabel = (type: TranslationProviderType) =>
    type === TranslationProviderType.LLM ? t('providerTypes.llm') : t('providerTypes.deepl');

  const isProviderSaving = createProviderMutation.isPending || updateProviderMutation.isPending;

  if (settingsQuery.isLoading || localesQuery.isLoading || providersQuery.isLoading) {
    return <PageLoader />;
  }

  if (settingsQuery.isError || localesQuery.isError || providersQuery.isError) {
    return <Text c="red">{t('states.loadFailed')}</Text>;
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>{t('title')}</Title>
          <Text size="sm" c="dimmed">
            {t('description')}
          </Text>
        </div>
        <Group gap="sm">
          <Button
            component={Link}
            href="/admin/translations"
            tone="neutral"
            emphasis="medium"
            leftSection={<IconSettings2 size={16} />}
          >
            {tCommonLabels('overview')}
          </Button>
          <Button
            component={Link}
            href="/admin/translations/jobs"
            tone="neutral"
            emphasis="medium"
            leftSection={<IconChecklist size={16} />}
          >
            {t('actions.jobs')}
          </Button>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
            disabled={!hasSettingsChanges}
          >
            {t('actions.save')}
          </Button>
        </Group>
      </Group>

      <Paper withBorder p="lg" radius="md">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Title order={4}>{t('sections.providers')}</Title>
              <Text size="sm" c="dimmed">
                {t('sections.providersDescription')}
              </Text>
            </div>
            <Button leftSection={<IconPlus size={16} />} emphasis="medium" onClick={openCreateProvider}>
              {t('actions.addProvider')}
            </Button>
          </Group>

          <Group gap="sm">
            <LabelBadge tone={generationEnabled ? 'positive' : 'danger'}>
              {generationEnabled ? t('generation.enabled') : t('generation.disabled')}
            </LabelBadge>
            {!generationEnabled && settingsQuery.data?.generationDisabledReason && (
              <Text size="sm" c="red">
                {settingsQuery.data.generationDisabledReason}
              </Text>
            )}
          </Group>

          {providers.length === 0 ? (
            <Text size="sm" c="dimmed">
              {t('providerStates.empty')}
            </Text>
          ) : (
            <Stack gap={0}>
              {providers.map((provider, index) => (
                <Stack
                  key={provider.id}
                  gap="xs"
                  py="sm"
                  style={index === 0 ? undefined : { borderTop: '1px solid var(--mantine-color-gray-3)' }}
                >
                  <Group justify="space-between" align="center">
                    <Group gap="sm">
                      <Text fw={600}>{provider.name}</Text>
                      <LabelBadge tone="accent">{getProviderTypeLabel(provider.type)}</LabelBadge>
                      <LabelBadge tone={provider.isActive ? 'positive' : 'neutral'}>
                        {provider.isActive ? t('providerStates.active') : t('providerStates.inactive')}
                      </LabelBadge>
                    </Group>
                    <Group gap="xs">
                      <Switch
                        checked={provider.isActive}
                        onChange={(event) =>
                          toggleProviderMutation.mutate({
                            id: provider.id,
                            isActive: event.currentTarget.checked,
                          })
                        }
                        disabled={toggleProviderMutation.isPending}
                        label={t('fields.providerActive.shortLabel')}
                      />
                      <IconButton
                        aria-label={t('actions.editProvider')}
                        title={t('actions.editProvider')}
                        onClick={() => openEditProvider(provider)}
                      >
                        <IconEdit size={16} />
                      </IconButton>
                      <IconButton
                        aria-label={t('actions.deleteProvider')}
                        title={t('actions.deleteProvider')}
                        tone="danger"
                        onClick={() => setDeleteProvider(provider)}
                      >
                        <IconTrash size={16} />
                      </IconButton>
                    </Group>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {t('providerStates.priority', { priority: provider.priority })}
                    {provider.config.case === 'llmConfig'
                      ? ` · ${provider.config.value.model || t('providerStates.modelUnset')}`
                      : ''}
                    {provider.config.case === 'deeplConfig' && provider.config.value.apiBaseUrl
                      ? ` · ${provider.config.value.apiBaseUrl}`
                      : ''}
                  </Text>
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper withBorder p="lg" radius="md">
        <Stack gap="sm">
          <Title order={4}>{t('sections.runtime')}</Title>
          <Text size="sm" c="dimmed">
            {t('sections.runtimeDescription')}
          </Text>
          <Select
            label={t('fields.defaultLocale.label')}
            description={t('fields.defaultLocale.description')}
            data={localeOptions}
            value={form.defaultLocale}
            onChange={(value) => setForm((current) => ({ ...current, defaultLocale: value ?? current.defaultLocale }))}
            allowDeselect={false}
          />
          <TagsInput
            label={t('fields.protectedTerms.label')}
            description={t('fields.protectedTerms.description')}
            placeholder={t('fields.protectedTerms.placeholder')}
            value={form.protectedTerms}
            splitChars={[',', '\n']}
            onChange={(value) => setForm((current) => ({ ...current, protectedTerms: normalizeProtectedTerms(value) }))}
          />
          <Text size="xs" c="dimmed">
            {t('fields.protectedTerms.examples')}
          </Text>
        </Stack>
      </Paper>

      <TranslationProviderModal
        opened={providerModalOpen}
        editing={editingProvider !== null}
        form={providerForm}
        saving={isProviderSaving}
        onChange={setProviderForm}
        onClose={() => {
          setProviderModalOpen(false);
          setEditingProvider(null);
          setProviderForm(DEFAULT_PROVIDER_FORM);
        }}
        onSubmit={submitProviderForm}
      />

      <ConfirmModal
        opened={deleteProvider !== null}
        onClose={() => setDeleteProvider(null)}
        onConfirm={() => {
          if (deleteProvider) {
            deleteProviderMutation.mutate(deleteProvider.id);
          }
        }}
        title={t('modal.deleteProviderTitle')}
        message={deleteProvider ? t('modal.deleteProviderMessage', { name: deleteProvider.name }) : ''}
        confirmLabel={t('actions.deleteProvider')}
        cancelLabel={tCommonActions('cancel')}
        closeLabel={tCommonActions('close')}
        loading={deleteProviderMutation.isPending}
      />
    </Stack>
  );
}
