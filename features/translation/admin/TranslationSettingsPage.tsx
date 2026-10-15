'use client';

import { formatLocaleCode } from '@/components/core/Typography/locale-code';
import { SupportingText, Text as DsText, Heading as DsHeading } from '@/components/core/Typography';
import { ConfirmationDialog } from '@/features/confirmation';

import { SectionCard as DsSectionCard } from '@/components/core/Section/SectionCard';
import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';

import { useEffect, useMemo, useRef, useState } from 'react';

import { TranslationProviderType, type TranslationProvider } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { IconChecklist, IconDeviceFloppy, IconEdit, IconPlus, IconSettings2, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { Select, Switch, TagsInput } from '@/components/core/Input';

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
import { createTranslationClient } from '@/lib/api/browser/secure-translation';
import { getTranslationActionErrorMessage } from '@/lib/translation/action-error';
import { normalizeProtectedTerms } from '@/lib/translation/protected-terms';

const settingsQueryKey = ['translation-settings'] as const;
const localesQueryKey = ['translation-locales'] as const;
const providersQueryKey = ['translation-providers'] as const;

interface FormState {
  defaultLocale: string;
  protectedTerms: string[];
}

type SettingsUpdatePath = 'default_locale' | 'protected_terms';

interface SettingsUpdateMutation {
  form: FormState;
  baseline: FormState;
  paths: SettingsUpdatePath[];
}

function canonicalizeSettingsForm(form: FormState): FormState {
  return {
    defaultLocale: form.defaultLocale,
    protectedTerms: normalizeProtectedTerms(form.protectedTerms),
  };
}

function settingsFormsEqual(left: FormState, right: FormState): boolean {
  return left.defaultLocale === right.defaultLocale && protectedTermsEqual(left.protectedTerms, right.protectedTerms);
}

function protectedTermsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((term, index) => term === right[index]);
}

function mergeRefreshedSettingsForm(local: FormState, baseline: FormState | null, incoming: FormState): FormState {
  if (!baseline) {
    return incoming;
  }
  return {
    defaultLocale: incoming.defaultLocale !== baseline.defaultLocale ? incoming.defaultLocale : local.defaultLocale,
    protectedTerms: protectedTermsEqual(incoming.protectedTerms, baseline.protectedTerms)
      ? local.protectedTerms
      : incoming.protectedTerms,
  };
}

function preserveSettingsEditsMadeDuringSave(current: FormState, submitted: FormState, saved: FormState): FormState {
  return {
    defaultLocale: current.defaultLocale === submitted.defaultLocale ? saved.defaultLocale : current.defaultLocale,
    protectedTerms: protectedTermsEqual(current.protectedTerms, submitted.protectedTerms)
      ? saved.protectedTerms
      : current.protectedTerms,
  };
}

export function buildSettingsUpdateMutation(baseline: FormState, form: FormState): SettingsUpdateMutation | null {
  const paths: SettingsUpdatePath[] = [];
  if (baseline.defaultLocale !== form.defaultLocale) {
    paths.push('default_locale');
  }
  if (!protectedTermsEqual(baseline.protectedTerms, form.protectedTerms)) {
    paths.push('protected_terms');
  }
  return paths.length > 0 ? { form, baseline, paths } : null;
}

export type TranslationSettingsPageClient = Pick<
  ReturnType<typeof createTranslationClient>,
  | 'getTranslationSettings'
  | 'listTranslationLocales'
  | 'listTranslationProviders'
  | 'updateTranslationSettings'
  | 'createTranslationProvider'
  | 'updateTranslationProvider'
  | 'deleteTranslationProvider'
>;

