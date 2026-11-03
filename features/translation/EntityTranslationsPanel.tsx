'use client';

import { PageLoader } from '@/features/site/PageLoader';
import { SupportingText, Text as DsText } from '@/components/core/Typography';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  TranslationJobStatus,
  type TranslationEntry,
  type TranslationLocale,
} from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { IconEye, IconPencil, IconPlayerPause, IconRefresh, IconSparkles, IconTrash } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { useMounted } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { confirmationDialogs } from '@/features/confirmation';
import { LabelBadge } from '@/components/core/Badge';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { ToolbarCommand } from '@/components/core/Section';
import { Field } from '@/components/core/Field';
import { TranslationLocaleRow } from './TranslationLocaleRow';
import { TranslationLocaleControl } from '@/features/translation/TranslationLocaleControl';
import { TranslationPanelSectionCard } from '@/features/translation/TranslationPanelSectionCard';
import {
  getTranslationEntryPresenceKey,
  getTranslationJobBadgeLabel,
} from '@/features/translation/translation-entry-status';
import { useActiveTranslationJobsByLocale } from '@/features/translation/useActiveTranslationJobsByLocale';
import { selectActiveTranslationJobsByLocale } from './translation-job-polling';
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
import { createTranslationSaveBarriers } from './translation-save-barriers';
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
import { useOptionalTranslationServices } from './TranslationServicesContext';
import { useTranslationActionFocus } from './useTranslationActionFocus';

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
  const translationJobStatusLabels = {
    unknown: tCommonStates('unknown'),
  };
  const dateTime = useDateTimeFormatter();
  const hydrated = useMounted();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const runtimeContext = useOptionalEditorRuntimeContext();
  const services = useOptionalTranslationServices();
  const { commandRef, rememberCommand } = useTranslationActionFocus();
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
      notifications.show({ tone: 'positive', message: tJobs('notifications.cancelled') });
      await refreshJobs();
    },
    onError: (error) => {
      notifications.show({
        tone: 'danger',
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
    ...createTranslationSaveBarriers({ entityType, entityId, runtimeContext }),
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
    if (services?.openLocale) {
      services.openLocale(localeCode);
      return;
    }
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
      await (services?.mutateTarget ?? mutateAIDocumentTargetTranslation)({
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
        tone: 'danger',
        message: getTranslationActionErrorMessage(error, tCommonNotifications('updateFailed')),
      });
    },
  });
  const deleteTarget = useMutation({
    mutationFn: async (localeCode: string) => {
      if (!canMutateTargets) {
        throw new Error('Target translation deletion is unavailable.');
      }
      await (services?.mutateTarget ?? mutateAIDocumentTargetTranslation)({
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
        tone: 'danger',
        message: getTranslationActionErrorMessage(error, tCommonNotifications('updateFailed')),
      });
    },
  });

  const openDeleteTargetConfirm = (localeCode: string) => {
    confirmationDialogs.open({
      title: tCommonActions('delete'),
      cancelLabel: tCommonActions('cancel'),
      confirmLabel: tCommonActions('delete'),
      closeLabel: tCommonActions('cancel'),
      intent: 'delete',
      message: <DsText size="sm">{getLocaleDisplayLabel(localeCode)}</DsText>,
      onConfirm: async () => {
        await deleteTarget.mutateAsync(localeCode);
      },
    });
  };

  if (!canManage) {
    return null;
  }

  const isLoading =
    !hydrated || localesQuery.isLoading || entriesQuery.isLoading || jobsQuery.isLoading || !areEntriesReady;
  const hasError = localesQuery.error || entriesQuery.error || (jobsQuery.error && !jobsQuery.data);
  const secondaryError = jobsQuery.error || (canAdministerTranslations && generationAvailabilityQuery.error);
  const generationUnavailable =
    isTranslationGenerationUnavailable(generationAvailabilityQuery) || Boolean(jobsQuery.error);
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
          <ToolbarCommand
            presentation="icon"
            label={t('actions.regenerateAll')}
            id="entity-translations-panel-regenerate-all"
            ref={commandRef('all')}
            emphasis="medium"
            icon={<IconSparkles size="1em" />}
            onClick={(event) => {
              rememberCommand(event.currentTarget, 'all');
              regenerateTranslations.mutate(eligibleTargetLocales);
            }}
            loading={regenerateTranslations.isPending}
            disabled={generationUnavailable || !sourceLocale || eligibleTargetLocales.length === 0}
          />
        ) : null
      }
    >
      <DsLayoutStack gap="md">
        {isLoading ? (
          <PageLoader placement="flow" extent="compact" size="sm" />
        ) : hasError ? (
          <SupportingText tone="danger" role="alert">
            {getTranslationActionErrorMessage(
              localesQuery.error ?? entriesQuery.error ?? jobsQuery.error ?? generationAvailabilityQuery.error,
              t('states.loadFailed'),
            )}
          </SupportingText>
        ) : (
          <DsLayoutStack gap="md">
            {secondaryError ? (
              <SupportingText tone="danger" role="alert">
                {getTranslationActionErrorMessage(secondaryError, t('states.loadFailed'))}
              </SupportingText>
            ) : null}
            <Field layout="inline" label={t('sourceLocale.label')} description={t('sourceLocale.description')}>
              <TranslationLocaleControl
                variant="native-select"
                value={sourceLocale ?? ''}
                options={localeOptions}
                sourceLocale={sourceLocale}
                onChange={(locale) => {
                  if (!canAdministerTranslations || setSourceLocale.isPending) {
                    return;
                  }
                  openSourceLocaleConfirm(locale);
                }}
                density="compact"
                readOnly={!canAdministerTranslations}
                disabled={setSourceLocale.isPending}
              />
            </Field>

            <DsLayoutStack gap="sm">
              {translationStatusSummary.queued > 0 || translationStatusSummary.running > 0 ? (
                <DsLayoutInline gap="xs" wrap="wrap">
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
                </DsLayoutInline>
              ) : null}

              {localeDefinitions
                .filter((definition: TranslationLocale) => definition.code !== sourceLocale)
                .map((definition: TranslationLocale) => {
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
                    <TranslationLocaleRow
                      key={definition.code}
                      announceChanges
                      name={getLocaleDisplayLabel(definition.code)}
                      code={definition.code}
                      description={
                        definition.code === sourceLocale
                          ? t('states.sourceEditorHint')
                          : updatedAt
                            ? t('states.updatedAt', { date: updatedAt })
                            : entry
                              ? null
                              : t('states.missingTarget')
                      }
                      actionsLabel={`${tCommonLabels('actions')}: ${getLocaleDisplayLabel(definition.code)}`}
                      badges={
                        <>
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
                        </>
                      }
                      actions={
                        definition.code !== sourceLocale ? (
                          <>
                            <ToolbarCommand
                              id={`entity-translations-panel-${targetActionId}-${definition.code}`}
                              presentation="icon"
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
                              label={canAuthorTarget ? tCommonActions('edit') : tCommonLabels('preview')}
                              aria-label={`${canAuthorTarget ? tCommonActions('edit') : tCommonLabels('preview')}: ${getLocaleDisplayLabel(definition.code)}`}
                              icon={canAuthorTarget ? <IconPencil size="1em" /> : <IconEye size="1em" />}
                            />
                            {entry && canMutateTargets ? (
                              <ToolbarCommand
                                id={`entity-translations-panel-delete-${definition.code}`}
                                presentation="icon"
                                tone="danger"
                                emphasis="low"
                                icon={<IconTrash size="1em" />}
                                onClick={() => openDeleteTargetConfirm(definition.code)}
                                loading={deleteTarget.isPending && deleteTarget.variables === definition.code}
                                disabled={deleteTarget.isPending}
                                label={tCommonActions('delete')}
                                aria-label={`${tCommonActions('delete')}: ${getLocaleDisplayLabel(definition.code)}`}
                              />
                            ) : null}
                            {canAdministerTranslations ? (
                              <>
                                {canCancelJob ? (
                                  <ToolbarCommand
                                    id={`entity-translations-panel-cancel-${definition.code}`}
                                    ref={commandRef(`cancel-${definition.code}`)}
                                    presentation="icon"
                                    tone="danger"
                                    emphasis="low"
                                    icon={<IconPlayerPause size="1em" />}
                                    onClick={(event) => {
                                      rememberCommand(
                                        event.currentTarget,
                                        `generate-${definition.code}`,
                                        `cancel-${definition.code}`,
                                      );
                                      cancelJob.mutate(activeJobRecord.id);
                                    }}
                                    loading={cancelJob.isPending && cancelJob.variables === activeJobRecord.id}
                                    label={tCommonActions('cancel')}
                                    aria-label={`${tCommonActions('cancel')}: ${getLocaleDisplayLabel(definition.code)}`}
                                  />
                                ) : null}
                                <ToolbarCommand
                                  id={`entity-translations-panel-regenerate-${definition.code}`}
                                  ref={commandRef(`generate-${definition.code}`)}
                                  presentation="icon"
                                  emphasis="medium"
                                  aria-label={t(
                                    presenceKey === 'missing'
                                      ? 'actions.generateLocaleAria'
                                      : 'actions.regenerateLocaleAria',
                                    { locale: getLocaleDisplayLabel(definition.code) },
                                  )}
                                  icon={
                                    presenceKey === 'missing' ? <IconSparkles size="1em" /> : <IconRefresh size="1em" />
                                  }
                                  onClick={(event) => {
                                    rememberCommand(
                                      event.currentTarget,
                                      `generate-${definition.code}`,
                                      `cancel-${definition.code}`,
                                    );
                                    regenerateTranslations.mutate([definition.code]);
                                  }}
                                  loading={
                                    regenerateTranslations.isPending &&
                                    regenerateTranslations.variables?.[0] === definition.code
                                  }
                                  disabled={generationUnavailable || hasActiveJob}
                                  label={t(
                                    presenceKey === 'missing' ? 'actions.generateLocale' : 'actions.regenerateLocale',
                                  )}
                                />
                              </>
                            ) : null}
                          </>
                        ) : null
                      }
                    />
                  );
                })}
            </DsLayoutStack>
          </DsLayoutStack>
        )}
      </DsLayoutStack>
    </TranslationPanelSectionCard>
  );
}
