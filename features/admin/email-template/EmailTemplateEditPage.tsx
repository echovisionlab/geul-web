'use client';

import { EmailPreviewFrame } from '@/features/email/EmailPreviewFrame';

import { useEditorAccessLevel } from '@/features/editor/useEditorAccessLevel';

import { describeEmailTemplateVariable } from './email-template-variable-description';
import { AuthoringExtension } from '@/features/authoring/AuthoringExtensionsContext';
import { Alert } from '@/components/core/Alert';
import { SupportingText, Text as DsText } from '@/components/core/Typography';

import { HierarchyIndent } from '@/components/core/Hierarchy';

import { SectionCard as DsSectionCard } from '@/components/core/Section/SectionCard';
import { Disclosure as DsDisclosure } from '@/components/core/Disclosure';
import {
  LayoutGrid as DsLayoutGrid,
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { LocalizedRichTextDocument } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { IconCode, IconColumns2, IconEye, IconTestPipe } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { ContentModal, DialogActions } from '@/components/core/Modal';
import { Spinner as Loader } from '@/components/core/Display';
import { useDebouncedCallback, useDisclosure } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { EditorHeader } from '@/features/editor/EditorHeader';
import { Select, TextInput } from '@/components/core/Input';

import { PageLoader } from '@/features/site/PageLoader';
import { IconViewModeControl } from '@/features/admin/IconViewModeControl';
import { EmailTemplateEditor } from '@/features/email/EmailTemplateEditor/EmailTemplateEditor';
import type { EmailCampaignTiptapEditorHandle } from '@/features/editor/tiptap/profiles/EmailTiptapEditor';
import { EntityTranslationsPanel } from '@/features/translation/EntityTranslationsPanel';
import { canEditLocaleDocumentField, resolveResidentLocaleField } from '@/features/translation/locale-display-fields';
import { TranslationLocaleControl } from '@/features/translation/TranslationLocaleControl';
import { useLocaleDocumentSession } from '@/features/translation/useLocaleDocumentSession';
import {
  getEmailTemplateAction,
  previewEmailTemplateAction,
  sendTestEmailTemplateAction,
  updateEmailTemplateLayoutAction,
} from '@/lib/actions/email-template';
import { updateBlockRoomLocaleMetadata } from '@/lib/collab/block-room-metadata';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import { flushEditorSavesOrNotify } from '@/lib/editor/flush-editor-saves-or-notify';
import { persistEditorDocumentBeforeAction } from '@/lib/editor/persist-editor-document-before-action';
import { publishEditorEntityChange, useEditorEntityChanges } from '@/lib/editor/editor-entity-changes';
import { useBlockRoomMetadataUpdates } from '@/lib/editor/useBlockRoomMetadataUpdates';
import { useAuthoritativeConfiguration } from '@/lib/editor/useAuthoritativeConfiguration';
import { useDebouncedRoomMetadata } from '@/lib/editor/useDebouncedRoomMetadata';
import { resolveSystemEmailEventKey } from '@/lib/i18n/email-template';
import { getSupportedLocaleOptions, normalizeLocale } from '@/lib/i18n/locale';
import { listEmailLayoutsSimple } from '@/lib/queries/email-layout';
import { useRichTextBlockRoomController } from '@/features/editor/hooks/useBlockRoomTiptapController';
import { useBlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';
import { guardNotFound } from '@/lib/utils/not-found-guard';

type ViewMode = 'split' | 'code' | 'preview';

const PREVIEW_DEBOUNCE_MS = 300;

function useEmailTemplateEditPageModel() {
  const tEmailTemplates = useTranslations('adminList.emailTemplates');
  const tEmailLayoutVariableItems = useTranslations('adminList.emailLayouts.detail.variables.items');
  const tSystemEvents = useTranslations('adminList.emailTemplates.systemEvents');
  const tEmailLayoutViewModes = useTranslations('adminList.emailLayouts.detail.viewModes');
  const tVariableCatalog = useTranslations('adminList.emailTemplates.detail.variables.catalog');
  const tCommonActions = useTranslations('common.actions');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonNotifications = useTranslations('common.notifications');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const tCommonStates = useTranslations('common.states');
  const currentLocale = useLocale();
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const configuration = useAuthoritativeConfiguration({
    document: `email_template:${templateId}`,
    initialConfiguration: { layoutId: null as string | null },
    onAdopt: (patch) => {
      if (Object.hasOwn(patch, 'layoutId')) {
        setLayoutId(patch.layoutId ?? null);
      }
    },
  });
  const initialConfigurationRead = useMemo(() => configuration.beginRead(), [configuration]);
  const [testEmail, setTestEmail] = useState('');
  const [testLocale, setTestLocale] = useState<string>(() => normalizeLocale(currentLocale) ?? 'en');
  const [variablesExpanded, setVariablesExpanded] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewSubject, setPreviewSubject] = useState<string>('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState(false);
  const previewMountedRef = useRef(true);
  useEffect(() => {
    previewMountedRef.current = true;
    return () => {
      previewMountedRef.current = false;
      previewRequestIdRef.current += 1;
    };
  }, []);
  const editorRef = useRef<EmailCampaignTiptapEditorHandle | null>(null);
  const previewRequestIdRef = useRef(0);
  const previewParamsRef = useRef({
    hasTemplate: false,
    subject: '',
    layoutId: null as string | null,
    activeEditorLocale: normalizeLocale(currentLocale) ?? 'en',
    sourceLocale: 'en',
    templateId,
  });
  const showEditor = viewMode === 'split' || viewMode === 'code';
  const showPreview = viewMode === 'split' || viewMode === 'preview';
  const getVariableDescription = useCallback(
    (variableName: string): string | null =>
      describeEmailTemplateVariable(variableName, {
        catalog: tVariableCatalog,
        siteOrigin: () => tCommonLabels('siteOrigin'),
        logoEmailUrl: () => tEmailLayoutVariableItems('logoEmailUrl'),
        logoEmailDarkUrl: () => tEmailLayoutVariableItems('logoEmailDarkUrl'),
      }),
    [tCommonLabels, tEmailLayoutVariableItems, tVariableCatalog],
  );

  const [testModalOpened, { open: openTestModal, close: closeTestModal }] = useDisclosure(false);
  const supportedLocaleOptions = useMemo(() => getSupportedLocaleOptions(), []);
  const viewModeOptions = useMemo(
    () => [
      {
        value: 'split' as const,
        icon: <IconColumns2 size={16} />,
        tooltip: tEmailTemplates('detail.viewModes.split'),
      },
      {
        value: 'code' as const,
        icon: <IconCode size={16} />,
        tooltip: tEmailLayoutViewModes('code'),
      },
      {
        value: 'preview' as const,
        icon: <IconEye size={16} />,
        tooltip: tCommonLabels('preview'),
      },
    ],
    [tCommonLabels, tEmailLayoutViewModes, tEmailTemplates],
  );
  const templateQuery = useQuery({
    queryKey: ['emailTemplates', templateId],
    queryFn: async () => {
      const read = configuration.beginRead();
      const template = await getEmailTemplateAction(templateId);
      if (template) {
        configuration.adoptRead(read, { layoutId: template.layoutId ?? null });
      }
      return template;
    },
  });
  const { data: template, isLoading, refetch: refetchTemplate } = templateQuery;
  useEffect(() => {
    if (template) {
      configuration.adoptRead(initialConfigurationRead, { layoutId: template.layoutId ?? null });
    }
  }, [configuration, initialConfigurationRead, template]);
  const refetchLayout = useCallback(async () => {
    await refetchTemplate();
  }, [refetchTemplate]);

  const {
    data: layouts,
    isError: layoutsLoadError,
    isLoading: layoutsLoading,
  } = useQuery({
    queryKey: ['emailLayouts', 'simple'],
    queryFn: listEmailLayoutsSimple,
  });

  const localeSession = useLocaleDocumentSession({
    entityType: 'email_template',
    entityId: templateId,
    sourceTitle: template?.subject ?? '',
    sourceSummary: '',
    enabled: Boolean(template),
  });
  const { activeEditLocale, roomLocale } = localeSession;
  const localeMode = localeSession.mode;
  const blockRoom = useBlockRoomConnection('email-template', templateId, roomLocale);
  const { provider, doc, bootstrap, protocol, isConnected, isSynced } = blockRoom;
  const blockRoomController = useRichTextBlockRoomController('email-template', doc, roomLocale);
  const currentProvider = provider;
  useEditorEntityChanges(
    `email_template:${templateId}`,
    () => {
      void refetchLayout();
    },
    currentProvider,
    undefined,
    configuration.captureOwnChange,
  );
  const editorSession =
    currentProvider && blockRoomController ? { provider: currentProvider, controller: blockRoomController } : null;
  const activeEditorLocale =
    normalizeLocale(activeEditLocale.activeLocale) ?? normalizeLocale(activeEditLocale.sourceLocale) ?? 'en';
  const [residentSubject, setResidentSubject] = useState('');
  useEffect(() => {
    setResidentSubject(
      resolveResidentLocaleField({
        isSourceLocale: activeEditLocale.isSourceLocale,
        hasLiveRow: activeEditLocale.hasLiveRow,
        sourceValue: template?.subject ?? '',
        localizedValue: activeEditLocale.displayTitle,
      }),
    );
  }, [activeEditLocale.displayTitle, activeEditLocale.hasLiveRow, activeEditLocale.isSourceLocale, template?.subject]);
  useBlockRoomMetadataUpdates(blockRoom, `email_template:${templateId}`, ({ operation, values }) => {
    if (operation === 'locale' && typeof values.subject === 'string') {
      setResidentSubject(values.subject);
    }
  });
  const currentSubject = roomLocale ? residentSubject : (template?.subject ?? '');
  const canEditTranslationSource = useEditorAccessLevel(provider) === 'edit';
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
    isLocaleDocumentSynced: Boolean(doc),
  });

  useEffect(() => {
    previewRequestIdRef.current += 1;
    previewParamsRef.current = {
      hasTemplate: Boolean(template),
      subject: currentSubject,
      layoutId,
      activeEditorLocale,
      sourceLocale: normalizeLocale(activeEditLocale.sourceLocale) ?? 'en',
      templateId,
    };
  }, [activeEditLocale.sourceLocale, activeEditorLocale, currentSubject, layoutId, template, templateId]);

  const updateLayout = useMutation({
    mutationFn: (data: { id: string; layoutId: string | null; origin: string }) =>
      updateEmailTemplateLayoutAction(data.id, data.layoutId, data.origin),
  });

  useEffect(() => {
    setPreviewHtml('');
    setPreviewSubject('');
    setPreviewError(false);
  }, [activeEditorLocale, templateId]);

  const sendTest = useMutation({
    mutationFn: (data: { id: string; email: string; locale?: string | null }) =>
      sendTestEmailTemplateAction(data.id, data.email, data.locale),
    onSuccess: (result) => {
      if (result.success) {
        notifications.show({
          message: tCommonNotifications('testEmailSent'),
          tone: 'positive',
        });
        closeTestModal();
      } else {
        notifications.show({
          message: result.error || tEmailTemplates('detail.notifications.sendFailed'),
          tone: 'danger',
        });
      }
    },
    onError: (error) => {
      notifications.show({ message: error.message, tone: 'danger' });
    },
  });

  const getDocumentSnapshot = useCallback(() => {
    if (!blockRoomController || !isSynced) {
      return undefined;
    }
    return blockRoomController.getLocalizedDocumentSnapshot();
  }, [blockRoomController, isSynced]);

  const loadPreview = useCallback(async (document?: LocalizedRichTextDocument) => {
    if (!previewMountedRef.current || !previewParamsRef.current.hasTemplate) {
      return;
    }

    const { activeEditorLocale, layoutId, subject, templateId } = previewParamsRef.current;
    const requestedPreviewLocale = activeEditorLocale;
    const useActiveDraftOverrides = true;

    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    setIsPreviewLoading(true);
    setPreviewError(false);

    try {
      const preview = await previewEmailTemplateAction({
        id: templateId,
        subject: useActiveDraftOverrides ? subject : undefined,
        document: useActiveDraftOverrides ? document : undefined,
        layoutId,
        locale: requestedPreviewLocale,
      });

      if (requestId !== previewRequestIdRef.current) {
        return;
      }

      if (preview) {
        setPreviewHtml(preview.html);
        setPreviewSubject(preview.subject);
        return;
      }

      setPreviewError(true);
    } catch {
      if (requestId === previewRequestIdRef.current) {
        setPreviewError(true);
      }
    } finally {
      if (requestId === previewRequestIdRef.current) {
        setIsPreviewLoading(false);
      }
    }
  }, []);

  const debouncedPreviewRefresh = useDebouncedCallback(
    async () => {
      const document = getDocumentSnapshot();
      await loadPreview(document);
    },
    { delay: PREVIEW_DEBOUNCE_MS, flushOnUnmount: false },
  );
  const schedulePreviewRefresh = useCallback(() => {
    previewRequestIdRef.current += 1;
    setIsPreviewLoading(true);
    return debouncedPreviewRefresh();
  }, [debouncedPreviewRefresh]);
  const debouncedSubjectUpdate = useDebouncedRoomMetadata({
    connection: blockRoom,
    document: `email_template:${templateId}`,
    write: (protocol, input: { locale: string; subject: string }) =>
      updateBlockRoomLocaleMetadata(protocol, { type: 'email-template', ...input }),
  });

  const handleSubjectChange = useCallback(
    (value: string) => {
      if (!canEditLocalizedSubject || !activeEditLocale.activeLocale) {
        return;
      }
      setResidentSubject(value);
      debouncedSubjectUpdate({ locale: activeEditLocale.activeLocale, subject: value });
      if (!showPreview) {
        return;
      }

      setIsPreviewLoading(true);
      void schedulePreviewRefresh();
    },
    [
      activeEditLocale.activeLocale,
      canEditLocalizedSubject,
      debouncedSubjectUpdate,
      schedulePreviewRefresh,
      showPreview,
    ],
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

  const [preparingTest, setPreparingTest] = useState(false);
  const preparingTestRef = useRef(false);
  const handleSendTest = () => {
    if (!canEditTranslationSource || !testEmail) {
      return;
    }
    if (preparingTestRef.current) {
      return;
    }
    preparingTestRef.current = true;
    setPreparingTest(true);
    void (async () => {
      try {
        if (
          !(await persistEditorDocumentBeforeAction({
            document: `email_template:${templateId}`,
            provider: currentProvider,
            requiresSync: localeMode.shouldUseLocaleDocument,
            isSynced,
            saveFailedMessage: tCommonNotifications('saveFailed'),
            syncingMessage: tCommonStates('syncing'),
            syncingTone: 'accent',
          }))
        ) {
          return;
        }
        sendTest.mutate({
          id: templateId,
          email: testEmail,
          locale: normalizeLocale(testLocale) ?? 'en',
        });
      } finally {
        preparingTestRef.current = false;
        setPreparingTest(false);
      }
    })();
  };

  useEffect(() => {
    if (!testModalOpened) {
      return;
    }
    setTestLocale(
      normalizeLocale(activeEditLocale.activeLocale) ?? normalizeLocale(activeEditLocale.sourceLocale) ?? 'en',
    );
  }, [activeEditLocale.activeLocale, activeEditLocale.sourceLocale, testModalOpened]);

  const handleEditorReady = useCallback(
    (editor: EmailCampaignTiptapEditorHandle) => {
      editorRef.current = editor;
      if (!showPreview) {
        return;
      }
      setIsPreviewLoading(true);
      void schedulePreviewRefresh();
    },
    [schedulePreviewRefresh, showPreview],
  );

  const handleEditorContentChange = useCallback(() => {
    if (!template || !showPreview) {
      return;
    }

    setIsPreviewLoading(true);
    void schedulePreviewRefresh();
  }, [schedulePreviewRefresh, showPreview, template]);

  const handleLayoutChange = useCallback(
    (value: string | null) => {
      if (!canEditTranslationSource || layoutId === value) {
        return;
      }
      const write = configuration.beginWrite(['layoutId']);
      setLayoutId(value);
      void (async () => {
        try {
          const result = await updateLayout.mutateAsync({ id: templateId, layoutId: value, origin: write.origin });
          if (!result.success) {
            notifications.show({
              message: result.error || tEmailTemplates('detail.notifications.updateLayoutFailed'),
              tone: 'danger',
            });
            return;
          }
          write.acknowledge({ layoutId: value }, { authoritative: false });
          publishEditorEntityChange(`email_template:${templateId}`, write.origin);
        } catch (error) {
          notifications.show({
            message:
              error instanceof Error ? error.message : tEmailTemplates('detail.notifications.updateLayoutFailed'),
            tone: 'danger',
          });
        } finally {
          write.fail();
          await refetchLayout();
        }
      })();
      if (showPreview) {
        setIsPreviewLoading(true);
        void schedulePreviewRefresh();
      }
    },
    [
      canEditTranslationSource,
      configuration,
      layoutId,
      refetchLayout,
      schedulePreviewRefresh,
      showPreview,
      tEmailTemplates,
      templateId,
      updateLayout,
    ],
  );

  useEffect(() => {
    if (!template || !showPreview) {
      return;
    }

    setIsPreviewLoading(true);
    void schedulePreviewRefresh();
  }, [
    activeEditLocale.activeLocale,
    activeEditLocale.sourceLocale,
    currentSubject,
    isSynced,
    schedulePreviewRefresh,
    showPreview,
    template,
  ]);

  useEffect(() => {
    if (!currentProvider || !blockRoomController) {
      editorRef.current = null;
    }
  }, [blockRoomController, currentProvider]);

  if (isLoading) {
    return { kind: 'state' as const, content: <PageLoader /> };
  }

  if (templateQuery.isError && !template) {
    return { kind: 'state' as const, content: <QueryErrorAlert queries={[templateQuery]} /> };
  }
  guardNotFound(template);

  const systemEventKey = resolveSystemEmailEventKey(template.eventKey ?? template.key);
  const systemEventMeta =
    template.isSystem && systemEventKey
      ? {
          name: tSystemEvents(`${systemEventKey}.name`),
          description: tSystemEvents(`${systemEventKey}.description`),
        }
      : null;
  const displayTitle = systemEventMeta?.name ?? template.name;
  const displayDescription = systemEventMeta?.description ?? template.description;

  // Extract variable names for display and editor
  const variableNames = Array.from(
    new Set(template.variables.map((v) => v.name.trim().toLowerCase()).filter((name) => name.length > 0)),
  );

  return {
    kind: 'ready' as const,
    localeErrorSurface: activeEditLocale.errorQuery ? (
      <QueryErrorAlert queries={[activeEditLocale.errorQuery]} />
    ) : null,
    currentProvider,
    templateId,
    protocol,
    displayTitle,
    isConnected,
    isSynced,
    tCommonNotifications,
    router,
    tEmailTemplates,
    tCommonActions,
    openTestModal,
    displayDescription,
    template,
    tCommonLabels,
    currentSubject,
    handleSubjectChange,
    canEditTranslationSource,
    canEditLocalizedSubject,
    layouts,
    layoutId,
    handleLayoutChange,
    layoutsLoadError,
    layoutsLoading,
    tCommonStates,
    updateLayout,
    activeEditLocale,
    handleActiveLocaleChange,
    viewMode,
    setViewMode,
    viewModeOptions,
    variablesExpanded,
    setVariablesExpanded,
    getVariableDescription,
    showEditor,
    editorSession,
    variableNames,
    handleEditorReady,
    handleEditorContentChange,
    showPreview,
    isPreviewLoading,
    previewError,
    previewSubject,
    previewSrcDoc: previewHtml,
    sendTest,
    preparingTest,
    testModalOpened,
    closeTestModal,
    tCommonPlaceholders,
    testEmail,
    setTestEmail,
    testLocale,
    supportedLocaleOptions,
    setTestLocale,
    handleSendTest,
  };
}

type EmailTemplateEditPageControllerModel = ReturnType<typeof useEmailTemplateEditPageModel>;
type EmailTemplateEditPageReadyModel = Extract<EmailTemplateEditPageControllerModel, { kind: 'ready' }>;
export type EmailTemplateEditPageViewModel =
  | Exclude<EmailTemplateEditPageControllerModel, { kind: 'ready' }>
  | (Omit<
      EmailTemplateEditPageReadyModel,
      'template' | 'updateLayout' | 'sendTest' | 'editorSession' | 'localeErrorSurface'
    > & {
      localeErrorSurface: import('react').ReactNode;
      template:
        | Pick<NonNullable<EmailTemplateEditPageReadyModel['template']>, 'key' | 'isSystem' | 'variables'>
        | Extract<EmailTemplateEditPageReadyModel['template'], null | undefined>;
      updateLayout:
        | Pick<NonNullable<EmailTemplateEditPageReadyModel['updateLayout']>, 'isPending'>
        | Extract<EmailTemplateEditPageReadyModel['updateLayout'], null | undefined>;
      sendTest:
        | Pick<NonNullable<EmailTemplateEditPageReadyModel['sendTest']>, 'isPending'>
        | Extract<EmailTemplateEditPageReadyModel['sendTest'], null | undefined>;
      editorSession: {
        provider: import('@/lib/collab/collaboration-awareness-provider').CollaborationAwarenessProvider;
        controller: import('@/features/editor/tiptap/block-room-tiptap-controller').RichTextBlockRoomTiptapController;
      } | null;
    });
export function EmailTemplateEditPageView({ model }: { model: EmailTemplateEditPageViewModel }) {
  if (model.kind !== 'ready') {
    return model.content;
  }
  const {
    localeErrorSurface,
    currentProvider,
    templateId,
    protocol,
    displayTitle,
    isConnected,
    isSynced,
    tCommonNotifications,
    router,
    tEmailTemplates,
    tCommonActions,
    openTestModal,
    displayDescription,
    template,
    tCommonLabels,
    currentSubject,
    handleSubjectChange,
    canEditTranslationSource,
    canEditLocalizedSubject,
    layouts,
    layoutId,
    handleLayoutChange,
    layoutsLoadError,
    layoutsLoading,
    tCommonStates,
    updateLayout,
    activeEditLocale,
    handleActiveLocaleChange,
    viewMode,
    setViewMode,
    viewModeOptions,
    variablesExpanded,
    setVariablesExpanded,
    getVariableDescription,
    showEditor,
    editorSession,
    variableNames,
    handleEditorReady,
    handleEditorContentChange,
    showPreview,
    isPreviewLoading,
    previewError,
    previewSubject,
    previewSrcDoc,
    sendTest,
    preparingTest,
    testModalOpened,
    closeTestModal,
    tCommonPlaceholders,
    testEmail,
    setTestEmail,
    testLocale,
    supportedLocaleOptions,
    setTestLocale,
    handleSendTest,
  } = model;
  return (
    <EditorRuntimeProvider
      provider={currentProvider}
      entityType="email_template"
      entityId={templateId}
      blockRoomProtocol={protocol}
    >
      <DsLayoutStack flexible gap="md">
        {localeErrorSurface}
        <EditorHeader
          title={displayTitle}
          isConnected={isConnected}
          isSynced={isSynced}
          onBack={() => {
            void (async () => {
              if (await flushEditorSavesOrNotify(`email_template:${templateId}`, tCommonNotifications('saveFailed'))) {
                router.push('/admin/email-templates');
              }
            })();
          }}
          backTooltip={tEmailTemplates('detail.backTooltip')}
          actionItems={[
            {
              key: 'send-test',
              disabled: !canEditTranslationSource,
              label: tCommonActions('sendTest'),
              icon: <IconTestPipe size={16} />,
              onClick: openTestModal,
              emphasis: 'medium',
            },
          ]}
        />

        <DsLayoutStack gap="xxs">
          {displayDescription && <SupportingText tone="secondary">{displayDescription}</SupportingText>}
          <DsLayoutInline gap="xs">
            <LabelBadge appearance="outline">{template.key}</LabelBadge>
            {template.isSystem && <LabelBadge tone="accent">{tEmailTemplates('badges.system')}</LabelBadge>}
          </DsLayoutInline>
        </DsLayoutStack>

        <DsLayoutInline align="end" wrap="wrap" justify="between">
          <div style={{ minWidth: 260, flex: 1 }}>
            <TextInput
              grow
              label={tCommonLabels('subject')}
              placeholder={tEmailTemplates('detail.fields.subjectPlaceholder')}
              value={currentSubject}
              onChange={(e) => handleSubjectChange(e.currentTarget.value)}
              disabled={!canEditLocalizedSubject}
            />
          </div>
          <div style={{ width: 260 }}>
            <Select
              label={tEmailTemplates('detail.fields.layoutLabel')}
              placeholder={
                layoutsLoading ? tCommonStates('loading') : tEmailTemplates('detail.fields.layoutPlaceholder')
              }
              aria-busy={layoutsLoading}
              data={
                layouts?.map((layout) => ({
                  value: layout.id,
                  label: layout.name,
                })) ?? []
              }
              value={layoutId}
              onChange={handleLayoutChange}
              clearable
              searchable
              nothingFoundMessage={tEmailTemplates('detail.fields.noLayouts')}
              error={layoutsLoadError ? tCommonStates('notAvailable') : undefined}
              disabled={!canEditTranslationSource || layoutsLoading || layoutsLoadError || updateLayout.isPending}
            />
          </div>
          {activeEditLocale.isControlVisible ? (
            <div style={{ width: 220 }}>
              <TranslationLocaleControl
                variant="select"
                label={tCommonLabels('language')}
                value={activeEditLocale.activeLocale}
                options={activeEditLocale.localeOptions}
                sourceLocale={activeEditLocale.sourceLocale}
                loading={activeEditLocale.localeChanging}
                disabled={activeEditLocale.isLoading}
                onChange={handleActiveLocaleChange}
              />
            </div>
          ) : null}
          <div style={{ marginInlineStart: 'auto' }}>
            <IconViewModeControl value={viewMode} onChange={setViewMode} options={viewModeOptions} />
          </div>
        </DsLayoutInline>

        {/* Available Variables */}
        {template.variables && template.variables.length > 0 && (
          <DsSectionCard padding="xs">
            <DsDisclosure
              opened={variablesExpanded}
              onChange={setVariablesExpanded}
              density="compact"
              label={tCommonLabels('availableVariables', { count: template.variables.length })}
            >
              <DsLayoutInset blockStart="xs">
                <HierarchyIndent>
                  <DsLayoutStack gap="xxs">
                    {template.variables.map((v) => (
                      <DsLayoutGrid key={v.name} columns={{ base: 1, md: 2 }} gap="xxs">
                        <div>
                          <DsText size="xs" font="mono" weight="medium" wrap="anywhere">
                            {`{{${v.name.trim().toLowerCase()}}}`}
                          </DsText>
                        </div>
                        <DsText size="xs" tone="secondary">
                          {getVariableDescription(v.name) ||
                            v.description ||
                            tEmailTemplates('detail.variables.noDescription')}
                        </DsText>
                      </DsLayoutGrid>
                    ))}
                  </DsLayoutStack>
                </HierarchyIndent>
              </DsLayoutInset>
            </DsDisclosure>
          </DsSectionCard>
        )}

        <div
          style={{
            minWidth: 0,
          }}
        >
          <DsLayoutGrid columns={viewMode === 'split' ? { base: 1, sm: 2 } : 1} gap="md">
            {showEditor && (
              <DsLayoutStack gap="none" fill="block">
                <DsLayoutInset blockEnd="xxs">
                  <DsText size="xs" tone="secondary">
                    {tCommonLabels('content')}
                  </DsText>
                </DsLayoutInset>
                <DsSectionCard padding="none" border="none" appearance="plain" grow>
                  {editorSession ? (
                    <EmailTemplateEditor
                      accessibleLabel={tCommonLabels('content')}
                      contentLanguage={
                        normalizeLocale(activeEditLocale.activeLocale) ??
                        normalizeLocale(activeEditLocale.sourceLocale) ??
                        'en'
                      }
                      key={`email-template-${templateId}-${activeEditLocale.activeLocale ?? 'source'}`}
                      templateId={templateId}
                      provider={editorSession.provider}
                      blockRoomController={editorSession.controller}
                      availableVariables={variableNames}
                      editable={canEditLocalizedSubject}
                      structureLocked={!activeEditLocale.isSourceLocale}
                      onEditorReady={handleEditorReady}
                      onContentChange={handleEditorContentChange}
                    />
                  ) : (
                    <DsSectionCard padding="md" border="none" appearance="plain">
                      <PageLoader placement="flow" message={tCommonStates('connectingEditor')} />
                    </DsSectionCard>
                  )}
                </DsSectionCard>
              </DsLayoutStack>
            )}

            {showPreview && (
              <DsLayoutStack gap="none">
                <DsLayoutInset blockEnd="xxs">
                  <DsLayoutInline justify="between">
                    <DsText size="xs" tone="secondary">
                      {tCommonLabels('preview')}
                    </DsText>
                    {isPreviewLoading && previewSrcDoc && <Loader size="xs" />}
                  </DsLayoutInline>
                </DsLayoutInset>
                <DsLayoutInset blockEnd="xs">
                  <DsSectionCard padding="sm" appearance="muted">
                    <DsLayoutInline gap="xs" wrap="nowrap">
                      <DsText size="sm" tone="secondary">
                        {tEmailTemplates('detail.preview.subjectLabel')}
                      </DsText>
                      <DsText size="sm" weight="medium" truncate>
                        {previewSubject || currentSubject || tCommonStates('noSubject')}
                      </DsText>
                    </DsLayoutInline>
                  </DsSectionCard>
                </DsLayoutInset>
                {previewError ? <Alert tone="danger">{tCommonStates('notAvailable')}</Alert> : null}
                <DsSectionCard padding="none" appearance="paper" grow clip aria-busy={isPreviewLoading}>
                  {previewSrcDoc ? (
                    <EmailPreviewFrame srcDoc={previewSrcDoc} title={tCommonLabels('emailPreview')} />
                  ) : isPreviewLoading ? (
                    <PageLoader placement="flow" message={tCommonStates('loadingPreview')} />
                  ) : previewError ? null : (
                    <DsLayoutStack align="center" justify="center" fill="block">
                      <SupportingText tone="secondary">{tEmailTemplates('detail.preview.empty')}</SupportingText>
                    </DsLayoutStack>
                  )}
                </DsSectionCard>
              </DsLayoutStack>
            )}
          </DsLayoutGrid>
        </div>

        <AuthoringExtension kind="translations">
          <EntityTranslationsPanel
            entityType="email_template"
            entityId={templateId}
            canAdministerTranslations={canEditTranslationSource}
            canMutateTargets={canEditTranslationSource}
          />
        </AuthoringExtension>

        {/* Test Email Modal */}
        <ContentModal
          closeLabel={tCommonActions('close')}
          loading={sendTest.isPending || preparingTest}
          opened={testModalOpened}
          onClose={closeTestModal}
          title={tCommonActions('sendTestEmail')}
        >
          <DsLayoutStack>
            <SupportingText tone="secondary">{tEmailTemplates('detail.modals.test.description')}</SupportingText>
            <TextInput
              grow
              aria-label={tCommonLabels('email')}
              placeholder={tCommonPlaceholders('testEmailExample')}
              disabled={!canEditTranslationSource}
              value={testEmail}
              onChange={(e) => setTestEmail(e.currentTarget.value)}
              type="email"
            />
            <TranslationLocaleControl
              variant="select"
              label={tEmailTemplates('detail.modals.test.localeLabel')}
              description={tEmailTemplates('detail.modals.test.localeHelp')}
              disabled={!canEditTranslationSource}
              value={testLocale}
              options={supportedLocaleOptions}
              sourceLocale={activeEditLocale.sourceLocale}
              onChange={(value) => setTestLocale(value || 'en')}
              searchable
            />
            <DialogActions>
              <Button emphasis="low" onClick={closeTestModal}>
                {tCommonActions('cancel')}
              </Button>
              <Button
                emphasis="strong"
                onClick={handleSendTest}
                loading={sendTest.isPending || preparingTest}
                disabled={!canEditTranslationSource || !testEmail}
              >
                {tCommonActions('sendTest')}
              </Button>
            </DialogActions>
          </DsLayoutStack>
        </ContentModal>
      </DsLayoutStack>
    </EditorRuntimeProvider>
  );
}
export default function EmailTemplateEditPage(...args: Parameters<typeof useEmailTemplateEditPageModel>) {
  return <EmailTemplateEditPageView model={useEmailTemplateEditPageModel(...args)} />;
}
