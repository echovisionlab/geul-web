'use client';

import { EmailPreviewFrame } from '@/features/email/EmailPreviewFrame';

import { AuthoringExtension } from '@/features/authoring/AuthoringExtensionsContext';
import { SupportingText } from '@/components/core/Typography';
import { SectionCard as DsSectionCard } from '@/components/core/Section';

import {
  LayoutGrid as DsLayoutGrid,
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';

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

import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
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
import { useCampaignName, type CampaignEditorConfiguration } from '@/features/campaign/useCampaignName';
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
import { updateBlockRoomLocaleMetadata } from '@/lib/collab/block-room-metadata';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import { flushEditorSavesOrNotify } from '@/lib/editor/flush-editor-saves-or-notify';
import { persistEditorDocumentBeforeAction } from '@/lib/editor/persist-editor-document-before-action';
import { publishEditorEntityChange, useEditorEntityChanges } from '@/lib/editor/editor-entity-changes';
import { useBlockRoomMetadataUpdates } from '@/lib/editor/useBlockRoomMetadataUpdates';
import { useAuthoritativeConfiguration } from '@/lib/editor/useAuthoritativeConfiguration';
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

function campaignConfiguration(
  source: Pick<CampaignFields, 'targetMode' | 'recipientScope'> & {
    name: string;
    subject?: string;
    segmentId?: string | null;
    layoutId?: string | null;
  },
): CampaignEditorConfiguration {
  return {
    targetMode: source.targetMode,
    segmentId: source.segmentId ?? null,
    layoutId: source.layoutId ?? null,
    recipientScope: source.recipientScope,
    name: source.name || source.subject || '',
  };
}

function useCampaignEditPageModel() {
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

  const [fields, setCampaignFields] = useState<CampaignEditorConfiguration>({ ...DEFAULT_CAMPAIGN_FIELDS, name: '' });
  const configuration = useAuthoritativeConfiguration({
    document: `campaign:${campaignId}`,
    initialConfiguration: { ...DEFAULT_CAMPAIGN_FIELDS, name: '' },
    onAdopt: (patch) => setCampaignFields((current) => ({ ...current, ...patch })),
  });
  const initialConfigurationRead = useMemo(() => configuration.beginRead(), [configuration]);
  const campaignQuery = useQuery({
    queryKey: ['campaigns', campaignId],
    queryFn: async () => {
      const read = configuration.beginRead();
      const campaign = unwrapQueryResult(await getCampaignAction(campaignId));
      if (campaign) {
        configuration.adoptRead(read, campaignConfiguration(campaign));
      }
      return campaign;
    },
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

  const [pendingConfigRequestCount, setPendingConfigRequestCount] = useState(0);
  const beginConfigRequest = useCallback(
    (keys: (keyof CampaignFields)[]) => {
      setPendingConfigRequestCount((count) => count + 1);
      const write = configuration.beginWrite(keys);
      return {
        ...write,
        finish: () => {
          write.fail();
          setPendingConfigRequestCount((count) => Math.max(0, count - 1));
        },
      };
    },
    [configuration],
  );
  const hasPendingCampaignConfiguration = pendingConfigRequestCount > 0;
  const refetchCampaignFields = useCallback(async () => {
    await refetchCampaign();
  }, [refetchCampaign]);
  useEditorEntityChanges(
    `campaign:${campaignId}`,
    () => {
      void refetchCampaignFields();
    },
    currentProvider,
    undefined,
    configuration.captureOwnChange,
  );
  useEffect(() => {
    if (campaign) {
      configuration.adoptRead(initialConfigurationRead, campaignConfiguration(campaign));
    }
  }, [campaign, configuration, initialConfigurationRead]);
  const accessInterruption = useEditorPermissionRevocation(currentProvider, 'campaign', campaignId);

  const {
    data: segments,
    isError: segmentsLoadError,
    isLoading: segmentsLoading,
  } = useQuery({
    queryKey: ['segments', 'active'],
    queryFn: listActiveSegmentsAction,
  });

  const {
    data: layouts,
    isError: layoutsLoadError,
    isLoading: layoutsLoading,
  } = useQuery({
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
  const campaignName = useCampaignName({
    campaignId,
    configuration,
    refetchConfiguration: refetchCampaignFields,
    editable: canMutate,
  });
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
    if (accessInterruption.blocked) {
      return false;
    }
    if (!canMutate) {
      return true;
    }
    return persistEditorDocumentBeforeAction({
      document: `campaign:${campaignId}`,
      provider: currentProvider,
      requiresSync: localeMode.shouldUseLocaleDocument,
      isSynced,
      saveFailedMessage: tCommonNotifications('saveFailed'),
      syncingMessage: tStates('syncing'),
      syncingTone: 'warning',
    });
  }, [
    accessInterruption.blocked,
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
      if (await flushEditorSavesOrNotify(`campaign:${campaignId}`, tCommonNotifications('saveFailed'))) {
        router.push('/admin/campaigns');
      }
    })();
  }, [campaignId, router, tCommonNotifications]);

  const handleTargetChange = useCallback(
    async (selection: CampaignTargetSelection) => {
      if (!canMutate) {
        return;
      }
      const request = beginConfigRequest(['targetMode', 'segmentId']);
      try {
        const result = await updateCampaignConfigurationAction(
          campaignId,
          {
            targetMode: selection.targetMode,
            segmentId: selection.segmentId,
          },
          request.origin,
        );
        if (result.error) {
          notifications.show({ message: result.error, tone: 'danger' });
        } else {
          request.acknowledge(
            { targetMode: selection.targetMode, segmentId: selection.segmentId },
            { authoritative: false },
          );
          publishEditorEntityChange(`campaign:${campaignId}`, request.origin);
        }
      } finally {
        request.finish();
        await refetchCampaignFields();
      }
    },
    [beginConfigRequest, campaignId, canMutate, refetchCampaignFields],
  );

  const handleLayoutChange = useCallback(
    async (value: string | null) => {
      if (!canMutate) {
        return;
      }
      const request = beginConfigRequest(['layoutId']);
      let updated = false;
      try {
        const result = await updateCampaignConfigurationAction(campaignId, { layoutId: value }, request.origin);
        if (result.error) {
          notifications.show({ message: result.error, tone: 'danger' });
        } else {
          updated = true;
          request.acknowledge({ layoutId: value }, { authoritative: false });
          publishEditorEntityChange(`campaign:${campaignId}`, request.origin);
        }
      } finally {
        request.finish();
        await refetchCampaignFields();
      }
      if (updated && preview.showPreview) {
        void preview.scheduleRefresh();
      }
    },
    [beginConfigRequest, campaignId, canMutate, preview, refetchCampaignFields],
  );

  const handleRecipientScopeChange = useCallback(
    async (recipientScope: CampaignRecipientScopeValue) => {
      if (!canMutate) {
        return;
      }
      const request = beginConfigRequest(['recipientScope']);
      try {
        const result = await updateCampaignConfigurationAction(campaignId, { recipientScope }, request.origin);
        if (result.error) {
          notifications.show({ message: result.error, tone: 'danger' });
        } else {
          request.acknowledge({ recipientScope }, { authoritative: false });
          publishEditorEntityChange(`campaign:${campaignId}`, request.origin);
        }
      } finally {
        request.finish();
        await refetchCampaignFields();
      }
    },
    [beginConfigRequest, campaignId, canMutate, refetchCampaignFields],
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

  const [preparingDelivery, setPreparingDelivery] = useState({ test: false, send: false, schedule: false });
  const deliveryPreparationRef = useRef({ test: false, send: false, schedule: false });

  const handleSendTest = useCallback(() => {
    if (!testEmail) {
      return;
    }
    if (deliveryPreparationRef.current.test) {
      return;
    }
    deliveryPreparationRef.current.test = true;
    setPreparingDelivery((current) => ({ ...current, test: true }));
    void (async () => {
      try {
        if (!(await persistEditableCampaignBeforeDelivery())) {
          return;
        }
        sendTest.mutate({ email: testEmail, locale: testLocale });
      } finally {
        deliveryPreparationRef.current.test = false;
        setPreparingDelivery((current) => ({ ...current, test: false }));
      }
    })();
  }, [persistEditableCampaignBeforeDelivery, sendTest, testEmail, testLocale]);

  const handleSendAll = useCallback(() => {
    if (configuration.hasPending()) {
      return;
    }
    if (!deliveryTargetComplete) {
      notifications.show({ message: t('target.audienceRequired'), tone: 'danger' });
      return;
    }
    if (deliveryPreparationRef.current.send) {
      return;
    }
    deliveryPreparationRef.current.send = true;
    setPreparingDelivery((current) => ({ ...current, send: true }));
    void (async () => {
      try {
        if (!(await persistEditableCampaignBeforeDelivery())) {
          return;
        }
        if (configuration.hasPending()) {
          return;
        }
        sendCampaign.mutate(fields.recipientScope);
      } finally {
        deliveryPreparationRef.current.send = false;
        setPreparingDelivery((current) => ({ ...current, send: false }));
      }
    })();
  }, [
    configuration,
    deliveryTargetComplete,
    fields.recipientScope,
    persistEditableCampaignBeforeDelivery,
    sendCampaign,
    t,
  ]);

  const handleSchedule = useCallback(() => {
    if (configuration.hasPending()) {
      return;
    }
    const scheduledAt = dateTimeValueToDate(scheduleDate);
    if (!scheduledAt || !deliveryTargetComplete) {
      if (!deliveryTargetComplete) {
        notifications.show({ message: t('target.audienceRequired'), tone: 'danger' });
      }
      return;
    }
    if (deliveryPreparationRef.current.schedule) {
      return;
    }
    deliveryPreparationRef.current.schedule = true;
    setPreparingDelivery((current) => ({ ...current, schedule: true }));
    void (async () => {
      try {
        if (!(await persistEditableCampaignBeforeDelivery())) {
          return;
        }
        if (configuration.hasPending()) {
          return;
        }
        scheduleCampaign.mutate({
          scheduledAt,
          recipientScope: fields.recipientScope,
        });
      } finally {
        deliveryPreparationRef.current.schedule = false;
        setPreparingDelivery((current) => ({ ...current, schedule: false }));
      }
    })();
  }, [
    configuration,
    deliveryTargetComplete,
    fields.recipientScope,
    persistEditableCampaignBeforeDelivery,
    scheduleCampaign,
    scheduleDate,
    t,
  ]);

  const handleCancelSchedule = useCallback(() => {
    if (!accessInterruption.blocked) {
      cancelSchedule.mutate();
    }
  }, [accessInterruption.blocked, cancelSchedule]);

  if (isLoading) {
    return { kind: 'state' as const, content: <PageLoader /> };
  }

  if (campaignQuery.isError && !campaign) {
    return { kind: 'state' as const, content: <QueryErrorAlert queries={[campaignQuery]} /> };
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

  return {
    kind: 'ready' as const,
    localeErrorSurface: activeEditLocale.errorQuery ? (
      <QueryErrorAlert queries={[activeEditLocale.errorQuery]} />
    ) : null,
    currentProvider,
    campaignId,
    protocol,
    campaignQuery,
    campaignName,
    isEditable,
    canMutate,
    campaign,
    statusOptions,
    isConnected,
    isSynced,
    handleBack,
    t,
    tAnalytics,
    router,
    tActions,
    openTestModal,
    canSchedule,
    hasPendingCampaignConfiguration,
    preparingDelivery,
    currentSubject,
    deliveryTargetComplete,
    openScheduleModal,
    canSendNow,
    openSendModal,
    isScheduled,
    cancelSchedule,
    handleCancelSchedule,
    tLabels,
    handleSubjectChange,
    canEditLocalizedSubject,
    activeEditLocale,
    handleActiveLocaleChange,
    fields,
    segments,
    segmentsLoading,
    segmentsLoadError,
    handleTargetChange,
    layouts,
    handleLayoutChange,
    layoutsLoadError,
    layoutsLoading,
    tStates,
    handleRecipientScopeChange,
    preview,
    viewModeOptions,
    editorSession,
    testModalOpened,
    testEmail,
    testLocale,
    supportedLocaleOptions,
    activePreviewLocale,
    sendTest,
    tCommonPlaceholders,
    closeTestModal,
    setTestEmail,
    setTestLocale,
    handleSendTest,
    sendModalOpened,
    sendCampaign,
    selectedSegmentName,
    closeSendModal,
    handleSendAll,
    scheduleModalOpened,
    currentLocale,
    scheduleDate,
    scheduleCampaign,
    closeScheduleModal,
    setScheduleDate,
    handleSchedule,
    accessInterruption,
  };
}

type CampaignEditPageControllerModel = ReturnType<typeof useCampaignEditPageModel>;
type CampaignEditPageReadyModel = Extract<CampaignEditPageControllerModel, { kind: 'ready' }>;
export type CampaignEditPageViewModel =
  | Exclude<CampaignEditPageControllerModel, { kind: 'ready' }>
  | (Omit<
      CampaignEditPageReadyModel,
      | 'campaignQuery'
      | 'campaignName'
      | 'campaign'
      | 'cancelSchedule'
      | 'sendTest'
      | 'sendCampaign'
      | 'scheduleCampaign'
      | 'preview'
      | 'editorSession'
      | 'localeErrorSurface'
    > & {
      localeErrorSurface: import('react').ReactNode;
      campaignQuery: import('react').ComponentProps<typeof QueryErrorAlert>['queries'][number];
      campaignName:
        | Pick<NonNullable<CampaignEditPageReadyModel['campaignName']>, 'name' | 'changeName' | 'pending'>
        | Extract<CampaignEditPageReadyModel['campaignName'], null | undefined>;
      campaign:
        | Pick<NonNullable<CampaignEditPageReadyModel['campaign']>, 'status'>
        | Extract<CampaignEditPageReadyModel['campaign'], null | undefined>;
      cancelSchedule:
        | Pick<NonNullable<CampaignEditPageReadyModel['cancelSchedule']>, 'isPending'>
        | Extract<CampaignEditPageReadyModel['cancelSchedule'], null | undefined>;
      sendTest:
        | Pick<NonNullable<CampaignEditPageReadyModel['sendTest']>, 'isPending'>
        | Extract<CampaignEditPageReadyModel['sendTest'], null | undefined>;
      sendCampaign:
        | Pick<NonNullable<CampaignEditPageReadyModel['sendCampaign']>, 'isPending'>
        | Extract<CampaignEditPageReadyModel['sendCampaign'], null | undefined>;
      scheduleCampaign:
        | Pick<NonNullable<CampaignEditPageReadyModel['scheduleCampaign']>, 'isPending'>
        | Extract<CampaignEditPageReadyModel['scheduleCampaign'], null | undefined>;
      preview:
        | Pick<
            NonNullable<CampaignEditPageReadyModel['preview']>,
            | 'viewMode'
            | 'changeViewMode'
            | 'showEditor'
            | 'editorReady'
            | 'editorContentChanged'
            | 'showPreview'
            | 'query'
            | 'previewSrcDoc'
          >
        | Extract<CampaignEditPageReadyModel['preview'], null | undefined>;
      editorSession: {
        provider: import('@/lib/collab/collaboration-awareness-provider').CollaborationAwarenessProvider;
        controller: import('@/features/editor/tiptap/block-room-tiptap-controller').RichTextBlockRoomTiptapController;
      } | null;
    });
export function CampaignEditPageView({ model }: { model: CampaignEditPageViewModel }) {
  if (model.kind !== 'ready') {
    return model.content;
  }
  const {
    localeErrorSurface,
    currentProvider,
    campaignId,
    protocol,
    campaignQuery,
    campaignName,
    isEditable,
    canMutate,
    campaign,
    statusOptions,
    isConnected,
    isSynced,
    handleBack,
    t,
    tAnalytics,
    router,
    tActions,
    openTestModal,
    canSchedule,
    hasPendingCampaignConfiguration,
    preparingDelivery,
    currentSubject,
    deliveryTargetComplete,
    openScheduleModal,
    canSendNow,
    openSendModal,
    isScheduled,
    cancelSchedule,
    handleCancelSchedule,
    tLabels,
    handleSubjectChange,
    canEditLocalizedSubject,
    activeEditLocale,
    handleActiveLocaleChange,
    fields,
    segments,
    segmentsLoading,
    segmentsLoadError,
    handleTargetChange,
    layouts,
    handleLayoutChange,
    layoutsLoadError,
    layoutsLoading,
    tStates,
    handleRecipientScopeChange,
    preview,
    viewModeOptions,
    editorSession,
    testModalOpened,
    testEmail,
    testLocale,
    supportedLocaleOptions,
    activePreviewLocale,
    sendTest,
    tCommonPlaceholders,
    closeTestModal,
    setTestEmail,
    setTestLocale,
    handleSendTest,
    sendModalOpened,
    sendCampaign,
    selectedSegmentName,
    closeSendModal,
    handleSendAll,
    scheduleModalOpened,
    currentLocale,
    scheduleDate,
    scheduleCampaign,
    closeScheduleModal,
    setScheduleDate,
    handleSchedule,
    accessInterruption,
  } = model;
  return (
    <EditorRuntimeProvider
      provider={currentProvider}
      entityType="campaign"
      entityId={campaignId}
      blockRoomProtocol={protocol}
    >
      <QueryErrorAlert queries={[campaignQuery]} />
      {localeErrorSurface}
      <DsLayoutStack fill="block" gap="md">
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
              disabled: accessInterruption.blocked,
              onClick: openTestModal,
            },
            ...(canSchedule
              ? [
                  {
                    key: 'schedule',
                    label: tActions('schedule'),
                    icon: <IconCalendar size={16} />,
                    emphasis: 'medium' as const,
                    disabled:
                      accessInterruption.blocked ||
                      hasPendingCampaignConfiguration ||
                      !currentSubject.trim() ||
                      !deliveryTargetComplete,
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
                    disabled:
                      accessInterruption.blocked ||
                      hasPendingCampaignConfiguration ||
                      !currentSubject.trim() ||
                      !deliveryTargetComplete,
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
                    disabled: accessInterruption.blocked,
                    onClick: handleCancelSchedule,
                  },
                ]
              : []),
          ]}
        />

        <DsLayoutInline align="end" wrap="wrap">
          <div style={{ minWidth: 260, flex: 1 }}>
            <TextInput
              grow
              label={tLabels('subject')}
              value={currentSubject}
              onChange={(event) => handleSubjectChange(event.currentTarget.value)}
              disabled={!canEditLocalizedSubject}
            />
          </div>
          {activeEditLocale.isControlVisible ? (
            <div style={{ width: 220 }}>
              <TranslationLocaleControl
                variant="select"
                label={tLabels('language')}
                value={activeEditLocale.activeLocale}
                options={activeEditLocale.localeOptions}
                sourceLocale={activeEditLocale.sourceLocale}
                loading={activeEditLocale.localeChanging}
                disabled={activeEditLocale.isLoading}
                onChange={handleActiveLocaleChange}
              />
            </div>
          ) : null}
          {isEditable ? (
            <>
              <div style={{ width: 250 }}>
                <CampaignTargetControl
                  targetMode={fields.targetMode}
                  segmentId={fields.segmentId}
                  audiences={segments ?? []}
                  disabled={!canMutate || segmentsLoading}
                  loadError={segmentsLoadError}
                  onChange={handleTargetChange}
                />
              </div>
              <div style={{ width: 200 }}>
                <Select
                  placeholder={layoutsLoading ? tStates('loading') : t('layout.none')}
                  aria-busy={layoutsLoading}
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
                  disabled={!canMutate || layoutsLoading || layoutsLoadError}
                />
              </div>
              <div style={{ width: 260 }}>
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
              </div>
            </>
          ) : null}
          <DsLayoutInline flexible justify="end">
            <DsLayoutInset space="none">
              <IconViewModeControl
                value={preview.viewMode}
                onChange={preview.changeViewMode}
                options={viewModeOptions}
              />
            </DsLayoutInset>
          </DsLayoutInline>
        </DsLayoutInline>

        <DsLayoutGrid columns={preview.viewMode === 'split' ? { base: 1, sm: 2 } : 1} gap="md">
          {preview.showEditor &&
            (editorSession ? (
              <CampaignEditor
                accessibleLabel={tLabels('content')}
                contentLanguage={activePreviewLocale}
                campaignId={campaignId}
                provider={editorSession.provider}
                blockRoomController={editorSession.controller}
                editable={canEditLocalizedSubject}
                structureLocked={!activeEditLocale.isSourceLocale}
                onEditorReady={preview.editorReady}
                onContentChange={preview.editorContentChanged}
              />
            ) : (
              <PageLoader placement="flow" message={tStates('connectingEditor')} />
            ))}

          {preview.showPreview && (
            <DsLayoutInset space="none" flexible aria-busy={preview.query.isFetching}>
              <QueryErrorAlert queries={[preview.query]} />
              {preview.previewSrcDoc && preview.query.isFetching ? (
                <SupportingText role="status" tone="secondary">
                  {tStates('loadingPreview')}
                </SupportingText>
              ) : null}
              {preview.previewSrcDoc ? (
                <DsSectionCard padding="none" withBorder appearance="paper" clip>
                  <EmailPreviewFrame srcDoc={preview.previewSrcDoc} title={t('preview.frameTitle')} />
                </DsSectionCard>
              ) : preview.query.isFetching ? (
                <PageLoader placement="flow" message={tStates('loadingPreview')} />
              ) : preview.query.isError ? null : (
                <DsLayoutInset block="xl">
                  <SupportingText tone="secondary" align="center">
                    {t('preview.empty')}
                  </SupportingText>
                </DsLayoutInset>
              )}
            </DsLayoutInset>
          )}
        </DsLayoutGrid>

        <AuthoringExtension kind="translations">
          <EntityTranslationsPanel
            entityType="campaign"
            entityId={campaignId}
            canManage
            canMutateTargets={canMutate}
            canAdministerTranslations={canMutate}
          />
        </AuthoringExtension>

        <CampaignDeliveryDialogs
          readOnly={accessInterruption.blocked}
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
            pending: sendTest.isPending || preparingDelivery.test,
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
            pending: sendCampaign.isPending || preparingDelivery.send || hasPendingCampaignConfiguration,
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
            pending: scheduleCampaign.isPending || preparingDelivery.schedule || hasPendingCampaignConfiguration,
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
      </DsLayoutStack>
    </EditorRuntimeProvider>
  );
}
export default function CampaignEditPage(...args: Parameters<typeof useCampaignEditPageModel>) {
  return <CampaignEditPageView model={useCampaignEditPageModel(...args)} />;
}
