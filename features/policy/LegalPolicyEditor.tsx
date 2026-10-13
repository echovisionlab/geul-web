'use client';

import { AuthoringExtension } from '@/features/authoring/AuthoringExtensionsContext';
import Link from '@/components/core/Navigation';
import { SupportingText, Text as DsText, Heading as DsHeading } from '@/components/core/Typography';

import { ConfirmationDialog } from '@/features/confirmation';

import {
  LayoutInline as DsLayoutInline,
  LayoutStack as DsLayoutStack,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconAlertCircle, IconCalendar, IconDownload, IconPlayerPlay, IconRefresh, IconX } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Separator as Divider, ScrollArea } from '@/components/core/Display';
import { SectionCard } from '@/components/core/Section';
import { ContentModal, DialogActions } from '@/components/core/Modal';
import { Alert } from '@/components/core/Alert';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { SegmentedControl, DateTimePicker } from '@/components/core/Input';

import { useDebouncedCallback, useDisclosure } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { materializeLocalizedRichTextDocument } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { Button } from '@/components/core/Button';
import { EditorHeader, type EditorHeaderActionItem } from '@/features/editor/EditorHeader';
import { LegalOgImagePanel } from '@/features/policy/LegalOgImagePanel';
import { LegalRichTextContent } from '@/features/policy/LegalRichTextContent';
import { DOCUMENT_TITLE_HEADING_LEVEL } from '@/features/document-layout/ui/document-heading-level';
import { DocumentHeadingScope } from '@/features/document-layout/ui/DocumentHeadingScope';
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
import { updateBlockRoomLocaleMetadata } from '@/lib/collab/block-room-metadata';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import { useRichTextBlockRoomController } from '@/features/editor/hooks/useBlockRoomTiptapController';
import { useDebouncedRoomMetadata } from '@/lib/editor/useDebouncedRoomMetadata';
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

