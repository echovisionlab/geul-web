'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { IconAlertCircle, IconCalendar, IconDownload, IconPlayerPlay, IconRefresh, IconX } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Box, Divider, Group, Modal, Stack, Text, Title } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { SegmentedControl } from '@/components/core/Input';
import { DateTimePicker } from '@mantine/dates';
import { useDebouncedCallback, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { materializeLocalizedRichTextDocument } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { Button } from '@/components/core/Button';
import { EditorHeader, type EditorHeaderActionItem } from '@/features/editor/EditorHeader';
import { LegalOgImagePanel } from '@/features/policy/LegalOgImagePanel';
import { LegalRichTextContent } from '@/features/policy/LegalRichTextContent';
import { LegalTranslationNotice } from '@/features/policy/LegalTranslationNotice';
import { materializeLocalizedRichTextTree } from '@/features/editor/contract/localized-rich-text';
import { PolicyEditor, type PolicyEditorInstance } from '@/features/policy/PolicyEditor/PolicyEditor';
import { policyTiptapDocumentToHtml } from '@/features/editor/tiptap/profiles/PolicyTiptapEditor';
import { useLegalPolicyCommands } from '@/features/policy/useLegalPolicyCommands';
import type { LegalPolicyEditorData, LegalPolicyEditorStrategy } from '@/features/policy/legal-policy-types';
import { ShareLinkSection } from '@/features/share/ShareLinkSection';
import { EditorActiveLocaleMenu } from '@/features/translation/EditorActiveLocaleMenu';
import { EntityTranslationsPanel } from '@/features/translation/EntityTranslationsPanel';
import { useLocaleDocumentSession } from '@/features/translation/useLocaleDocumentSession';
import { persistCollaborativeDocumentNow } from '@/lib/collab/persist-now';
import { BlockRoomMetadataError, updateBlockRoomLocaleMetadata } from '@/lib/collab/block-room-metadata';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import { useRichTextBlockRoomController } from '@/features/editor/hooks/useBlockRoomTiptapController';
import { useBlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';
import type { OgGenerationLookupSignal } from '@/lib/types/og-generation';
import type { SiteSettingsView } from '@/lib/types/site-setting/config';

function getEffectiveDateDisplay(
  status: string,
  fallbackLabel: string,
  isDraft: (status: string) => boolean,
  formatDate: (date: Date) => string,
  effectiveFrom?: Date | null,
): string {
  if (isDraft(status)) {
    return fallbackLabel;
  }
  return effectiveFrom ? formatDate(effectiveFrom) : fallbackLabel;
}

interface Props {
  initialPolicy: LegalPolicyEditorData;
  siteSettings: SiteSettingsView | null;
  ogBackgroundUrl: string | null;
  contactEmail: string | null;
  strategy: LegalPolicyEditorStrategy;
  canEdit: boolean;
}

export function LegalPolicyEditor({
  initialPolicy,
  siteSettings,
  ogBackgroundUrl,
  contactEmail,
  strategy,
  canEdit,
}: Props) {
  const router = useRouter();
  const dateTime = useDateTimeFormatter();
  const t = useTranslations(strategy.translationNamespace);
  const tLegalEditorCommon = useTranslations('legalEditorCommon');
  const tActions = useTranslations('common.actions');
  const tCommonEntities = useTranslations('common.entities');
  const tLabels = useTranslations('common.labels');
  const tCommonMessages = useTranslations('common.messages');
  const tCommonNotifications = useTranslations('common.notifications');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const tCommonStates = useTranslations('common.states');
  const tStatuses = useTranslations('common.statuses');
  const policyId = initialPolicy.id;

  const policyData = initialPolicy;
  const isEditable =
    canEdit && (strategy.status.isEditable(policyData.status) || strategy.status.isArchived(policyData.status));
  const [viewMode, setViewMode] = useState<string>(() => (isEditable ? 'edit' : 'preview'));
  const [title, setTitle] = useState<string>(initialPolicy.title);
  const [effectiveFrom, setEffectiveFrom] = useState<Date | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [policyEditorError, setPolicyEditorError] = useState<string | null>(null);
  const [sourceTitleGeneration, setSourceTitleGeneration] = useState<OgGenerationLookupSignal | null>(null);
  const sourceTitleGenerationSequenceRef = useRef(0);
  const editorRef = useRef<PolicyEditorInstance | null>(null);
  const documentType = strategy.entityType === 'terms' ? 'terms-history' : 'privacy-history';
  const [scheduleModalOpened, { open: openScheduleModal, close: closeScheduleModal }] = useDisclosure(false);
  const [activateModalOpened, { open: openActivateModal, close: closeActivateModal }] = useDisclosure(false);
  const [cancelModalOpened, { open: openCancelModal, close: closeCancelModal }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);

  const localeSession = useLocaleDocumentSession({
    entityType: strategy.entityType,
    entityId: policyId,
    sourceTitle: title,
    sourceSummary: '',
  });
  const { activeEditLocale, roomLocale } = localeSession;
  const isEditingTranslation = activeEditLocale.isControlVisible && !activeEditLocale.isSourceLocale;
  const localeMode = localeSession.mode;
  const blockRoom = useBlockRoomConnection(documentType, policyId, roomLocale);
  const blockRoomController = useRichTextBlockRoomController(documentType, blockRoom.doc, roomLocale);
  const currentProvider = blockRoom.provider;
  const currentIsConnected = blockRoom.isConnected;
  const currentIsSynced = blockRoom.isSynced;
  const editorSession =
    currentProvider && blockRoomController ? { provider: currentProvider, controller: blockRoomController } : null;
  const [residentTitle, setResidentTitle] = useState(initialPolicy.title);
  useEffect(() => {
    const projectedTitle =
      blockRoom.bootstrap?.sourceMetadata?.locale === roomLocale ? blockRoom.bootstrap.sourceMetadata.title : undefined;
    setResidentTitle(projectedTitle ?? activeEditLocale.displayTitle);
  }, [activeEditLocale.displayTitle, blockRoom.bootstrap?.sourceMetadata, roomLocale]);
  const displayedTitle = roomLocale ? residentTitle : activeEditLocale.displayTitle;
  useEffect(() => {
    setTitle(policyData.title);
  }, [policyData]);

  useEffect(() => {
    setPreviewHtml('');
    setPolicyEditorError(null);
  }, [activeEditLocale.activeLocale]);

  useEffect(() => {
    if (!isEditable) {
      setViewMode('preview');
    }
  }, [isEditable]);

  const flushActiveDocuments = useCallback(async () => {
    await persistCollaborativeDocumentNow(blockRoom.provider);
  }, [blockRoom.provider]);

  const updateTitleMetadata = useMutation({
    mutationFn: (value: string) => {
      if (!blockRoom.bootstrap || !blockRoom.protocol || !roomLocale) {
        throw new Error('Policy Block room is not ready.');
      }
      return updateBlockRoomLocaleMetadata(blockRoom.protocol, {
        type: documentType,
        locale: roomLocale,
        title: value,
      });
    },
    onSuccess: blockRoom.acceptEpochAck,
    onError: (error) => {
      if (error instanceof BlockRoomMetadataError && error.reloadRequired) {
        blockRoom.reloadCanonical();
      }
      notifications.show({
        message: error instanceof Error ? error.message : tCommonNotifications('updateFailed'),
        color: 'red',
      });
    },
  });
  const debouncedTitleUpdate = useDebouncedCallback((value: string) => updateTitleMetadata.mutate(value), 500);

  const { scheduleMutation, cancelScheduleMutation, activateNowMutation, deleteMutation, regenerateHtmlMutation } =
    useLegalPolicyCommands({
      policyId,
      policyStatus: policyData.status,
      strategy,
      flushActiveDocuments,
      closeScheduleModal,
      closeCancelModal,
      closeActivateModal,
      clearEffectiveFrom: () => setEffectiveFrom(null),
      messages: {
        scheduled: tLegalEditorCommon('notifications.scheduled'),
        scheduleFailed: tLegalEditorCommon('notifications.scheduleFailed'),
        scheduleCancelled: tLegalEditorCommon('notifications.scheduleCancelled'),
        cancelScheduleFailed: tLegalEditorCommon('notifications.cancelScheduleFailed'),
        activated: tLegalEditorCommon('notifications.activated'),
        activateFailed: tLegalEditorCommon('notifications.activateFailed'),
        deleted: tLegalEditorCommon('notifications.deleted'),
        deleteFailed: tLegalEditorCommon('notifications.deleteFailed'),
        regenerated: tLegalEditorCommon('notifications.regenerated'),
        regenerateFailed: tLegalEditorCommon('notifications.regenerateFailed'),
      },
    });

  const announceSourceTitleGeneration = useDebouncedCallback((targetLocale: string | null) => {
    if (!targetLocale) {
      return;
    }
    setSourceTitleGeneration({
      locale: targetLocale,
      sequence: ++sourceTitleGenerationSequenceRef.current,
    });
  }, 500);

  const handleDisplayedTitleChange = useCallback(
    (value: string) => {
      if (!roomLocale) {
        return;
      }
      setResidentTitle(value);
      debouncedTitleUpdate(value);
      if (activeEditLocale.isSourceLocale) {
        setTitle(value);
        announceSourceTitleGeneration(activeEditLocale.sourceLocale);
      }
    },
    [
      activeEditLocale.isSourceLocale,
      activeEditLocale.sourceLocale,
      announceSourceTitleGeneration,
      debouncedTitleUpdate,
      roomLocale,
    ],
  );

  const handleEditorReady = useCallback((editor: PolicyEditorInstance) => {
    editorRef.current = editor;
  }, []);

  const handleViewModeChange = (value: string) => {
    setViewMode(value);
    if (value === 'preview' && editorRef.current && !policyEditorError) {
      setPreviewHtml(policyTiptapDocumentToHtml(editorRef.current.state.doc));
    }
  };

  const handleSchedule = () => {
    if (!effectiveFrom) {
      notifications.show({
        message: tLegalEditorCommon('notifications.selectEffectiveDate'),
        color: 'red',
      });
      return;
    }
    scheduleMutation.mutate(effectiveFrom);
  };

  const handleExport = () => {
    window.print();
  };

  const canSchedule = isEditable && strategy.status.isDraft(policyData.status);
  const canCancelSchedule = isEditable && strategy.status.isScheduled(policyData.status);
  const canActivateNow =
    isEditable && (strategy.status.isDraft(policyData.status) || strategy.status.isScheduled(policyData.status));
  const canDelete = isEditable && strategy.status.isDraft(policyData.status);
  const canEditCurrentLocale =
    isEditable &&
    activeEditLocale.canEditActiveLocale &&
    localeMode.shouldUseLocaleDocument &&
    localeSession.hasRoomMutationAuthority({
      sourceLocale: blockRoom.bootstrap?.sourceLocale ?? null,
      locale: blockRoom.bootstrap?.locale ?? null,
      localeExists: blockRoom.bootstrap?.localeExists ?? false,
      documentRevision: blockRoom.bootstrap?.documentRevision ?? null,
      targetRevision: blockRoom.bootstrap?.targetRevision,
    }) &&
    blockRoom.isSynced;
  const canEditDisplayedTitle = canEditCurrentLocale;
  const activePreviewHtml = previewHtml;
  const canonicalPreviewBlocks = useMemo(() => {
    if (previewHtml) {
      return null;
    }
    if (blockRoomController && viewMode === 'preview') {
      return materializeLocalizedRichTextTree(blockRoomController.getLocalizedDocumentSnapshot());
    }
    if (!policyData.document) {
      return null;
    }
    return materializeLocalizedRichTextTree(
      materializeLocalizedRichTextDocument(policyData.document, policyData.document.sourceLocale),
    );
  }, [blockRoomController, policyData.document, previewHtml, viewMode]);

  return (
    <EditorRuntimeProvider
      provider={currentProvider}
      entityType={strategy.entityType}
      entityId={policyId}
      blockRoomProtocol={blockRoom.protocol}
    >
      <Stack h="100%" gap="md">
        <EditorHeader
          title={displayedTitle}
          onTitleChange={canEditDisplayedTitle ? handleDisplayedTitleChange : undefined}
          titleDisabled={!canEditDisplayedTitle}
          status={policyData.status}
          statusOptions={[
            {
              value: strategy.status.draft,
              label: tStatuses('draft'),
              actionLabel: tStatuses('draft'),
              tone: 'neutral',
            },
            {
              value: strategy.status.scheduled,
              label: tStatuses('scheduled'),
              actionLabel: tStatuses('scheduled'),
              tone: 'accent',
            },
            {
              value: strategy.status.active,
              label: tStatuses('active'),
              actionLabel: tStatuses('active'),
              tone: 'positive',
            },
            {
              value: strategy.status.archived,
              label: tStatuses('archived'),
              actionLabel: tStatuses('archived'),
              tone: 'neutral',
            },
          ]}
          isConnected={currentIsConnected}
          isSynced={currentIsSynced}
          onBack={() => router.push(strategy.listPath)}
          backTooltip={tActions(strategy.backTooltipKey)}
          onDelete={canDelete ? openDeleteModal : undefined}
          groupStatusWithCollab
          controls={
            <Group gap="xs" wrap="nowrap">
              <Text size="sm" fw={500}>
                v{policyData.version}
              </Text>
              {activeEditLocale.isControlVisible ? (
                <EditorActiveLocaleMenu
                  activeLocale={activeEditLocale.activeLocale}
                  activeLocaleLabel={activeEditLocale.activeLocaleLabel}
                  sourceLocale={activeEditLocale.sourceLocale}
                  localeOptions={activeEditLocale.localeOptions}
                  onChange={activeEditLocale.setActiveLocale}
                  disabled={activeEditLocale.isLoading}
                />
              ) : null}
            </Group>
          }
          actionItems={
            [
              ...(canSchedule
                ? [
                    {
                      key: 'schedule',
                      label: tActions('schedule'),
                      icon: <IconCalendar size={16} />,
                      emphasis: 'medium' as const,
                      onClick: openScheduleModal,
                    },
                  ]
                : []),
              ...(canCancelSchedule
                ? [
                    {
                      key: 'cancel-schedule',
                      label: tActions('cancelSchedule'),
                      icon: <IconX size={16} />,
                      tone: 'warning' as const,
                      emphasis: 'medium' as const,
                      onClick: openCancelModal,
                    },
                  ]
                : []),
              ...(canActivateNow
                ? [
                    {
                      key: 'activate-now',
                      label: tActions('activateNow'),
                      icon: <IconPlayerPlay size={16} />,
                      onClick: openActivateModal,
                    },
                  ]
                : []),
              ...(isEditable
                ? [
                    {
                      key: 'regenerate-html',
                      label: tActions('regenerateHtml'),
                      icon: <IconRefresh size={16} />,
                      emphasis: 'medium' as const,
                      loading: regenerateHtmlMutation.isPending,
                      onClick: () => regenerateHtmlMutation.mutate(),
                    },
                  ]
                : []),
              {
                key: 'export-pdf',
                label: tActions('exportPdf'),
                icon: <IconDownload size={16} />,
                emphasis: 'medium',
                onClick: handleExport,
              },
            ] satisfies EditorHeaderActionItem[]
          }
        />

        {strategy.status.isScheduled(policyData.status) && policyData.effectiveFrom && (
          <Alert icon={<IconCalendar size={16} />} tone="accent">
            {tLegalEditorCommon('alerts.scheduled', {
              date: dateTime.dateTime(policyData.effectiveFrom, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
            })}
          </Alert>
        )}

        {strategy.status.isActive(policyData.status) && (
          <Alert icon={<IconAlertCircle size={16} />} tone="warning">
            {t('alerts.active')}
          </Alert>
        )}

        {strategy.status.isArchived(policyData.status) && (
          <Alert icon={<IconAlertCircle size={16} />} tone="neutral">
            {tLegalEditorCommon('alerts.archived')}
          </Alert>
        )}

        <EntityTranslationsPanel entityType={strategy.entityType} entityId={policyId} canManage={isEditable} />

        {policyEditorError ? <Alert tone="warning">{policyEditorError}</Alert> : null}

        {strategy.status.isScheduled(policyData.status) ? (
          <ShareLinkSection entityType={strategy.entityType} entityId={policyId} />
        ) : null}

        {activeEditLocale.activeLocale && activeEditLocale.hasLiveRow ? (
          <LegalOgImagePanel
            entityType={strategy.entityType}
            locale={activeEditLocale.activeLocale}
            currentBackgroundUrl={ogBackgroundUrl}
            sourceTitleGeneration={sourceTitleGeneration}
            translationGenerationRun={activeEditLocale.ogGenerationRun}
          />
        ) : null}

        {isEditingTranslation ? (
          <LegalTranslationNotice
            pathname={strategy.entityType === 'terms' ? '/terms' : '/privacy'}
            localizationInfo={{
              displayedLocale: activeEditLocale.activeLocale,
              sourceLocale: activeEditLocale.sourceLocale,
            }}
          />
        ) : null}

        <SegmentedControl
          value={viewMode}
          onChange={handleViewModeChange}
          data={[
            { value: 'edit', label: isEditable ? tLabels('edit') : tLabels('source') },
            { value: 'preview', label: tLabels('preview') },
          ]}
          w={200}
        />

        {viewMode === 'edit' ? (
          editorSession ? (
            <PolicyEditor
              provider={editorSession.provider}
              blockRoomController={editorSession.controller}
              readOnly={!canEditCurrentLocale}
              structureLocked={!activeEditLocale.isSourceLocale}
              onEditorReady={handleEditorReady}
              onUnsupportedContent={setPolicyEditorError}
            />
          ) : (
            <Box p="md">
              <Text c="dimmed">{tCommonStates('connectingEditor')}</Text>
            </Box>
          )
        ) : (
          <Stack flex={1} gap="xs">
            <Box
              className="prose"
              p="xl"
              style={{
                border: '1px solid var(--mantine-color-default-border)',
                borderRadius: 'var(--mantine-radius-default)',
                background: 'var(--mantine-color-body)',
                flex: 1,
                overflow: 'auto',
              }}
            >
              <Title order={1} mb="xs">
                {displayedTitle || tCommonEntities(strategy.entityType)}
              </Title>
              <Text size="sm" c="dimmed" mb="xs">
                <strong>{tLabels('effectiveDate')}:</strong>{' '}
                {getEffectiveDateDisplay(
                  policyData.status,
                  tLegalEditorCommon('preview.tbd'),
                  strategy.status.isDraft,
                  (date) =>
                    dateTime.date(date, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    }),
                  policyData.effectiveFrom,
                )}
              </Text>
              <Text size="sm" c="dimmed" mb="md">
                <strong>{tLabels('version')}:</strong> {policyData.version}
              </Text>
              <Divider mb="md" />
              {activePreviewHtml ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: activePreviewHtml,
                  }}
                />
              ) : canonicalPreviewBlocks?.length ? (
                <LegalRichTextContent blocks={canonicalPreviewBlocks} className="prose" />
              ) : (
                <Text c="dimmed" ta="center" py="xl">
                  {tLegalEditorCommon('preview.empty')}
                </Text>
              )}
              <Divider mt="xl" mb="md" />
              <Text size="sm" c="dimmed">
                <strong>{siteSettings?.company_name || tLabels('companyName')}</strong>
              </Text>
              {siteSettings?.company_address && (
                <Text size="sm" c="dimmed">
                  {siteSettings.company_address}
                </Text>
              )}
              <Text size="sm" c="dimmed">
                {contactEmail && <a href={`mailto:${contactEmail}`}>{contactEmail}</a>}
                {contactEmail && siteSettings?.site_origin && ' | '}
                {siteSettings?.site_origin && (
                  <a href={siteSettings.site_origin} target="_blank" rel="noopener noreferrer">
                    {siteSettings.site_origin}
                  </a>
                )}
              </Text>
            </Box>
          </Stack>
        )}

        <Modal
          opened={scheduleModalOpened}
          onClose={closeScheduleModal}
          title={tCommonMessages('scheduleActivationTitle')}
        >
          <Stack>
            <Text size="sm" c="dimmed">
              {tCommonMessages('scheduleActivationDescription')}
            </Text>
            <DateTimePicker
              label={tLabels('effectiveDate')}
              placeholder={tCommonPlaceholders('selectDateAndTime')}
              value={effectiveFrom}
              onChange={(value) => setEffectiveFrom(value ? new Date(value) : null)}
              minDate={new Date()}
            />
            <Alert icon={<IconAlertCircle size={16} />} tone="warning">
              {tCommonMessages('scheduleActivationNotice')}
            </Alert>
            <Group justify="flex-end">
              <Button emphasis="low" onClick={closeScheduleModal}>
                {tActions('cancel')}
              </Button>
              <Button onClick={handleSchedule} loading={scheduleMutation.isPending} disabled={!effectiveFrom}>
                {tActions('schedule')}
              </Button>
            </Group>
          </Stack>
        </Modal>

        <Modal opened={cancelModalOpened} onClose={closeCancelModal} title={tActions('cancelSchedule')}>
          <Stack>
            <Text>{tLegalEditorCommon('cancelScheduleModal.confirmation')}</Text>
            <Text size="sm" c="dimmed">
              {tLegalEditorCommon('cancelScheduleModal.description')}
            </Text>
            <Group justify="flex-end">
              <Button emphasis="low" onClick={closeCancelModal}>
                {tLegalEditorCommon('cancelScheduleModal.keepSchedule')}
              </Button>
              <Button
                tone="warning"
                onClick={() => cancelScheduleMutation.mutate()}
                loading={cancelScheduleMutation.isPending}
              >
                {tActions('cancelSchedule')}
              </Button>
            </Group>
          </Stack>
        </Modal>

        <Modal opened={activateModalOpened} onClose={closeActivateModal} title={tActions('activateNow')}>
          <Stack>
            <Alert icon={<IconAlertCircle size={16} />} tone="warning">
              {tLegalEditorCommon('activateModal.warning')}
            </Alert>
            <Text size="sm" c="dimmed">
              {tLegalEditorCommon('activateModal.description')}
            </Text>
            <Divider />
            <Group justify="flex-end">
              <Button emphasis="low" onClick={closeActivateModal}>
                {tActions('cancel')}
              </Button>
              <Button
                tone="positive"
                onClick={() => activateNowMutation.mutate()}
                loading={activateNowMutation.isPending}
              >
                {tActions('activateNow')}
              </Button>
            </Group>
          </Stack>
        </Modal>

        <Modal opened={deleteModalOpened} onClose={closeDeleteModal} title={tActions('deleteVersion')}>
          <Stack>
            <Text>{tCommonMessages('deleteDraftVersionConfirm')}</Text>
            <Group justify="flex-end">
              <Button emphasis="low" onClick={closeDeleteModal}>
                {tActions('cancel')}
              </Button>
              <Button tone="danger" onClick={() => deleteMutation.mutate()} loading={deleteMutation.isPending}>
                {tActions('delete')}
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </EditorRuntimeProvider>
  );
}
