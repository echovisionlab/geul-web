'use client';

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  TranslationJobStatus,
  type TranslationEntry,
  type TranslationLocale,
} from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { IconLanguage, IconPlayerPause, IconRefresh, IconSparkles, IconTrash } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Group, Loader, Stack, Text } from '@mantine/core';
import { useMounted } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { badgeToneFromColor, LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { SectionCard } from '@/components/core/Section';
import { TranslationLocaleControl } from '@/features/translation/TranslationLocaleControl';
import { TranslationPanelSectionCard } from '@/features/translation/TranslationPanelSectionCard';
import {
  getTranslationEntryPresenceColor,
  getTranslationEntryPresenceKey,
  getTranslationEntryPresenceLabel,
  getTranslationJobBadgeLabel,
} from '@/features/translation/translation-entry-status';
import {
  selectActiveTranslationJobsByLocale,
  useActiveTranslationJobsByLocale,
} from '@/features/translation/useActiveTranslationJobsByLocale';
import { useEntityTranslationData } from '@/features/translation/useEntityTranslationData';
import { useTranslationLocaleCommands } from '@/features/translation/useTranslationLocaleCommands';
import {
  useSharedTranslationStatusLabel,
  useTranslationLocaleLabels,
} from '@/features/translation/useTranslationPanelLabels';
import {
  isTranslationGenerationUnavailable,
  useTranslationGenerationAvailability,
} from '@/features/translation/useTranslationGenerationAvailability';
import { useOptionalEditorRuntimeContext } from '@/lib/contexts/EditorRuntimeContext';
import { mutateAIDocumentTargetTranslation, type AIDocumentTargetType } from '@/lib/ai/document-client';
import { DEFAULT_LOCALE } from '@/lib/i18n/locale';
import { CONTENT_LANGUAGE_QUERY_PARAM } from '@/lib/translation/content-language';
import {
  getTranslationJobDisplayStatusKey,
  getTranslationJobDisplayStatusTone,
  shouldShowTranslationJobStatusBadge,
} from '@/lib/translation/job-status';
import { toDate } from '@/lib/utils/proto';
import { getTranslationActionErrorMessage } from '@/lib/translation/action-error';
import { buildActiveEditLocaleHref } from './useActiveEditLocale';

type SupportedTranslationEntityType =
  | 'campaign'
  | 'email_template'
  | 'email_layout'
  | 'form'
  | 'page'
  | 'post'
  | 'post_series'
  | 'program_event'
  | 'release'
  | 'work'
  | 'artist'
  | 'label'
  | 'menu'
  | 'privacy'
  | 'terms';

interface EntityTranslationsPanelProps {
  entityType: SupportedTranslationEntityType;
  entityId: string;
  canManage?: boolean;
  canAdministerTranslations?: boolean;
  canMutateTargets?: boolean;
  collapsible?: boolean;
}

const aiTargetTypeByTranslationEntity: Record<SupportedTranslationEntityType, AIDocumentTargetType> = {
  artist: 'artist',
  campaign: 'campaign',
  email_layout: 'email-layout',
  email_template: 'email-template',
  form: 'form',
  label: 'label',
  menu: 'menu',
  page: 'page',
  post: 'post',
  post_series: 'post-series',
  program_event: 'program-event',
  release: 'release',
  work: 'work',
  privacy: 'privacy',
  terms: 'terms',
};

export function EntityTranslationsPanel({
  entityType,
  entityId,
  canManage = true,
  canAdministerTranslations = canManage,
  canMutateTargets = canManage,
  collapsible = true,
}: EntityTranslationsPanelProps) {
  const t = useTranslations('translationPanel');
  const tCommonActions = useTranslations('common.actions');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonStatuses = useTranslations('common.statuses');
  const tCommonStates = useTranslations('common.states');
  const tCommonNotifications = useTranslations('common.notifications');
  const tJobs = useTranslations('translationJobsPage');
  const translationEntryPresenceLabels = {
    existing: t('statuses.existing'),
    missing: t('statuses.missing'),
  };
  const translationJobStatusLabels = {
    unknown: tCommonStates('unknown'),
  };
  const dateTime = useDateTimeFormatter();
  const hydrated = useMounted();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const runtimeContext = useOptionalEditorRuntimeContext();
  const getSharedStatusLabel = useSharedTranslationStatusLabel();

  const { translationClient, target, localesQuery, entriesQuery, jobsQuery, refreshEntries, refreshJobs } =
    useEntityTranslationData({ entityType, entityId, jobsEnabled: canManage });
  const generationAvailabilityQuery = useTranslationGenerationAvailability(canManage && canAdministerTranslations);

  const areEntriesReady = hydrated && (entriesQuery.isFetchedAfterMount || !entriesQuery.isFetching);
  const translationEntries = areEntriesReady ? (entriesQuery.data?.entries ?? []) : [];
  const sourceLocale = areEntriesReady ? (entriesQuery.data?.sourceLocale ?? DEFAULT_LOCALE) : undefined;

  const entryByLocale = useMemo(() => {
    const map = new Map<string, TranslationEntry>();
    for (const entry of translationEntries) {
      map.set(entry.locale, entry);
    }
    return map;
  }, [translationEntries]);
  const activeJobByLocale = useActiveTranslationJobsByLocale({
    enabled: canManage,
    entityType,
    entityId,
    jobs: jobsQuery.data?.jobs,
    onLifecycleHint: async () => {
      await refreshEntries();
      await refreshJobs();
    },
    onReconnect: async () => {
      await refreshEntries();
      await refreshJobs();
    },
  });
  const activeJobRecordByLocale = useMemo(
    () => selectActiveTranslationJobsByLocale(jobsQuery.data?.jobs),
    [jobsQuery.data?.jobs],
  );
  const cancelJob = useMutation({
    mutationFn: async (jobId: string) => translationClient.cancelTranslationJob({ jobId }),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: tJobs('notifications.cancelled') });
      await refreshJobs();
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        message: getTranslationActionErrorMessage(error, tJobs('notifications.cancelFailed')),
      });
    },
  });
  const localeDefinitions = localesQuery.data ?? [];
  const eligibleTargetLocales = useMemo(
    () => localeDefinitions.map((definition) => definition.code).filter((code) => code !== sourceLocale),
    [localeDefinitions, sourceLocale],
  );
  const { getLocaleDisplayLabel, localeOptions } = useTranslationLocaleLabels(sourceLocale, localeDefinitions);
  const translationStatusSummary = useMemo(() => {
    const summary = {
      queued: 0,
      running: 0,
    };

    if (!areEntriesReady || !sourceLocale) {
      return summary;
    }

    for (const definition of localeDefinitions) {
      if (definition.code === sourceLocale) {
        continue;
      }

      const activeJob = activeJobByLocale.get(definition.code);
      if (!activeJob || !shouldShowTranslationJobStatusBadge(activeJob.status)) {
        continue;
      }

      const jobStatusKey = getTranslationJobDisplayStatusKey(activeJob.status);
      switch (jobStatusKey) {
        case 'queued':
          summary.queued += 1;
          break;
        case 'running':
          summary.running += 1;
          break;
        default:
          break;
      }
    }

    return summary;
  }, [activeJobByLocale, areEntriesReady, localeDefinitions, sourceLocale]);

  const { setSourceLocale, regenerateTranslations, openSourceLocaleConfirm } = useTranslationLocaleCommands({
    client: translationClient,
    target,
    sourceLocale,
    getLocaleDisplayLabel,
    refreshEntries,
    refreshJobs,
    beforeRegenerate: async () => {
      if (runtimeContext && runtimeContext.entityType === entityType && runtimeContext.entityId === entityId) {
        await runtimeContext.persistNow();
      }
    },
    getBlockRoomSnapshot: runtimeContext?.getBlockRoomSnapshot,
    afterSourceChange: (nextLocale) => {
      if (pathname) {
        router.replace(buildActiveEditLocaleHref(pathname, searchParams, nextLocale));
      }
    },
    messages: {
      sourceUpdated: t('notifications.sourceLocaleUpdated'),
      sourceUpdateFailed: t('notifications.sourceLocaleUpdateFailed'),
      regenerateFailed: t('notifications.regenerateFailed'),
      sourceConfirmTitle: t('sourceLocale.confirm.title'),
      sourceConfirmCancel: tCommonActions('cancel'),
      sourceConfirmAction: t('sourceLocale.confirm.confirm'),
      sourceConfirmDescription: t('sourceLocale.confirm.description'),
      sourceConfirmDetail: (localeLabel) => t('sourceLocale.confirm.detail', { locale: localeLabel }),
      regenerateSuccess: (locales) => {
        if (locales.length === 1) {
          return t('notifications.localeQueued');
        }
        return t('notifications.allQueued');
      },
    },
  });

  const handleEditOpen = (localeCode: string) => {
    if (!pathname) {
      return;
    }
    const href = buildActiveEditLocaleHref(pathname, searchParams, localeCode);
    router.replace(href, { scroll: false });
  };
  const createMissingTarget = useMutation({
    mutationFn: async (localeCode: string) => {
      if (!canMutateTargets) {
        throw new Error('Missing target creation is unavailable.');
      }
      await mutateAIDocumentTargetTranslation({
        target: { type: aiTargetTypeByTranslationEntity[entityType], id: entityId, locale: localeCode },
        action: 'create',
      });
    },
    onSuccess: async (_result, localeCode) => {
      await refreshEntries();
      handleEditOpen(localeCode);
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        message: getTranslationActionErrorMessage(error, tCommonNotifications('updateFailed')),
      });
    },
  });
  const deleteTarget = useMutation({
    mutationFn: async (localeCode: string) => {
      if (!canMutateTargets) {
        throw new Error('Target translation deletion is unavailable.');
      }
      await mutateAIDocumentTargetTranslation({
        target: { type: aiTargetTypeByTranslationEntity[entityType], id: entityId, locale: localeCode },
        action: 'delete',
      });
    },
    onSuccess: async (_result, localeCode) => {
      await refreshEntries();
      const requestedLocale = searchParams.get(CONTENT_LANGUAGE_QUERY_PARAM);
      if (requestedLocale === localeCode && sourceLocale) {
        handleEditOpen(sourceLocale);
      }
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        message: getTranslationActionErrorMessage(error, tCommonNotifications('updateFailed')),
      });
    },
  });

  const openDeleteTargetConfirm = (localeCode: string) => {
    modals.openConfirmModal({
      title: tCommonActions('delete'),
      labels: { cancel: tCommonActions('cancel'), confirm: tCommonActions('delete') },
      confirmProps: { color: 'red' },
      children: <Text size="sm">{getLocaleDisplayLabel(localeCode)}</Text>,
      onConfirm: () => deleteTarget.mutate(localeCode),
    });
  };

  if (!canManage) {
    return null;
  }

  const isLoading = !hydrated || localesQuery.isLoading || entriesQuery.isLoading || !areEntriesReady;
  const hasError = localesQuery.error || entriesQuery.error;
  const generationUnavailable = isTranslationGenerationUnavailable(generationAvailabilityQuery);
  const headerActionsReady = hydrated && !isLoading && !hasError;
  return (
    <TranslationPanelSectionCard
      title={tCommonEntities('translations')}
      description={t('description')}
      expandLabel={t('actions.expand')}
      collapseLabel={t('actions.collapse')}
      collapsible={collapsible}
      toggleId="entity-translations-panel-toggle"
      persistentActions={
        headerActionsReady && canAdministerTranslations ? (
          <Button
            id="entity-translations-panel-regenerate-all"
            size="xs"
            emphasis="medium"
            leftSection={<IconSparkles size={14} />}
            onClick={() => regenerateTranslations.mutate(eligibleTargetLocales)}
            loading={regenerateTranslations.isPending}
            disabled={generationUnavailable || !sourceLocale || eligibleTargetLocales.length === 0}
          >
            {t('actions.regenerateAll')}
          </Button>
        ) : null
      }
    >
      <Stack gap="md">
        {isLoading ? (
          <Group justify="center" py="md">
            <Loader size="sm" />
          </Group>
        ) : hasError ? (
          <Text c="red" size="sm">
            {getTranslationActionErrorMessage(localesQuery.error ?? entriesQuery.error, t('states.loadFailed'))}
          </Text>
        ) : (
          <Stack gap="md">
            {canAdministerTranslations ? (
              <TranslationLocaleControl
                variant="native-select"
                label={t('sourceLocale.label')}
                description={t('sourceLocale.description')}
                value={sourceLocale ?? ''}
                options={localeOptions}
                sourceLocale={sourceLocale}
                onChange={(locale) => {
                  if (setSourceLocale.isPending) {
                    return;
                  }
                  openSourceLocaleConfirm(locale);
                }}
                leftSection={<IconLanguage size={16} />}
                disabled={setSourceLocale.isPending}
              />
            ) : null}

            <Stack gap="sm">
              {translationStatusSummary.queued > 0 || translationStatusSummary.running > 0 ? (
                <Group gap="xs" wrap="wrap">
                  {translationStatusSummary.queued > 0 ? (
                    <LabelBadge tone={getTranslationJobDisplayStatusTone(TranslationJobStatus.QUEUED)}>
                      {tCommonStatuses('queued')} {translationStatusSummary.queued}
                    </LabelBadge>
                  ) : null}
                  {translationStatusSummary.running > 0 ? (
                    <LabelBadge tone={getTranslationJobDisplayStatusTone(TranslationJobStatus.RUNNING)}>
                      {tCommonStatuses('running')} {translationStatusSummary.running}
                    </LabelBadge>
                  ) : null}
                </Group>
              ) : null}

              {localeDefinitions.map((definition: TranslationLocale) => {
                const entry = entryByLocale.get(definition.code);
                const activeJob = activeJobByLocale.get(definition.code);
                const activeJobRecord = activeJobRecordByLocale.get(definition.code);
                const presenceKey = getTranslationEntryPresenceKey(entry);
                const updatedAtValue = entry?.updatedAt ? toDate(entry.updatedAt) : undefined;
                const updatedAt = updatedAtValue ? dateTime.dateTime(updatedAtValue) : null;
                const hasActiveJob = activeJobRecord != null;
                const canCancelJob = activeJobRecord != null;
                const canAuthorTarget = canMutateTargets;
                const targetActionId = canAuthorTarget ? 'edit' : 'preview';

                return (
                  <SectionCard key={definition.code} p="sm">
                    <Stack gap="sm">
                      <Group justify="space-between" align="flex-start" wrap="wrap">
                        <Stack gap={4}>
                          <Group gap="xs" wrap="wrap">
                            <Text fw={600} size="sm">
                              {getLocaleDisplayLabel(definition.code)}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {definition.code}
                            </Text>
                            {definition.code !== sourceLocale ? (
                              <LabelBadge tone={badgeToneFromColor(getTranslationEntryPresenceColor(presenceKey))}>
                                {getTranslationEntryPresenceLabel(presenceKey, translationEntryPresenceLabels)}
                              </LabelBadge>
                            ) : null}
                            {activeJob &&
                            definition.code !== sourceLocale &&
                            shouldShowTranslationJobStatusBadge(activeJob.status) ? (
                              <LabelBadge tone={getTranslationJobDisplayStatusTone(activeJob.status)}>
                                {(() => {
                                  const jobStatusKey = getTranslationJobDisplayStatusKey(activeJob.status);
                                  return getTranslationJobBadgeLabel(
                                    jobStatusKey,
                                    getSharedStatusLabel,
                                    translationJobStatusLabels,
                                  );
                                })()}
                              </LabelBadge>
                            ) : null}
                          </Group>
                          <Text size="xs" c="dimmed">
                            {definition.code === sourceLocale
                              ? t('states.sourceEditorHint')
                              : updatedAt
                                ? t('states.updatedAt', { date: updatedAt })
                                : t('states.missingTarget')}
                          </Text>
                        </Stack>

                        <Group gap="xs">
                          {definition.code !== sourceLocale ? (
                            <>
                              <Button
                                id={`entity-translations-panel-${targetActionId}-${definition.code}`}
                                size="xs"
                                emphasis="low"
                                onClick={() => {
                                  if (entry || !canMutateTargets) {
                                    handleEditOpen(definition.code);
                                    return;
                                  }
                                  createMissingTarget.mutate(definition.code);
                                }}
                                loading={
                                  createMissingTarget.isPending && createMissingTarget.variables === definition.code
                                }
                                disabled={createMissingTarget.isPending}
                              >
                                {canAuthorTarget ? tCommonActions('edit') : tCommonLabels('preview')}
                              </Button>
                              {entry && canMutateTargets ? (
                                <Button
                                  id={`entity-translations-panel-delete-${definition.code}`}
                                  size="xs"
                                  tone="danger"
                                  emphasis="low"
                                  leftSection={<IconTrash size={14} />}
                                  onClick={() => openDeleteTargetConfirm(definition.code)}
                                  loading={deleteTarget.isPending && deleteTarget.variables === definition.code}
                                  disabled={deleteTarget.isPending}
                                >
                                  {tCommonActions('delete')}
                                </Button>
                              ) : null}
                              {canAdministerTranslations ? (
                                <>
                                  {canCancelJob ? (
                                    <Button
                                      id={`entity-translations-panel-cancel-${definition.code}`}
                                      size="xs"
                                      tone="danger"
                                      emphasis="low"
                                      leftSection={<IconPlayerPause size={14} />}
                                      onClick={() => cancelJob.mutate(activeJobRecord.id)}
                                      loading={cancelJob.isPending && cancelJob.variables === activeJobRecord.id}
                                    >
                                      {tCommonActions('cancel')}
                                    </Button>
                                  ) : null}
                                  <Button
                                    id={`entity-translations-panel-regenerate-${definition.code}`}
                                    size="xs"
                                    emphasis="medium"
                                    aria-label={t(
                                      presenceKey === 'missing'
                                        ? 'actions.generateLocaleAria'
                                        : 'actions.regenerateLocaleAria',
                                      { locale: getLocaleDisplayLabel(definition.code) },
                                    )}
                                    leftSection={
                                      presenceKey === 'missing' ? <IconSparkles size={14} /> : <IconRefresh size={14} />
                                    }
                                    onClick={() => regenerateTranslations.mutate([definition.code])}
                                    loading={
                                      regenerateTranslations.isPending &&
                                      regenerateTranslations.variables?.[0] === definition.code
                                    }
                                    disabled={generationUnavailable || hasActiveJob}
                                  >
                                    {t(
                                      presenceKey === 'missing' ? 'actions.generateLocale' : 'actions.regenerateLocale',
                                    )}
                                  </Button>
                                </>
                              ) : null}
                            </>
                          ) : null}
                        </Group>
                      </Group>
                    </Stack>
                  </SectionCard>
                );
              })}
            </Stack>
          </Stack>
        )}
      </Stack>
    </TranslationPanelSectionCard>
  );
}
