'use client';

import { PageLoader } from '@/features/site/PageLoader';
import { SupportingText, Text as DsText } from '@/components/core/Typography';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type TranslationEntry, type TranslationLocale } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { IconEye, IconPencil, IconTrash } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { useMounted } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { confirmationDialogs } from '@/features/confirmation';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { ToolbarCommand } from '@/components/core/Section';
import { Field } from '@/components/core/Field';
import { TranslationLocaleRow } from './TranslationLocaleRow';
import { TranslationLocaleControl } from '@/features/translation/TranslationLocaleControl';
import { TranslationPanelSectionCard } from '@/features/translation/TranslationPanelSectionCard';
import { useEntityTranslationData } from '@/features/translation/useEntityTranslationData';
import { useTranslationLocaleCommands } from '@/features/translation/useTranslationLocaleCommands';
import { useTranslationLocaleLabels } from '@/features/translation/useTranslationPanelLabels';
import { useOptionalEditorRuntimeContext } from '@/lib/contexts/EditorRuntimeContext';
import { createTranslationSaveBarriers } from './translation-save-barriers';
import { mutateAIDocumentTargetTranslation, type AIDocumentTargetType } from '@/lib/ai/document-client';
import { DEFAULT_LOCALE } from '@/lib/i18n/locale';
import { CONTENT_LANGUAGE_QUERY_PARAM } from '@/lib/translation/content-language';
import { toDate } from '@/lib/utils/proto';
import { getTranslationActionErrorMessage } from '@/lib/translation/action-error';
import { buildActiveEditLocaleHref } from './useActiveEditLocale';
import { useOptionalTranslationServices } from './TranslationServicesContext';

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
  const tCommonNotifications = useTranslations('common.notifications');
  const dateTime = useDateTimeFormatter();
  const hydrated = useMounted();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const runtimeContext = useOptionalEditorRuntimeContext();
  const services = useOptionalTranslationServices();

  const { translationClient, target, localesQuery, entriesQuery, refreshEntries } = useEntityTranslationData({
    entityType,
    entityId,
  });

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
  const localeDefinitions = localesQuery.data ?? [];
  const { getLocaleDisplayLabel, localeOptions } = useTranslationLocaleLabels(sourceLocale, localeDefinitions);
  const { setSourceLocale, openSourceLocaleConfirm } = useTranslationLocaleCommands({
    client: translationClient,
    target,
    sourceLocale,
    getLocaleDisplayLabel,
    refreshEntries,
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
      sourceConfirmTitle: t('sourceLocale.confirm.title'),
      sourceConfirmCancel: tCommonActions('cancel'),
      sourceConfirmAction: t('sourceLocale.confirm.confirm'),
      sourceConfirmDescription: t('sourceLocale.confirm.description'),
      sourceConfirmDetail: (localeLabel) => t('sourceLocale.confirm.detail', { locale: localeLabel }),
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

  const isLoading = !hydrated || localesQuery.isLoading || entriesQuery.isLoading || !areEntriesReady;
  const hasError = localesQuery.error || entriesQuery.error;
  return (
    <TranslationPanelSectionCard
      title={tCommonEntities('translations')}
      description={t('description')}
      expandLabel={t('actions.expand')}
      collapseLabel={t('actions.collapse')}
      collapsible={collapsible}
      toggleId="entity-translations-panel-toggle"
    >
      <DsLayoutStack gap="md">
        {isLoading ? (
          <PageLoader placement="flow" extent="compact" size="sm" />
        ) : hasError ? (
          <SupportingText tone="danger" role="alert">
            {getTranslationActionErrorMessage(localesQuery.error ?? entriesQuery.error, t('states.loadFailed'))}
          </SupportingText>
        ) : (
          <DsLayoutStack gap="md">
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
              {localeDefinitions
                .filter((definition: TranslationLocale) => definition.code !== sourceLocale)
                .map((definition: TranslationLocale) => {
                  const entry = entryByLocale.get(definition.code);
                  const updatedAtValue = entry?.updatedAt ? toDate(entry.updatedAt) : undefined;
                  const updatedAt = updatedAtValue ? dateTime.dateTime(updatedAtValue) : null;
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
