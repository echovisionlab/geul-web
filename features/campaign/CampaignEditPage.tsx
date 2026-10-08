'use client';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CampaignTargetMode } from '@echovisionlab/geul-proto/secure/campaign_pb.ts';
import type { CampaignRecipientScope as CampaignRecipientScopeValue } from '@echovisionlab/geul-common/collaboration/campaign';
import {
  IconCalendar,
  IconChartBar,
  IconColumns2,
  IconEdit,
  IconEye,
  IconPlayerStop,
  IconSend,
  IconTestPipe,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Box, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { EditorHeader, type StatusOption } from '@/features/editor/EditorHeader';
import { EditorPermissionRevokedDialog } from '@/features/editor/EditorPermissionRevokedDialog';
import { EditorSessionExpiredDialog } from '@/features/editor/EditorSessionExpiredDialog';
import { useEditorPermissionRevocation } from '@/features/editor/useEditorPermissionRevocation';
import { dateTimeValueToDate, dateToDateTimeValue, type DateTimeValue } from '@/components/core/Input/DateTimeInput';
import { Select, TextInput } from '@/components/core/Input';
import { PageLoader } from '@/features/site/PageLoader';
import { IconViewModeControl } from '@/features/admin/IconViewModeControl';
import { CampaignEditor } from '@/features/campaign/CampaignEditor/CampaignEditor';
import { CampaignDeliveryDialogs } from '@/features/campaign/CampaignDeliveryDialogs';
import { CampaignRecipientScopeControl } from '@/features/campaign/CampaignRecipientScopeControl';
import { useCampaignDeliveryCommands } from '@/features/campaign/useCampaignDeliveryCommands';
import { useCampaignName } from '@/features/campaign/useCampaignName';
import { useCampaignPreview } from '@/features/campaign/useCampaignPreview';
import {
  CampaignTargetControl,
  isDeliverableCampaignTarget,
  type CampaignTargetSelection,
} from '@/features/campaign/CampaignTargetControl';
import { EntityTranslationsPanel } from '@/features/translation/EntityTranslationsPanel';
import { canEditLocaleDocumentField, resolveResidentLocaleField } from '@/features/translation/locale-display-fields';
import { TranslationLocaleControl } from '@/features/translation/TranslationLocaleControl';
import { useLocaleDocumentSession } from '@/features/translation/useLocaleDocumentSession';
import { listActiveSegmentsAction } from '@/lib/actions/audience';
import { getCampaignAction, updateCampaignConfigurationAction } from '@/lib/actions/campaign';
import { persistCollaborativeDocumentNow } from '@/lib/collab/persist-now';
import { updateBlockRoomLocaleMetadata } from '@/lib/collab/block-room-metadata';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import { flushEditorSaves } from '@/lib/editor/editor-save-registry';
import { publishEditorEntityChange, useEditorEntityChanges } from '@/lib/editor/editor-entity-changes';
import { useBlockRoomMetadataUpdates } from '@/lib/editor/useBlockRoomMetadataUpdates';
import { useDebouncedRoomMetadata } from '@/lib/editor/useDebouncedRoomMetadata';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { useRichTextBlockRoomController } from '@/features/editor/hooks/useBlockRoomTiptapController';
import { useBlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';
import { DEFAULT_CAMPAIGN_FIELDS, type CampaignFields } from '@/lib/collab/schemas/campaign-fields.schema';
import { getSupportedLocaleOptions, normalizeLocale } from '@/lib/i18n/locale';
import { listEmailLayoutsSimple } from '@/lib/queries/email-layout';
import {
  canCancelScheduledCampaignStatus,
  canEditCampaignStatus,
  canScheduleCampaignStatus,
  canSendCampaignNowStatus,
} from '@/lib/types/campaign/policy';
import { guardNotFound } from '@/lib/utils/not-found-guard';

export default function CampaignEditPage() {
  const t = useTranslations('campaignEditor');
  const tActions = useTranslations('common.actions');
  const tLabels = useTranslations('common.labels');
  const tCommonNotifications = useTranslations('common.notifications');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const tCampaignStatuses = useTranslations('adminList.campaigns.statuses');
  const tAnalytics = useTranslations('campaignAnalytics');
  const tStates = useTranslations('common.states');
  const tEmailLayoutViewModes = useTranslations('adminList.emailLayouts.detail.viewModes');
  const currentLocale = useLocale();
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [testEmail, setTestEmail] = useState('');
  const [testLocale, setTestLocale] = useState<string>(() => normalizeLocale(currentLocale) ?? 'en');
  const [scheduleDate, setScheduleDate] = useState<DateTimeValue>({ date: null, time: '' });

  const [testModalOpened, { open: openTestModal, close: closeTestModal }] = useDisclosure(false);
  const [sendModalOpened, { open: openSendModal, close: closeSendModal }] = useDisclosure(false);
  const [scheduleModalOpened, { open: openScheduleModal, close: closeScheduleModal }] = useDisclosure(false);
  const supportedLocaleOptions = useMemo(() => getSupportedLocaleOptions(), []);

  const campaignQuery = useQuery({
    queryKey: ['campaigns', campaignId],
    queryFn: () => getCampaignAction(campaignId).then(unwrapQueryResult),
  });
  const { data: campaign, isLoading, refetch: refetchCampaign } = campaignQuery;
  const localeSession = useLocaleDocumentSession({
    entityType: 'campaign',
    entityId: campaignId,
    sourceTitle: campaign?.subject ?? '',
    sourceSummary: '',
    enabled: Boolean(campaign),
  });
  const { activeEditLocale, roomLocale } = localeSession;
  const localeMode = localeSession.mode;
  const blockRoom = useBlockRoomConnection('campaign', campaignId, roomLocale);
  const { provider, doc, bootstrap, protocol, isConnected, isSynced } = blockRoom;
  const blockRoomController = useRichTextBlockRoomController('campaign', doc, roomLocale);
  const currentProvider = provider;
  const editorSession =
    currentProvider && blockRoomController ? { provider: currentProvider, controller: blockRoomController } : null;

  const [fields, setCampaignFields] = useState<CampaignFields>(DEFAULT_CAMPAIGN_FIELDS);
  const [pendingConfigRequestCount, setPendingConfigRequestCount] = useState(0);
  const pendingConfigRequestsRef = useRef(new Map<keyof CampaignFields, Set<number>>());
  const latestConfigRequestRef = useRef(new Map<keyof CampaignFields, number>());
  const nextConfigRequestRef = useRef(0);
  const beginConfigRequest = useCallback((keys: (keyof CampaignFields)[]) => {
    const requestId = ++nextConfigRequestRef.current;
    setPendingConfigRequestCount((count) => count + 1);
    for (const key of keys) {
      const requests = pendingConfigRequestsRef.current.get(key) ?? new Set<number>();
      requests.add(requestId);
      pendingConfigRequestsRef.current.set(key, requests);
      latestConfigRequestRef.current.set(key, requestId);
    }
    return {
      isLatest: () => keys.every((key) => latestConfigRequestRef.current.get(key) === requestId),
      finish: () => {
        setPendingConfigRequestCount((count) => Math.max(0, count - 1));
        for (const key of keys) {
          const requests = pendingConfigRequestsRef.current.get(key);
          requests?.delete(requestId);
          if (requests?.size === 0) {
            pendingConfigRequestsRef.current.delete(key);
          }
        }
      },
    };
  }, []);
  const hasPendingCampaignConfiguration = pendingConfigRequestCount > 0;
  const setField = useCallback(<K extends keyof CampaignFields>(key: K, value: CampaignFields[K]) => {
    setCampaignFields((current) => ({ ...current, [key]: value }));
  }, []);
  const setFields = useCallback((values: Partial<CampaignFields>) => {
    setCampaignFields((current) => ({ ...current, ...values }));
  }, []);
  const adoptCampaignFields = useCallback((source: NonNullable<typeof campaign>) => {
    setCampaignFields((current) => {
      const pending = pendingConfigRequestsRef.current;
      return {
        targetMode: pending.has('targetMode') ? current.targetMode : source.targetMode,
        segmentId: pending.has('segmentId') ? current.segmentId : (source.segmentId ?? null),
        layoutId: pending.has('layoutId') ? current.layoutId : (source.layoutId ?? null),
        recipientScope: pending.has('recipientScope') ? current.recipientScope : source.recipientScope,
      };
    });
  }, []);
  const refetchCampaignFields = useCallback(async () => {
    const result = await refetchCampaign();
    if (result.data) {
      adoptCampaignFields(result.data);
    }
  }, [adoptCampaignFields, refetchCampaign]);
  useEditorEntityChanges(
    `campaign:${campaignId}`,
    () => {
      void refetchCampaignFields();
    },
    currentProvider,
  );
  useEffect(() => {
    if (campaign) {
      adoptCampaignFields(campaign);
    }
  }, [adoptCampaignFields, campaign]);
  const accessInterruption = useEditorPermissionRevocation(currentProvider, 'campaign', campaignId);

  const {
    data: segments,
    isError: segmentsLoadError,
    isLoading: segmentsLoading,
  } = useQuery({
    queryKey: ['segments', 'active'],
    queryFn: listActiveSegmentsAction,
  });

  const { data: layouts, isError: layoutsLoadError } = useQuery({
    queryKey: ['emailLayouts', 'simple'],
    queryFn: listEmailLayoutsSimple,
  });

  useEffect(() => {
    const normalizedActiveLocale =
      normalizeLocale(activeEditLocale.activeLocale) ??
      normalizeLocale(activeEditLocale.sourceLocale) ??
      normalizeLocale(currentLocale) ??
      'en';
    setTestLocale(normalizedActiveLocale);
  }, [activeEditLocale.activeLocale, activeEditLocale.sourceLocale, currentLocale]);

  const [residentSubject, setResidentSubject] = useState('');
  useEffect(() => {
    setResidentSubject(
      resolveResidentLocaleField({
        isSourceLocale: activeEditLocale.isSourceLocale,
        hasLiveRow: activeEditLocale.hasLiveRow,
        sourceValue: campaign?.subject ?? '',
        localizedValue: activeEditLocale.displayTitle,
      }),
    );
  }, [activeEditLocale.displayTitle, activeEditLocale.hasLiveRow, activeEditLocale.isSourceLocale, campaign?.subject]);
  useBlockRoomMetadataUpdates(blockRoom, `campaign:${campaignId}`, ({ operation, values }) => {
    if (operation === 'locale' && typeof values.subject === 'string') {
      setResidentSubject(values.subject);
    }
  });
  const currentSubject = roomLocale ? residentSubject : (campaign?.subject ?? '');
  const isEditable = campaign ? canEditCampaignStatus(campaign.status) : false;
  const canMutate = isEditable && !accessInterruption.blocked;
  const canEditTranslationSource = canMutate;
  const hasLocaleRoomMutationAuthority = localeSession.hasRoomMutationAuthority({
    sourceLocale: bootstrap?.sourceLocale ?? null,
    locale: bootstrap?.locale ?? null,
    localeExists: bootstrap?.localeExists ?? false,
    documentRevision: bootstrap?.documentRevision ?? null,
    targetRevision: bootstrap?.targetRevision,
  });
  const canEditLocalizedSubject = canEditLocaleDocumentField({
    hasPermission: canEditTranslationSource && activeEditLocale.canEditActiveLocale && hasLocaleRoomMutationAuthority,
    shouldUseLocaleDocument: localeMode.shouldUseLocaleDocument,
    isLocaleDocumentSynced: isSynced,
  });
  const activePreviewLocale =
    normalizeLocale(activeEditLocale.activeLocale) ??
    normalizeLocale(activeEditLocale.sourceLocale) ??
    normalizeLocale(currentLocale) ??
    'en';
  const campaignName = useCampaignName({ campaignId, campaign, editable: canMutate });
  const preview = useCampaignPreview({
    campaignId,
    campaignLoaded: Boolean(campaign),
    locale: activePreviewLocale,
    layoutId: fields.layoutId,
    subject: currentSubject,
    editorSynced: isSynced,
    blockRoomController,
  });
  const viewModeOptions = useMemo(
    () => [
      {
        value: 'split' as const,
        icon: <IconColumns2 size={16} />,
        tooltip: tEmailLayoutViewModes('split'),
      },
      {
        value: 'edit' as const,
        icon: <IconEdit size={16} />,
        tooltip: tLabels('edit'),
      },
      {
        value: 'preview' as const,
        icon: <IconEye size={16} />,
        tooltip: tLabels('preview'),
      },
    ],
    [tEmailLayoutViewModes, tLabels],
  );
  const { sendTest, sendCampaign, scheduleCampaign, cancelSchedule } = useCampaignDeliveryCommands({
    campaignId,
    closeTestModal,
    closeSendModal,
    closeScheduleModal,
    messages: {
      testSent: tCommonNotifications('testEmailSent'),
      sent: (recipientCount) => t('notifications.campaignSent', { count: recipientCount }),
      scheduled: t('notifications.campaignScheduled'),
      scheduleCancelled: t('notifications.scheduleCancelled'),
    },
  });
  const debouncedSubjectUpdate = useDebouncedRoomMetadata({
    connection: blockRoom,
    document: `campaign:${campaignId}`,
    write: (protocol, input: { locale: string; subject: string }) =>
      updateBlockRoomLocaleMetadata(protocol, { type: 'campaign', ...input }),
  });

  const handleSubjectChange = useCallback(
    (value: string) => {
      if (!canEditLocalizedSubject || !activeEditLocale.activeLocale) {
        return;
      }
      setResidentSubject(value);
      debouncedSubjectUpdate({ locale: activeEditLocale.activeLocale, subject: value });
      if (preview.showPreview) {
        void preview.scheduleRefresh();
      }
    },
    [activeEditLocale.activeLocale, canEditLocalizedSubject, debouncedSubjectUpdate, preview],
  );

  const persistEditableCampaignBeforeDelivery = useCallback(async () => {
    if (!canMutate) {
      return true;
    }
    if (!(await flushEditorSaves(`campaign:${campaignId}`))) {
      notifications.show({ message: tCommonNotifications('saveFailed'), color: 'red' });
      return false;
    }
    if (localeMode.shouldUseLocaleDocument && !isSynced) {
      notifications.show({ message: tStates('syncing'), color: 'yellow' });
      return false;
    }
    try {
      await persistCollaborativeDocumentNow(currentProvider);
      return true;
    } catch (error) {
      notifications.show({
        message: error instanceof Error ? error.message : tCommonNotifications('saveFailed'),
        color: 'red',
      });
      return false;
    }
  }, [
    campaignId,
    currentProvider,
    canMutate,
    isSynced,
    localeMode.shouldUseLocaleDocument,
    tCommonNotifications,
    tStates,
  ]);

  const handleBack = useCallback(() => {
    void (async () => {
      if (!(await flushEditorSaves(`campaign:${campaignId}`))) {
        notifications.show({ message: tCommonNotifications('saveFailed'), color: 'red' });
        return;
      }
      router.push('/admin/campaigns');
    })();
  }, [campaignId, router, tCommonNotifications]);

  const handleTargetChange = useCallback(
    async (selection: CampaignTargetSelection) => {
      if (!canMutate) {
        return;
      }
      const request = beginConfigRequest(['targetMode', 'segmentId']);
      try {
        const result = await updateCampaignConfigurationAction(campaignId, {
          targetMode: selection.targetMode,
          segmentId: selection.segmentId,
        });
        if (result.error) {
          notifications.show({ message: result.error, color: 'red' });
        } else {
          if (request.isLatest()) {
            setFields({ targetMode: selection.targetMode, segmentId: selection.segmentId });
          }
          publishEditorEntityChange(`campaign:${campaignId}`);
        }
      } finally {
        request.finish();
        await refetchCampaignFields();
      }
    },
    [beginConfigRequest, campaignId, canMutate, refetchCampaignFields, setFields],
  );

  const handleLayoutChange = useCallback(
    async (value: string | null) => {
      if (!canMutate) {
        return;
      }
      const request = beginConfigRequest(['layoutId']);
      let updated = false;
      try {
        const result = await updateCampaignConfigurationAction(campaignId, { layoutId: value });
        if (result.error) {
          notifications.show({ message: result.error, color: 'red' });
        } else {
          updated = true;
          if (request.isLatest()) {
            setField('layoutId', value);
          }
          publishEditorEntityChange(`campaign:${campaignId}`);
        }
      } finally {
        request.finish();
        await refetchCampaignFields();
      }
      if (updated && preview.showPreview) {
        void preview.scheduleRefresh();
      }
    },
    [beginConfigRequest, campaignId, canMutate, preview, refetchCampaignFields, setField],
  );

  const handleRecipientScopeChange = useCallback(
    async (recipientScope: CampaignRecipientScopeValue) => {
      if (!canMutate) {
        return;
      }
      const request = beginConfigRequest(['recipientScope']);
      try {
        const result = await updateCampaignConfigurationAction(campaignId, { recipientScope });
        if (result.error) {
          notifications.show({ message: result.error, color: 'red' });
        } else {
          if (request.isLatest()) {
            setField('recipientScope', recipientScope);
          }
          publishEditorEntityChange(`campaign:${campaignId}`);
        }
      } finally {
        request.finish();
        await refetchCampaignFields();
      }
    },
    [beginConfigRequest, campaignId, canMutate, refetchCampaignFields, setField],
  );

  const handleActiveLocaleChange = useCallback(
    (value: string | null) => {
      if (!value) {
        return;
      }
      activeEditLocale.setActiveLocale(value);
    },
    [activeEditLocale],
  );

  const selectedSegmentName =
    fields.targetMode === CampaignTargetMode.ALL
      ? tLabels('allUsers')
      : (segments?.find((segment) => segment.id === fields.segmentId)?.name ?? t('target.unavailableAudience'));
  const deliveryTargetComplete = isDeliverableCampaignTarget(
    {
      targetMode: fields.targetMode,
      segmentId: fields.segmentId,
    },
    segments ?? [],
  );

  const handleSendTest = useCallback(() => {
    if (!testEmail) {
      return;
    }
    void (async () => {
      if (!(await persistEditableCampaignBeforeDelivery())) {
        return;
      }
      sendTest.mutate({ email: testEmail, locale: testLocale });
    })();
  }, [persistEditableCampaignBeforeDelivery, sendTest, testEmail, testLocale]);

  const handleSendAll = useCallback(() => {
    if (pendingConfigRequestsRef.current.size > 0) {
      return;
    }
    if (!deliveryTargetComplete) {
      notifications.show({ message: t('target.audienceRequired'), color: 'red' });
      return;
    }
    void (async () => {
      if (!(await persistEditableCampaignBeforeDelivery())) {
        return;
      }
      if (pendingConfigRequestsRef.current.size > 0) {
        return;
      }
      sendCampaign.mutate(fields.recipientScope);
    })();
  }, [deliveryTargetComplete, fields.recipientScope, persistEditableCampaignBeforeDelivery, sendCampaign, t]);

  const handleSchedule = useCallback(() => {
    if (pendingConfigRequestsRef.current.size > 0) {
      return;
    }
    const scheduledAt = dateTimeValueToDate(scheduleDate);
    if (!scheduledAt || !deliveryTargetComplete) {
      if (!deliveryTargetComplete) {
        notifications.show({ message: t('target.audienceRequired'), color: 'red' });
      }
      return;
    }
    void (async () => {
      if (!(await persistEditableCampaignBeforeDelivery())) {
        return;
      }
      if (pendingConfigRequestsRef.current.size > 0) {
        return;
      }
      scheduleCampaign.mutate({
        scheduledAt,
        recipientScope: fields.recipientScope,
      });
    })();
  }, [
    deliveryTargetComplete,
    fields.recipientScope,
    persistEditableCampaignBeforeDelivery,
    scheduleCampaign,
    scheduleDate,
    t,
  ]);

  const handleCancelSchedule = useCallback(() => {
    cancelSchedule.mutate();
  }, [cancelSchedule]);

  if (isLoading) {
    return <PageLoader />;
  }

  if (campaignQuery.isError && !campaign) {
    return <QueryErrorAlert queries={[campaignQuery]} />;
  }

  guardNotFound(campaign);

  const isScheduled = canCancelScheduledCampaignStatus(campaign.status);
  const canSchedule = canScheduleCampaignStatus(campaign.status);
  const canSendNow = canSendCampaignNowStatus(campaign.status);

  const statusOptions = [
    {
      value: 'draft',
      label: tCampaignStatuses('draft'),
      actionLabel: tCampaignStatuses('draft'),
      tone: 'neutral',
    },
    {
      value: 'scheduled',
      label: tCampaignStatuses('scheduled'),
      actionLabel: tCampaignStatuses('scheduled'),
      tone: 'accent',
    },
    {
      value: 'sending',
      label: tCampaignStatuses('sending'),
      actionLabel: tCampaignStatuses('sending'),
      tone: 'warning',
    },
    {
      value: 'sent',
      label: tCampaignStatuses('sent'),
      actionLabel: tCampaignStatuses('sent'),
      tone: 'positive',
    },
    {
      value: 'failed',
      label: tCampaignStatuses('failed'),
      actionLabel: tCampaignStatuses('failed'),
      tone: 'danger',
    },
  ] satisfies StatusOption<string>[];

  return (
    <EditorRuntimeProvider
      provider={currentProvider}
      entityType="campaign"
      entityId={campaignId}
      blockRoomProtocol={protocol}
    >
      <QueryErrorAlert queries={[campaignQuery]} />
      <Stack h="100%" gap="md">
        <EditorHeader
          title={campaignName.name}
          onTitleChange={campaignName.changeName}
          titleDisabled={!canMutate || campaignName.pending}
          status={campaign.status}
          statusOptions={statusOptions}
          isConnected={isConnected}
          isSynced={isSynced}
          onBack={handleBack}
          backTooltip={t('actions.backToCampaigns')}
          actionItems={[
            {
              key: 'analytics',
              label: tAnalytics('title'),
              icon: <IconChartBar size={16} />,
              emphasis: 'medium',
              onClick: () => router.push(`/campaigns/${campaignId}/analytics`),
            },
            {
              key: 'send-test',
              label: tActions('sendTest'),
              icon: <IconTestPipe size={16} />,
              emphasis: 'medium',
              onClick: openTestModal,
            },
            ...(canSchedule
              ? [
                  {
                    key: 'schedule',
                    label: tActions('schedule'),
                    icon: <IconCalendar size={16} />,
                    emphasis: 'medium' as const,
                    disabled: hasPendingCampaignConfiguration || !currentSubject.trim() || !deliveryTargetComplete,
                    onClick: openScheduleModal,
                  },
                ]
              : []),
            ...(canSendNow
              ? [
                  {
                    key: 'send-now',
                    label: t('actions.sendNow'),
                    icon: <IconSend size={16} />,
                    disabled: hasPendingCampaignConfiguration || !currentSubject.trim() || !deliveryTargetComplete,
                    onClick: openSendModal,
                  },
                ]
              : []),
            ...(isScheduled
              ? [
                  {
                    key: 'cancel-schedule',
                    label: tActions('cancelSchedule'),
                    icon: <IconPlayerStop size={16} />,
                    tone: 'danger' as const,
                    emphasis: 'medium' as const,
                    loading: cancelSchedule.isPending,
                    onClick: handleCancelSchedule,
                  },
                ]
              : []),
          ]}
        />

        <Group align="flex-end" wrap="wrap">
          <TextInput
            label={tLabels('subject')}
            value={currentSubject}
            onChange={(event) => handleSubjectChange(event.currentTarget.value)}
            style={{ flex: 1, minWidth: 260 }}
            disabled={!canEditLocalizedSubject}
          />
          {activeEditLocale.isControlVisible ? (
            <TranslationLocaleControl
              variant="select"
              label={tLabels('language')}
              value={activeEditLocale.activeLocale}
              options={activeEditLocale.localeOptions}
              sourceLocale={activeEditLocale.sourceLocale}
              onChange={handleActiveLocaleChange}
              w={220}
            />
          ) : null}
          {canMutate ? (
            <>
              <Box w={250}>
                <CampaignTargetControl
                  targetMode={fields.targetMode}
                  segmentId={fields.segmentId}
                  audiences={segments ?? []}
                  disabled={!canMutate || segmentsLoading}
                  loadError={segmentsLoadError}
                  onChange={handleTargetChange}
                />
              </Box>
              <Select
                placeholder={t('layout.none')}
                data={
                  layouts?.map((layout) => ({
                    value: layout.id,
                    label: layout.name,
                  })) ?? []
                }
                value={fields.layoutId}
                onChange={handleLayoutChange}
                clearable
                error={layoutsLoadError ? tStates('notAvailable') : undefined}
                disabled={!canMutate || layoutsLoadError}
                w={200}
              />
              <Box w={260}>
                <CampaignRecipientScopeControl
                  value={fields.recipientScope}
                  labels={{
                    field: t('fields.recipientScope'),
                    subscribedUsers: t('fields.recipientScopeSubscribedUsers'),
                    allMatchingUsers: t('fields.recipientScopeAllMatchingUsers'),
                    allMatchingUsersWarning: t('fields.recipientScopeAllMatchingUsersWarning'),
                  }}
                  onChange={handleRecipientScopeChange}
                  disabled={!canMutate}
                />
              </Box>
            </>
          ) : null}
          <Box ml="auto">
            <IconViewModeControl value={preview.viewMode} onChange={preview.changeViewMode} options={viewModeOptions} />
          </Box>
        </Group>

        <SimpleGrid
          cols={preview.viewMode === 'split' ? { base: 1, sm: 2 } : 1}
          spacing="md"
          style={{
            flex: 1,
            minHeight: 0,
            height: '100%',
            gridTemplateRows: 'minmax(0, 1fr)',
          }}
        >
          {preview.showEditor &&
            (editorSession ? (
              <CampaignEditor
                campaignId={campaignId}
                provider={editorSession.provider}
                blockRoomController={editorSession.controller}
                editable={canEditLocalizedSubject}
                structureLocked={!activeEditLocale.isSourceLocale}
                onEditorReady={preview.editorReady}
                onContentChange={preview.editorContentChanged}
              />
            ) : (
              <Box p="md">
                <Text c="dimmed">{tStates('loading')}</Text>
              </Box>
            ))}

          {preview.showPreview && (
            <Box flex={1}>
              <QueryErrorAlert queries={[preview.query]} />
              {preview.previewSrcDoc ? (
                <iframe
                  srcDoc={preview.previewSrcDoc}
                  style={{
                    width: '100%',
                    height: '100%',
                    minHeight: 500,
                    border: '1px solid var(--mantine-color-default-border)',
                    borderRadius: 'var(--mantine-radius-default)',
                    background: '#fff',
                  }}
                  title={t('preview.frameTitle')}
                />
              ) : (
                <Text c="dimmed" ta="center" py="xl">
                  {t('preview.empty')}
                </Text>
              )}
            </Box>
          )}
        </SimpleGrid>

        <EntityTranslationsPanel
          entityType="campaign"
          entityId={campaignId}
          canManage={canMutate}
          canAdministerTranslations={canMutate}
        />

        <CampaignDeliveryDialogs
          commonLabels={{
            close: tActions('close'),
            cancel: tActions('cancel'),
            language: tLabels('language'),
          }}
          testDialog={{
            opened: testModalOpened,
            email: testEmail,
            locale: testLocale,
            localeOptions: activeEditLocale.localeOptions.length
              ? activeEditLocale.localeOptions
              : supportedLocaleOptions,
            sourceLocale: activeEditLocale.sourceLocale,
            selectedLocale: activePreviewLocale,
            pending: sendTest.isPending,
            labels: {
              title: tActions('sendTestEmail'),
              description: t('testModal.description'),
              email: tLabels('email'),
              emailPlaceholder: tCommonPlaceholders('testEmailExample'),
              send: tActions('sendTest'),
            },
            onClose: closeTestModal,
            onEmailChange: setTestEmail,
            onLocaleChange: setTestLocale,
            onSend: handleSendTest,
          }}
          sendDialog={{
            opened: sendModalOpened,
            includesUnsubscribedUsers: fields.recipientScope === 'ALL_MATCHING_USERS',
            pending: sendCampaign.isPending || hasPendingCampaignConfiguration,
            labels: {
              title: t('actions.sendCampaign'),
              warning: t('sendModal.warning', { audience: selectedSegmentName }),
              subject: t('sendModal.subject', { subject: currentSubject || tStates('noSubject') }),
              allMatchingUsersWarning: t('sendModal.allMatchingUsersWarning'),
              send: t('actions.sendCampaign'),
            },
            onClose: closeSendModal,
            onSend: handleSendAll,
          }}
          scheduleDialog={{
            opened: scheduleModalOpened,
            locale: currentLocale,
            value: scheduleDate,
            minDate: dateToDateTimeValue(new Date()),
            audience: selectedSegmentName,
            includesUnsubscribedUsers: fields.recipientScope === 'ALL_MATCHING_USERS',
            pending: scheduleCampaign.isPending || hasPendingCampaignConfiguration,
            labels: {
              title: t('actions.scheduleCampaign'),
              description: t('scheduleModal.description'),
              date: t('scheduleModal.dateLabel'),
              time: tLabels('time'),
              previousMonth: t('scheduleModal.previousMonth'),
              nextMonth: t('scheduleModal.nextMonth'),
              hours: tLabels('hours'),
              minutes: tLabels('minutes'),
              audience: t('scheduleModal.audience', { audience: '{audience}' }),
              allMatchingUsersWarning: t('scheduleModal.allMatchingUsersWarning'),
              schedule: t('actions.scheduleCampaign'),
            },
            onClose: closeScheduleModal,
            onChange: setScheduleDate,
            onSchedule: handleSchedule,
          }}
        />

        <EditorPermissionRevokedDialog
          opened={accessInterruption.revoked}
          onConfirm={() => router.push('/admin/campaigns')}
        />

        <EditorSessionExpiredDialog
          opened={accessInterruption.sessionExpired}
          onConfirm={() => router.push(buildLoginRedirectHref(`/campaigns/${campaignId}?edit=true`))}
        />
      </Stack>
    </EditorRuntimeProvider>
  );
}