export function TranslationSettingsPage({ client }: { client?: TranslationSettingsPageClient } = {}) {
  const t = useTranslations('translationSettingsPage');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonActions = useTranslations('common.actions');
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

  const providersQuery = useQuery({
    queryKey: providersQueryKey,
    queryFn: async () => translationClient.listTranslationProviders({}),
  });

  const [form, setForm] = useState<FormState>({
    defaultLocale: 'en',
    protectedTerms: [],
  });
  const [persistedForm, setPersistedForm] = useState<FormState | null>(null);
  const formRef = useRef(form);
  const persistedFormRef = useRef<FormState | null>(null);
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
    const mergedForm = mergeRefreshedSettingsForm(formRef.current, persistedFormRef.current, nextForm);
    formRef.current = mergedForm;
    setForm(mergedForm);
    persistedFormRef.current = nextForm;
    setPersistedForm(nextForm);
  }, [settingsQuery.data]);

  const updateSettingsForm = (update: (current: FormState) => FormState) => {
    const nextForm = canonicalizeSettingsForm(update(formRef.current));
    formRef.current = nextForm;
    setForm(nextForm);
  };

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
    mutationFn: async (mutation: SettingsUpdateMutation) =>
      translationClient.updateTranslationSettings({
        settings: {
          defaultLocale: mutation.paths.includes('default_locale') ? mutation.form.defaultLocale : '',
          protectedTerms: mutation.paths.includes('protected_terms') ? mutation.form.protectedTerms : [],
        },
        updateMask: { paths: mutation.paths },
        baseSettings: {
          defaultLocale: mutation.baseline.defaultLocale,
          protectedTerms: mutation.baseline.protectedTerms,
        },
      }),
    onSuccess: async (result, mutation) => {
      const savedForm = canonicalizeSettingsForm({
        defaultLocale: result.settings?.defaultLocale ?? mutation.form.defaultLocale,
        protectedTerms: result.settings?.protectedTerms ?? mutation.form.protectedTerms,
      });
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
      notifications.show({ tone: 'positive', message: t('notifications.providerCreated') });
      setProviderModalOpen(false);
      setProviderForm(DEFAULT_PROVIDER_FORM);
      await invalidateProviderState();
    },
    onError: (error) => {
      notifications.show({
        tone: 'danger',
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
      notifications.show({ tone: 'positive', message: t('notifications.providerUpdated') });
      setEditingProvider(null);
      setProviderModalOpen(false);
      setProviderForm(DEFAULT_PROVIDER_FORM);
      await invalidateProviderState();
    },
    onError: (error) => {
      notifications.show({
        tone: 'danger',
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
        tone: 'danger',
        message: getTranslationActionErrorMessage(error, t('notifications.providerToggleFailed')),
      });
    },
  });

  const deleteProviderMutation = useMutation({
    mutationFn: async (id: string) => translationClient.deleteTranslationProvider({ id }),
    onSuccess: async () => {
      notifications.show({ tone: 'positive', message: t('notifications.providerDeleted') });
      setDeleteProvider(null);
      await invalidateProviderState();
    },
    onError: (error) => {
      notifications.show({
        tone: 'danger',
        message: getTranslationActionErrorMessage(error, t('notifications.providerDeleteFailed')),
      });
    },
  });

  const localeOptions = (localesQuery.data?.locales ?? []).map((locale) => ({
    value: locale.code,
    label: `${locale.displayName} (${formatLocaleCode(locale.code)})`,
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
      notifications.show({ tone: 'danger', message: t(`validation.${validationError}`) });
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
    return (
      <DsText role="alert" size="sm" tone="danger">
        {t('states.loadFailed')}
      </DsText>
    );
  }

  return (
    <DsLayoutStack gap="md">
      <DsLayoutInline justify="between" align="start">
        <div>
          <DsHeading level={2}>{t('title')}</DsHeading>
          <SupportingText tone="secondary">{t('description')}</SupportingText>
        </div>
        <DsLayoutInline gap="sm">
          <Button href="/admin/translations" tone="neutral" emphasis="medium" leftSection={<IconSettings2 size={16} />}>
            {tCommonLabels('overview')}
          </Button>
          <Button
            href="/admin/translations/jobs"
            tone="neutral"
            emphasis="medium"
            leftSection={<IconChecklist size={16} />}
          >
            {t('actions.jobs')}
          </Button>
          <Button
            emphasis="medium"
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={() => {
              const baseline = persistedFormRef.current;
              if (!baseline) {
                return;
              }
              const mutation = buildSettingsUpdateMutation(baseline, canonicalForm);
              if (mutation) {
                saveMutation.mutate(mutation);
              }
            }}
            loading={saveMutation.isPending}
            disabled={!hasSettingsChanges}
          >
            {t('actions.save')}
          </Button>
        </DsLayoutInline>
      </DsLayoutInline>

      <DsSectionCard padding="lg">
        <DsLayoutStack gap="md">
          <DsLayoutInline justify="between" align="start">
            <div>
              <DsHeading level={3} scale={4}>
                {t('sections.providers')}
              </DsHeading>
              <SupportingText tone="secondary">{t('sections.providersDescription')}</SupportingText>
            </div>
            <Button leftSection={<IconPlus size={16} />} emphasis="medium" onClick={openCreateProvider}>
              {t('actions.addProvider')}
            </Button>
          </DsLayoutInline>

          <DsLayoutInline gap="sm">
            <LabelBadge tone={generationEnabled ? 'positive' : 'neutral'}>
              {generationEnabled ? t('generation.enabled') : t('generation.disabled')}
            </LabelBadge>
            {!generationEnabled && settingsQuery.data?.generationDisabledReason && (
              <SupportingText tone="secondary">{settingsQuery.data.generationDisabledReason}</SupportingText>
            )}
          </DsLayoutInline>

          {providers.length === 0 ? (
            <SupportingText tone="secondary">{t('providerStates.empty')}</SupportingText>
          ) : (
            <DsLayoutStack gap="lg">
              {providers.map((provider) => (
                <DsLayoutStack key={provider.id} gap="xs" role="group" aria-label={provider.name}>
                  <DsLayoutInline justify="between" align="center">
                    <DsLayoutInline gap="sm">
                      <DsText size="sm" weight="strong">
                        {provider.name}
                      </DsText>
                      <LabelBadge tone="neutral">{getProviderTypeLabel(provider.type)}</LabelBadge>
                      <LabelBadge tone={provider.isActive ? 'positive' : 'neutral'}>
                        {provider.isActive ? t('providerStates.active') : t('providerStates.inactive')}
                      </LabelBadge>
                    </DsLayoutInline>
                    <DsLayoutInline gap="xs">
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
                        aria-label={`${t('fields.providerActive.shortLabel')} ${provider.name}`}
                      />
                      <IconButton
                        emphasis="medium"
                        aria-label={`${t('actions.editProvider')} ${provider.name}`}
                        title={t('actions.editProvider')}
                        onClick={() => openEditProvider(provider)}
                      >
                        <IconEdit size={16} />
                      </IconButton>
                      <IconButton
                        aria-label={`${t('actions.deleteProvider')} ${provider.name}`}
                        title={t('actions.deleteProvider')}
                        tone="danger"
                        onClick={() => setDeleteProvider(provider)}
                      >
                        <IconTrash size={16} />
                      </IconButton>
                    </DsLayoutInline>
                  </DsLayoutInline>
                  <DsText size="sm" tone="secondary">
                    {t('providerStates.priority', { priority: provider.priority })}
                    {provider.config.case === 'llmConfig'
                      ? ` · ${provider.config.value.model || t('providerStates.modelUnset')}`
                      : ''}
                    {provider.config.case === 'deeplConfig' && provider.config.value.apiBaseUrl
                      ? ` · ${provider.config.value.apiBaseUrl}`
                      : ''}
                  </DsText>
                </DsLayoutStack>
              ))}
            </DsLayoutStack>
          )}
        </DsLayoutStack>
      </DsSectionCard>

      <DsSectionCard padding="lg">
        <DsLayoutStack gap="sm">
          <DsHeading level={3} scale={4}>
            {t('sections.runtime')}
          </DsHeading>
          <SupportingText tone="secondary">{t('sections.runtimeDescription')}</SupportingText>
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
          <TagsInput
            label={t('fields.protectedTerms.label')}
            description={t('fields.protectedTerms.description')}
            placeholder={t('fields.protectedTerms.placeholder')}
            value={form.protectedTerms}
            splitChars={[',', '\n']}
            onChange={(value) =>
              updateSettingsForm((current) => ({ ...current, protectedTerms: normalizeProtectedTerms(value) }))
            }
          />
          <DsText size="xs" tone="secondary">
            {t('fields.protectedTerms.examples')}
          </DsText>
        </DsLayoutStack>
      </DsSectionCard>

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

      <ConfirmationDialog
        intent="delete"
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
    </DsLayoutStack>
  );
}

export default function Page() {
  return <TranslationSettingsPage />;
}
