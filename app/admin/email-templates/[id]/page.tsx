'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { LocalizedRichTextDocument } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { IconChevronDown, IconChevronRight, IconCode, IconColumns2, IconEye, IconTestPipe } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Box, Collapse, Group, Loader, Modal, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { useDebouncedCallback, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { EditorHeader } from '@/features/editor/EditorHeader';
import { Select, TextInput } from '@/components/core/Input';
import { TextButton } from '@/components/core/TextButton';
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
import { BlockRoomMetadataError, updateBlockRoomLocaleMetadata } from '@/lib/collab/block-room-metadata';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import { buildEmailPreviewSrcDoc } from '@/lib/email/preview-document';
import { resolveSystemEmailEventKey } from '@/lib/i18n/email-template';
import { getSupportedLocaleOptions, normalizeLocale } from '@/lib/i18n/locale';
import { listEmailLayoutsSimple } from '@/lib/queries/email-layout';
import { useRichTextBlockRoomController } from '@/features/editor/hooks/useBlockRoomTiptapController';
import { useBlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';
import { guardNotFound } from '@/lib/utils/not-found-guard';

type ViewMode = 'split' | 'code' | 'preview';

const PREVIEW_DEBOUNCE_MS = 300;

export default function EmailTemplateEditPage() {
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
  const [testEmail, setTestEmail] = useState('');
  const [testLocale, setTestLocale] = useState<string>(() => normalizeLocale(currentLocale) ?? 'en');
  const [variablesExpanded, setVariablesExpanded] = useState(false);
  const variablesPanelId = `email-template-variables-${templateId}`;
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewSubject, setPreviewSubject] = useState<string>('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
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
    (variableName: string): string | null => {
      const normalizedName = variableName.trim().toLowerCase();
      if (normalizedName === 'site_origin') {
        return tCommonLabels('siteOrigin');
      }
      if (normalizedName === 'logo_email_url') {
        return tEmailLayoutVariableItems('logoEmailUrl');
      }
      const lookupKey = normalizedName === 'confirm_link' ? 'confirm_url' : normalizedName;
      switch (lookupKey) {
        case 'name':
        case 'site_name':
        case 'recipient_name':
        case 'recipient_email':
        case 'confirm_url':
        case 'expires_in':
        case 'recover_url':
        case 'cancel_url':
        case 'scheduled_date':
        case 'grace_period':
        case 'login_url':
        case 'old_email':
        case 'new_email':
        case 'provider':
        case 'preview_url':
        case 'effective_date':
        case 'terms_url':
        case 'privacy_url':
        case 'verification_url':
        case 'verification_code':
        case 'expires_in_minutes':
        case 'login_code':
        case 'registration_code':
        case 'to':
        case 'identity_email':
        case 'identity_name':
          return tVariableCatalog(lookupKey);
        default:
          return null;
      }
    },
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
  const { data: template, isLoading } = useQuery({
    queryKey: ['emailTemplates', templateId],
    queryFn: () => getEmailTemplateAction(templateId),
  });
  useEffect(() => {
    if (template) {
      setLayoutId(template.layoutId ?? null);
    }
  }, [template]);

  const { data: layouts, isError: layoutsLoadError } = useQuery({
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
  const { provider, doc, bootstrap, protocol, isConnected, isSynced, acceptEpochAck, reloadCanonical } = blockRoom;
  const blockRoomController = useRichTextBlockRoomController('email-template', doc, roomLocale);
  const currentProvider = provider;
  const editorSession =
    currentProvider && blockRoomController && isSynced
      ? { provider: currentProvider, controller: blockRoomController }
      : null;
  const activeEditorLocale =
    normalizeLocale(activeEditLocale.activeLocale) ?? normalizeLocale(activeEditLocale.sourceLocale) ?? 'en';
  const previewSrcDoc = useMemo(
    () => buildEmailPreviewSrcDoc(previewHtml, activeEditorLocale),
    [activeEditorLocale, previewHtml],
  );
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
  const currentSubject = roomLocale ? residentSubject : (template?.subject ?? '');
  const canEditTranslationSource = true;
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

  useEffect(() => {
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
    mutationFn: (data: { id: string; layoutId: string | null }) =>
      updateEmailTemplateLayoutAction(data.id, data.layoutId),
  });

  const sendTest = useMutation({
    mutationFn: (data: { id: string; email: string; locale?: string | null }) =>
      sendTestEmailTemplateAction(data.id, data.email, data.locale),
    onSuccess: (result) => {
      if (result.success) {
        notifications.show({
          message: tCommonNotifications('testEmailSent'),
          color: 'green',
        });
        closeTestModal();
      } else {
        notifications.show({
          message: result.error || tEmailTemplates('detail.notifications.sendFailed'),
          color: 'red',
        });
      }
    },
    onError: (error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });

  const getDocumentSnapshot = useCallback(() => {
    if (!blockRoomController || !isSynced) {
      return undefined;
    }
    return blockRoomController.getLocalizedDocumentSnapshot();
  }, [blockRoomController, isSynced]);

  const loadPreview = useCallback(async (document?: LocalizedRichTextDocument) => {
    if (!previewParamsRef.current.hasTemplate) {
      return;
    }

    const { activeEditorLocale, layoutId, subject, templateId } = previewParamsRef.current;
    const requestedPreviewLocale = activeEditorLocale;
    const useActiveDraftOverrides = true;

    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    setIsPreviewLoading(true);

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

      setPreviewHtml('');
      setPreviewSubject('');
    } finally {
      if (requestId === previewRequestIdRef.current) {
        setIsPreviewLoading(false);
      }
    }
  }, []);

  const schedulePreviewRefresh = useDebouncedCallback(
    async () => {
      const document = getDocumentSnapshot();
      await loadPreview(document);
    },
    { delay: PREVIEW_DEBOUNCE_MS, flushOnUnmount: true },
  );
  const updateSubjectMetadata = useMutation({
    mutationFn: (input: { locale: string; subject: string }) => {
      if (!bootstrap || !protocol) {
        throw new Error('Email Template Block room is not ready.');
      }
      return updateBlockRoomLocaleMetadata(protocol, {
        type: 'email-template',
        ...input,
      });
    },
    onSuccess: acceptEpochAck,
    onError: (error) => {
      if (error instanceof BlockRoomMetadataError && error.reloadRequired) {
        reloadCanonical();
      }
      notifications.show({
        message: error instanceof Error ? error.message : tCommonNotifications('saveFailed'),
        color: 'red',
      });
    },
  });
  const debouncedSubjectUpdate = useDebouncedCallback(
    (input: { locale: string; subject: string }) => updateSubjectMetadata.mutate(input),
    500,
  );

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

  const handleSendTest = () => {
    if (!testEmail) {
      return;
    }
    sendTest.mutate({
      id: templateId,
      email: testEmail,
      locale: normalizeLocale(testLocale) ?? 'en',
    });
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
      if (layoutId === value) {
        return;
      }
      const previousLayoutId = layoutId;
      setLayoutId(value);
      updateLayout.mutate(
        { id: templateId, layoutId: value },
        {
          onSuccess: (result) => {
            if (!result.success) {
              setLayoutId(previousLayoutId);
              notifications.show({
                message: result.error || tEmailTemplates('detail.notifications.updateLayoutFailed'),
                color: 'red',
              });
            }
          },
          onError: (error) => {
            setLayoutId(previousLayoutId);
            notifications.show({ message: error.message, color: 'red' });
          },
        },
      );
      if (showPreview) {
        setIsPreviewLoading(true);
        void schedulePreviewRefresh();
      }
    },
    [layoutId, schedulePreviewRefresh, showPreview, tEmailTemplates, templateId, updateLayout],
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
    return <PageLoader />;
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

  return (
    <EditorRuntimeProvider
      provider={currentProvider}
      entityType="email_template"
      entityId={templateId}
      blockRoomProtocol={protocol}
    >
      <Stack flex={1} gap="md" style={{ minHeight: 0 }}>
        <EditorHeader
          title={displayTitle}
          isConnected={isConnected}
          isSynced={isSynced}
          onBack={() => router.push('/admin/email-templates')}
          backTooltip={tEmailTemplates('detail.backTooltip')}
          actionItems={[
            {
              key: 'send-test',
              label: tCommonActions('sendTest'),
              icon: <IconTestPipe size={16} />,
              onClick: openTestModal,
              emphasis: 'medium',
            },
          ]}
        />

        <Stack gap={4}>
          {displayDescription && (
            <Text size="sm" c="dimmed">
              {displayDescription}
            </Text>
          )}
          <Group gap="xs">
            <LabelBadge appearance="outline">{template.key}</LabelBadge>
            {template.isSystem && <LabelBadge tone="accent">{tEmailTemplates('badges.system')}</LabelBadge>}
          </Group>
        </Stack>

        <Group align="flex-end" wrap="wrap" justify="space-between">
          <TextInput
            label={tCommonLabels('subject')}
            placeholder={tEmailTemplates('detail.fields.subjectPlaceholder')}
            value={currentSubject}
            onChange={(e) => handleSubjectChange(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 260 }}
            disabled={!canEditLocalizedSubject}
          />
          <Select
            label={tEmailTemplates('detail.fields.layoutLabel')}
            placeholder={tEmailTemplates('detail.fields.layoutPlaceholder')}
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
            style={{ width: 260 }}
            error={layoutsLoadError ? tCommonStates('notAvailable') : undefined}
            disabled={layoutsLoadError || updateLayout.isPending}
          />
          {activeEditLocale.isControlVisible ? (
            <TranslationLocaleControl
              variant="select"
              label={tCommonLabels('language')}
              value={activeEditLocale.activeLocale}
              options={activeEditLocale.localeOptions}
              sourceLocale={activeEditLocale.sourceLocale}
              onChange={handleActiveLocaleChange}
              style={{ width: 220 }}
            />
          ) : null}
          <Box ml="auto">
            <IconViewModeControl value={viewMode} onChange={setViewMode} options={viewModeOptions} />
          </Box>
        </Group>

        {/* Available Variables */}
        {template.variables && template.variables.length > 0 && (
          <Paper withBorder p="xs">
            <TextButton
              appearance="default"
              size="xs"
              fullWidth
              display="flex"
              aria-expanded={variablesExpanded}
              aria-controls={variablesPanelId}
              onClick={() => setVariablesExpanded((expanded) => !expanded)}
            >
              <Group gap="xs">
                {variablesExpanded ? (
                  <IconChevronDown size={14} opacity={0.5} />
                ) : (
                  <IconChevronRight size={14} opacity={0.5} />
                )}
                <Text size="xs" c="dimmed">
                  {tCommonLabels('availableVariables', { count: template.variables.length })}
                </Text>
              </Group>
            </TextButton>
            <Collapse id={variablesPanelId} expanded={variablesExpanded}>
              <Stack gap={4} mt="xs" pl="md">
                {template.variables.map((v) => (
                  <Group key={v.name} gap="xs" wrap="nowrap">
                    <Text size="xs" ff="monospace" fw={500} style={{ minWidth: 140 }}>
                      {`{{${v.name.trim().toLowerCase()}}}`}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {getVariableDescription(v.name) ||
                        v.description ||
                        tEmailTemplates('detail.variables.noDescription')}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Collapse>
          </Paper>
        )}

        <SimpleGrid
          cols={viewMode === 'split' ? { base: 1, sm: 2 } : 1}
          spacing="md"
          style={{
            flex: 1,
            minHeight: 0,
            height: '100%',
            gridTemplateRows: 'minmax(0, 1fr)',
          }}
        >
          {showEditor && (
            <Stack gap={0} style={{ minHeight: 0, height: '100%' }}>
              <Text size="xs" c="dimmed" mb={4}>
                {tCommonLabels('content')}
              </Text>
              <Box
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflow: 'hidden',
                }}
              >
                {editorSession ? (
                  <EmailTemplateEditor
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
                  <Box p="md">
                    <Text c="dimmed">{tCommonStates('connectingEditor')}</Text>
                  </Box>
                )}
              </Box>
            </Stack>
          )}

          {showPreview && (
            <Stack gap={0} style={{ minHeight: 0, height: '100%' }}>
              <Group justify="space-between" mb={4}>
                <Text size="xs" c="dimmed">
                  {tCommonLabels('preview')}
                </Text>
                {isPreviewLoading && <Loader size={12} />}
              </Group>
              <Paper withBorder p="sm" bg="var(--mantine-color-gray-0)" mb="xs">
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" c="dimmed">
                    {tEmailTemplates('detail.preview.subjectLabel')}
                  </Text>
                  <Text size="sm" fw={500} truncate>
                    {previewSubject || currentSubject || tCommonStates('noSubject')}
                  </Text>
                </Group>
              </Paper>
              <Box
                style={{
                  flex: 1,
                  minHeight: 0,
                  border: '1px solid var(--mantine-color-default-border)',
                  borderRadius: 'var(--mantine-radius-default)',
                  overflow: 'hidden',
                  background: '#fff',
                }}
              >
                {previewSrcDoc ? (
                  <iframe
                    srcDoc={previewSrcDoc}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                    }}
                    title={tCommonLabels('emailPreview')}
                  />
                ) : (
                  <Stack align="center" justify="center" h="100%">
                    <Text c="dimmed">
                      {isPreviewLoading ? tCommonStates('loadingPreview') : tEmailTemplates('detail.preview.empty')}
                    </Text>
                  </Stack>
                )}
              </Box>
            </Stack>
          )}
        </SimpleGrid>

        <EntityTranslationsPanel entityType="email_template" entityId={templateId} />

        {/* Test Email Modal */}
        <Modal opened={testModalOpened} onClose={closeTestModal} title={tCommonActions('sendTestEmail')}>
          <Stack>
            <Text size="sm" c="dimmed">
              {tEmailTemplates('detail.modals.test.description')}
            </Text>
            <TextInput
              placeholder={tCommonPlaceholders('testEmailExample')}
              value={testEmail}
              onChange={(e) => setTestEmail(e.currentTarget.value)}
              type="email"
            />
            <TranslationLocaleControl
              variant="select"
              label={tEmailTemplates('detail.modals.test.localeLabel')}
              description={tEmailTemplates('detail.modals.test.localeHelp')}
              value={testLocale}
              options={supportedLocaleOptions}
              sourceLocale={activeEditLocale.sourceLocale}
              onChange={(value) => setTestLocale(value || 'en')}
              searchable
            />
            <Group justify="flex-end">
              <Button emphasis="low" onClick={closeTestModal}>
                {tCommonActions('cancel')}
              </Button>
              <Button onClick={handleSendTest} loading={sendTest.isPending} disabled={!testEmail}>
                {tCommonActions('sendTest')}
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </EditorRuntimeProvider>
  );
}