function useLegalPolicyEditorViewModel({
  initialPolicy,
  siteSettings,
  ogBackgroundUrl,
  contactEmail,
  strategy,
  canEdit,
}: Props) {
  const tModalActions = useTranslations('common.actions');
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

  const debouncedTitleUpdate = useDebouncedRoomMetadata({
    connection: blockRoom,
    document: `${strategy.entityType}:${policyId}`,
    delay: 500,
    write: (protocol, update: { locale: string; title: string }) =>
      updateBlockRoomLocaleMetadata(protocol, { type: documentType, ...update }),
  });

  const flushActiveDocuments = useCallback(async () => {
    if (!(await debouncedTitleUpdate.flush())) {
      throw new Error(tCommonNotifications('saveFailed'));
    }
    await persistCollaborativeDocumentNow(blockRoom.provider);
  }, [blockRoom.provider, debouncedTitleUpdate, tCommonNotifications]);

  const getExpectedRevision = useCallback(async () => {
    if (!blockRoom.protocol || !activeEditLocale.sourceLocale || !roomLocale) {
      throw new Error('Policy Block room is not ready.');
    }
    const snapshot = await blockRoom.protocol.getSnapshot();
    if (
      snapshot.locale !== roomLocale ||
      snapshot.sourceLocale !== activeEditLocale.sourceLocale ||
      !snapshot.localeExists
    ) {
      throw new Error('Policy Block room snapshot is no longer current.');
    }
    return snapshot.documentRevision;
  }, [activeEditLocale.sourceLocale, blockRoom.protocol, roomLocale]);

  const { scheduleMutation, cancelScheduleMutation, activateNowMutation, deleteMutation, regenerateHtmlMutation } =
    useLegalPolicyCommands({
      policyId,
      policyStatus: policyData.status,
      strategy,
      flushActiveDocuments,
      getExpectedRevision,
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
      debouncedTitleUpdate({ locale: roomLocale, title: value });
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
      // The preview renders the body below its title heading (the preview's h1).
      setPreviewHtml(
        policyTiptapDocumentToHtml(editorRef.current.state.doc, { headingParentLevel: DOCUMENT_TITLE_HEADING_LEVEL }),
      );
    }
  };

  const handleSchedule = () => {
    if (!effectiveFrom) {
      notifications.show({
        message: tLegalEditorCommon('notifications.selectEffectiveDate'),
        tone: 'danger',
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
  const canDelete = isEditable;
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

  return {
    currentProvider,
    strategy: {
      entityType: strategy.entityType,
      listPath: strategy.listPath,
      backTooltipKey: strategy.backTooltipKey,
      status: {
        draft: strategy.status.draft,
        scheduled: strategy.status.scheduled,
        active: strategy.status.active,
        archived: strategy.status.archived,
        isScheduled: strategy.status.isScheduled,
        isActive: strategy.status.isActive,
        isArchived: strategy.status.isArchived,
        isDraft: strategy.status.isDraft,
      },
    },
    policyId,
    blockRoom: { protocol: blockRoom.protocol },
    displayedTitle,
    canEditDisplayedTitle,
    handleDisplayedTitleChange,
    policyData: { status: policyData.status, version: policyData.version, effectiveFrom: policyData.effectiveFrom },
    tStatuses,
    currentIsConnected,
    currentIsSynced,
    router: { push: router.push },
    tActions,
    canDelete,
    openDeleteModal,
    activeEditLocale: {
      isControlVisible: activeEditLocale.isControlVisible,
      activeLocale: activeEditLocale.activeLocale,
      activeLocaleLabel: activeEditLocale.activeLocaleLabel,
      sourceLocale: activeEditLocale.sourceLocale,
      localeOptions: activeEditLocale.localeOptions,
      setActiveLocale: activeEditLocale.setActiveLocale,
      isLoading: activeEditLocale.isLoading,
      hasLiveRow: activeEditLocale.hasLiveRow,
      ogGenerationRun: activeEditLocale.ogGenerationRun,
      isSourceLocale: activeEditLocale.isSourceLocale,
    },
    canSchedule,
    openScheduleModal,
    canCancelSchedule,
    openCancelModal,
    canActivateNow,
    openActivateModal,
    isEditable,
    regenerateHtmlMutation: { isPending: regenerateHtmlMutation.isPending, mutate: regenerateHtmlMutation.mutate },
    handleExport,
    tLegalEditorCommon,
    dateTime: { dateTime: dateTime.dateTime, date: dateTime.date },
    t,
    policyEditorError,
    ogBackgroundUrl,
    sourceTitleGeneration,
    isEditingTranslation,
    viewMode,
    handleViewModeChange,
    tLabels,
    editorSession,
    canEditCurrentLocale,
    handleEditorReady,
    setPolicyEditorError,
    tCommonStates,
    tCommonEntities,
    activePreviewHtml,
    canonicalPreviewBlocks,
    siteSettings,
    contactEmail,
    scheduleModalOpened,
    closeScheduleModal,
    tCommonMessages,
    tModalActions,
    tCommonPlaceholders,
    effectiveFrom,
    setEffectiveFrom,
    handleSchedule,
    scheduleMutation: { isPending: scheduleMutation.isPending },
    cancelModalOpened,
    closeCancelModal,
    cancelScheduleMutation: { mutate: cancelScheduleMutation.mutate, isPending: cancelScheduleMutation.isPending },
    activateModalOpened,
    closeActivateModal,
    activateNowMutation: { mutate: activateNowMutation.mutate, isPending: activateNowMutation.isPending },
    deleteModalOpened,
    closeDeleteModal,
    deleteMutation: { mutate: deleteMutation.mutate, isPending: deleteMutation.isPending },
  };
}

export function LegalPolicyEditor(props: Props) {
  return <LegalPolicyEditorView model={useLegalPolicyEditorViewModel(props)} />;
}

export type LegalPolicyEditorViewModel = ReturnType<typeof useLegalPolicyEditorViewModel>;

/** Complete production editor composition; controllers supply data and commands. */
export function LegalPolicyEditorView({ model }: { model: LegalPolicyEditorViewModel }) {
  const {
    currentProvider,
    strategy,
    policyId,
    blockRoom,
    displayedTitle,
    canEditDisplayedTitle,
    handleDisplayedTitleChange,
    policyData,
    tStatuses,
    currentIsConnected,
    currentIsSynced,
    router,
    tActions,
    canDelete,
    openDeleteModal,
    activeEditLocale,
    canSchedule,
    openScheduleModal,
    canCancelSchedule,
    openCancelModal,
    canActivateNow,
    openActivateModal,
    isEditable,
    regenerateHtmlMutation,
    handleExport,
    tLegalEditorCommon,
    dateTime,
    t,
    policyEditorError,
    ogBackgroundUrl,
    sourceTitleGeneration,
    isEditingTranslation,
    viewMode,
    handleViewModeChange,
    tLabels,
    editorSession,
    canEditCurrentLocale,
    handleEditorReady,
    setPolicyEditorError,
    tCommonStates,
    tCommonEntities,
    activePreviewHtml,
    canonicalPreviewBlocks,
    siteSettings,
    contactEmail,
    scheduleModalOpened,
    closeScheduleModal,
    tCommonMessages,
    tModalActions,
    tCommonPlaceholders,
    effectiveFrom,
    setEffectiveFrom,
    handleSchedule,
    scheduleMutation,
    cancelModalOpened,
    closeCancelModal,
    cancelScheduleMutation,
    activateModalOpened,
    closeActivateModal,
    activateNowMutation,
    deleteModalOpened,
    closeDeleteModal,
    deleteMutation,
  } = model;
  return (
    <EditorRuntimeProvider
      provider={currentProvider}
      entityType={strategy.entityType}
      entityId={policyId}
      blockRoomProtocol={blockRoom.protocol}
    >
      <DsLayoutStack fill="block" gap="md">
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
            <DsLayoutInline gap="xs" wrap="nowrap">
              <DsText size="sm" weight="medium">
                v{policyData.version}
              </DsText>
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
            </DsLayoutInline>
          }
          actionItems={
            [
              ...(canSchedule
                ? [
                    {
                      key: 'schedule',
                      label: tActions('schedule'),
                      icon: <IconCalendar />,
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
                      icon: <IconX />,
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
                      icon: <IconPlayerPlay />,
                      onClick: openActivateModal,
                    },
                  ]
                : []),
              ...(isEditable
                ? [
                    {
                      key: 'regenerate-html',
                      label: tActions('regenerateHtml'),
                      icon: <IconRefresh />,
                      emphasis: 'medium' as const,
                      loading: regenerateHtmlMutation.isPending,
                      onClick: () => regenerateHtmlMutation.mutate(),
                    },
                  ]
                : []),
              {
                key: 'export-pdf',
                label: tActions('exportPdf'),
                icon: <IconDownload />,
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

        <AuthoringExtension kind="translations">
          <EntityTranslationsPanel entityType={strategy.entityType} entityId={policyId} canManage={isEditable} />
        </AuthoringExtension>

        {policyEditorError ? <Alert tone="danger">{policyEditorError}</Alert> : null}

        {strategy.status.isScheduled(policyData.status) ? (
          <AuthoringExtension kind="sharing">
            <ShareLinkSection entityType={strategy.entityType} entityId={policyId} />
          </AuthoringExtension>
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

        <div style={{ width: 200 }}>
          <SegmentedControl
            aria-label={tLabels('content')}
            value={viewMode}
            onChange={handleViewModeChange}
            data={[
              { value: 'edit', label: isEditable ? tLabels('edit') : tLabels('source') },
              { value: 'preview', label: tLabels('preview') },
            ]}
          />
        </div>

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
            <DsLayoutInset space="md">
              <DsLayoutInset space="none">
                <SupportingText tone="secondary" role="status">
                  {tCommonStates('connectingEditor')}
                </SupportingText>
              </DsLayoutInset>
            </DsLayoutInset>
          )
        ) : (
          <DsLayoutStack flexible gap="xs">
            <SectionCard padding="none" grow layout="stack" clip>
              <ScrollArea grow inset="xl">
                <div className="prose" role="region" aria-label={tLabels('bodyPreview')}>
                  <DsLayoutInset blockEnd="xs">
                    <DsHeading level={1} scale="title">
                      {displayedTitle || tCommonEntities(strategy.entityType)}
                    </DsHeading>
                  </DsLayoutInset>
                  <DsLayoutInset blockEnd="xs">
                    <DsText size="sm" tone="secondary">
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
                    </DsText>
                  </DsLayoutInset>
                  <DsLayoutInset blockEnd="md">
                    <DsText size="sm" tone="secondary">
                      <strong>{tLabels('version')}:</strong> {policyData.version}
                    </DsText>
                  </DsLayoutInset>
                  <Divider spaceAfter="md" />
                  {activePreviewHtml ? (
                    <div
                      lang={activeEditLocale.activeLocale ?? undefined}
                      dangerouslySetInnerHTML={{
                        __html: activePreviewHtml,
                      }}
                    />
                  ) : canonicalPreviewBlocks?.length ? (
                    <DocumentHeadingScope parentLevel={DOCUMENT_TITLE_HEADING_LEVEL}>
                      <LegalRichTextContent
                        blocks={canonicalPreviewBlocks}
                        className="prose"
                        requestedLocale={activeEditLocale.activeLocale ?? undefined}
                      />
                    </DocumentHeadingScope>
                  ) : (
                    <DsLayoutInset block="xl">
                      <SupportingText tone="secondary" align="center">
                        {tLegalEditorCommon('preview.empty')}
                      </SupportingText>
                    </DsLayoutInset>
                  )}
                  <Divider spaceBefore="xl" spaceAfter="md" />
                  <DsText size="sm" tone="secondary">
                    <strong>{siteSettings?.company_name || tLabels('companyName')}</strong>
                  </DsText>
                  {siteSettings?.company_address && (
                    <DsText size="sm" tone="secondary">
                      {siteSettings.company_address}
                    </DsText>
                  )}
                  <DsText size="sm" tone="secondary">
                    {contactEmail && (
                      <Link href={`mailto:${contactEmail}`} tone="inherit">
                        {contactEmail}
                      </Link>
                    )}
                    {contactEmail && siteSettings?.site_origin && ' | '}
                    {siteSettings?.site_origin && (
                      <Link href={siteSettings.site_origin} target="_blank" rel="noopener noreferrer" tone="inherit">
                        {siteSettings.site_origin}
                      </Link>
                    )}
                  </DsText>
                </div>
              </ScrollArea>
            </SectionCard>
          </DsLayoutStack>
        )}

        <ContentModal
          opened={scheduleModalOpened}
          onClose={closeScheduleModal}
          title={tCommonMessages('scheduleActivationTitle')}
          closeLabel={tModalActions('close')}
        >
          <DsLayoutStack>
            <SupportingText tone="secondary">{tCommonMessages('scheduleActivationDescription')}</SupportingText>
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
            <DialogActions>
              <Button emphasis="low" onClick={closeScheduleModal}>
                {tActions('cancel')}
              </Button>
              <Button
                emphasis="strong"
                onClick={handleSchedule}
                loading={scheduleMutation.isPending}
                disabled={!effectiveFrom}
              >
                {tActions('schedule')}
              </Button>
            </DialogActions>
          </DsLayoutStack>
        </ContentModal>

        <ContentModal
          opened={cancelModalOpened}
          onClose={closeCancelModal}
          title={tActions('cancelSchedule')}
          closeLabel={tModalActions('close')}
        >
          <DsLayoutStack>
            <DsText>{tLegalEditorCommon('cancelScheduleModal.confirmation')}</DsText>
            <SupportingText tone="secondary">{tLegalEditorCommon('cancelScheduleModal.description')}</SupportingText>
            <DialogActions>
              <Button emphasis="low" onClick={closeCancelModal}>
                {tLegalEditorCommon('cancelScheduleModal.keepSchedule')}
              </Button>
              <Button
                emphasis="strong"
                tone="warning"
                onClick={() => cancelScheduleMutation.mutate()}
                loading={cancelScheduleMutation.isPending}
              >
                {tActions('cancelSchedule')}
              </Button>
            </DialogActions>
          </DsLayoutStack>
        </ContentModal>

        <ContentModal
          opened={activateModalOpened}
          onClose={closeActivateModal}
          title={tActions('activateNow')}
          closeLabel={tModalActions('close')}
        >
          <DsLayoutStack>
            <Alert icon={<IconAlertCircle size={16} />} tone="warning">
              {tLegalEditorCommon('activateModal.warning')}
            </Alert>
            <DsText tone="secondary">{tLegalEditorCommon('activateModal.description')}</DsText>
            <DialogActions>
              <Button emphasis="low" onClick={closeActivateModal}>
                {tActions('cancel')}
              </Button>
              <Button
                emphasis="strong"
                tone="positive"
                onClick={() => activateNowMutation.mutate()}
                loading={activateNowMutation.isPending}
              >
                {tActions('activateNow')}
              </Button>
            </DialogActions>
          </DsLayoutStack>
        </ContentModal>

        <ConfirmationDialog
          intent="delete"
          opened={deleteModalOpened}
          onClose={closeDeleteModal}
          onConfirm={() => deleteMutation.mutate()}
          title={tActions('deleteVersion')}
          confirmLabel={tActions('delete')}
          cancelLabel={tActions('cancel')}
          closeLabel={tModalActions('close')}
          loading={deleteMutation.isPending}
          message={
            <>
              <DsText>{tCommonMessages('deleteItemConfirm', { item: tCommonEntities(strategy.entityType) })}</DsText>
            </>
          }
        />
      </DsLayoutStack>
    </EditorRuntimeProvider>
  );
}
