'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TranslationEntityType } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { IconChevronDown, IconChevronRight, IconCode, IconColumns2, IconEye } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Box, Collapse, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { EditorHeader } from '@/features/editor/EditorHeader';
import { TextInput } from '@/components/core/Input';
import { TextButton } from '@/components/core/TextButton';
import { PageLoader } from '@/features/site/PageLoader';
import { getEmailLayoutActionErrorMessage } from '@/features/admin/email-layout/action-error-message';
import { EmailLayoutEditor } from '@/features/admin/email-layout/EmailLayoutEditor';
import { EmailLayoutPreview } from '@/features/admin/email-layout/EmailLayoutPreview';
import { EmailLayoutTargetEditor } from '@/features/admin/email-layout/EmailLayoutTargetEditor';
import { IconViewModeControl } from '@/features/admin/IconViewModeControl';
import { EmailEntityTranslationsPanel } from '@/features/translation/EmailEntityTranslationsPanel';
import { TranslationLocaleControl } from '@/features/translation/TranslationLocaleControl';
import { useActiveEditLocale } from '@/features/translation/useActiveEditLocale';
import { updateEmailLayoutAction, type EmailLayoutActionErrorCode } from '@/lib/actions/email-layout';
import { createTranslationClient } from '@/lib/api/browser-client';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import { normalizeLocale } from '@/lib/i18n/locale';
import { getEmailLayout } from '@/lib/queries/email-layout';
import { guardNotFound } from '@/lib/utils/not-found-guard';
import { useEmailLayoutCollaboration } from '@/features/translation/useSourceDocumentCollaboration';
import { resolveLocaleRoomLocale } from '@/features/translation/locale-document-mode';

type ViewMode = 'split' | 'code' | 'preview';

const TITLE_DEBOUNCE_MS = 500;
const KEY_DEBOUNCE_MS = 500;

export default function EmailLayoutEditPage() {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const tPage = useTranslations('adminList.emailLayouts.detail');
  const currentLocale = useLocale();
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const layoutId = params.id as string;
  const translationClient = useMemo(() => createTranslationClient(), []);

  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [title, setTitle] = useState('');
  const [key, setKey] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [variablesExpanded, setVariablesExpanded] = useState(false);
  const variablesPanelId = `email-layout-variables-${layoutId}`;
  const emailLayoutErrorMessage = (result: { error?: string; errorCode?: EmailLayoutActionErrorCode }) =>
    getEmailLayoutActionErrorMessage({
      errorCode: result.errorCode,
      fallbackError: result.error,
      unauthorizedMessage: tCommon('errors.unauthorized'),
      duplicateKeyMessage: tCommon('errors.entityWithThisKeyAlreadyExists', {
        entity: tCommonEntities('emailLayout'),
      }),
      notFoundMessage: tCommon('errors.entityNotFound', {
        entity: tCommonEntities('emailLayout'),
      }),
      genericMessage: tCommon('errors.generic'),
    });

  const viewModeOptions = useMemo(
    () => [
      {
        value: 'split' as const,
        icon: <IconColumns2 size={16} />,
        tooltip: tPage('viewModes.split'),
      },
      {
        value: 'code' as const,
        icon: <IconCode size={16} />,
        tooltip: tPage('viewModes.code'),
      },
      {
        value: 'preview' as const,
        icon: <IconEye size={16} />,
        tooltip: tCommonLabels('preview'),
      },
    ],
    [tCommonLabels, tPage],
  );

  const layoutVariables = [
    {
      name: 'content',
      description: tPage('variables.items.content'),
    },
    { name: 'subject', description: tPage('variables.items.subject') },
    { name: 'site_name', description: tPage('variables.items.siteName') },
    { name: 'site_origin', description: tPage('variables.items.siteOrigin') },
    { name: 'logo_email_url', description: tPage('variables.items.logoEmailUrl') },
    { name: 'email_lang', description: tPage('variables.items.emailLang') },
    { name: 'email_direction', description: tPage('variables.items.emailDirection') },
    { name: 'email_font_family', description: tPage('variables.items.emailFontFamily') },
    {
      name: 'email_font_stylesheet_url',
      description: tPage('variables.items.emailFontStylesheetUrl'),
    },
    { name: 'recipient_name', description: tPage('variables.items.recipientName') },
    { name: 'recipient_email', description: tPage('variables.items.recipientEmail') },
    { name: 'unsubscribe_link', description: tPage('variables.items.unsubscribeLink') },
  ];

  const { data: layout, isLoading } = useQuery({
    queryKey: ['emailLayouts', layoutId],
    queryFn: () => getEmailLayout(layoutId),
  });

  const translationEntriesQuery = useQuery({
    queryKey: ['entity-translations-preview-source-locale', 'email_layout', layoutId],
    queryFn: async () =>
      translationClient.listEntityTranslations({
        target: {
          entityType: TranslationEntityType.EMAIL_LAYOUT,
          entityId: layoutId,
        },
      }),
  });

  const activeEditLocale = useActiveEditLocale({
    entityType: 'email_layout',
    entityId: layoutId,
    sourceTitle: layout?.name ?? '',
    sourceSummary: '',
    initialSourceLocale: translationEntriesQuery.data?.sourceLocale ?? null,
    enabled: Boolean(layout),
  });
  const roomLocale = resolveLocaleRoomLocale({
    activeLocale: activeEditLocale.activeLocale,
    sourceLocale: activeEditLocale.sourceLocale,
    isSourceLocale: activeEditLocale.isSourceLocale,
    hasLiveRow: activeEditLocale.hasLiveRow,
    isSourceLocaleReady: activeEditLocale.isSourceLocaleReady,
  });
  const layoutRoom = useEmailLayoutCollaboration(layoutId, roomLocale);
  const currentProvider = layoutRoom.provider;
  const currentDoc = layoutRoom.doc;
  const isConnected = layoutRoom.isConnected;
  const isSynced = layoutRoom.isSynced;
  const targetPreviewKey = useMemo(
    () =>
      JSON.stringify(layoutRoom.targetUnits.map((unit) => [unit.handle, unit.localeValuePresent, unit.value] as const)),
    [layoutRoom.targetUnits],
  );
  const canEditTranslationSource = true;
  const canEditCurrentLocale = canEditTranslationSource && activeEditLocale.canEditActiveLocale && isSynced;

  useEffect(() => {
    if (layout) {
      setTitle(layout.name);
    }
  }, [layout]);

  useEffect(() => {
    if (layout && activeEditLocale.isSourceLocale) {
      setHtmlContent(layout.htmlContent);
      return;
    }

    if (!activeEditLocale.isSourceLocale && activeEditLocale.hasLiveRow) {
      setHtmlContent(activeEditLocale.contentHtml ?? '');
      return;
    }

    setHtmlContent('');
  }, [activeEditLocale.contentHtml, activeEditLocale.hasLiveRow, activeEditLocale.isSourceLocale, layout]);

  useEffect(() => {
    if (layout) {
      setKey(layout.key);
    }
  }, [layout]);

  const updateLayoutMutation = useMutation({
    mutationFn: (data: { key?: string; name?: string }) => updateEmailLayoutAction(layoutId, data),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: emailLayoutErrorMessage(result), color: 'red' });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['emailLayouts'] });
      queryClient.invalidateQueries({ queryKey: ['emailLayouts', layoutId] });
    },
  });

  const saveTitleDebounced = useDebouncedCallback(
    (value: string) => {
      if (value === layout?.name) {
        return;
      }
      updateLayoutMutation.mutate({ name: value });
    },
    { delay: TITLE_DEBOUNCE_MS, flushOnUnmount: true },
  );

  const saveKeyDebounced = useDebouncedCallback(
    (value: string) => {
      if (value === layout?.key) {
        return;
      }
      updateLayoutMutation.mutate({ key: value });
    },
    { delay: KEY_DEBOUNCE_MS, flushOnUnmount: true },
  );

  const handleTitleChange = useCallback(
    (value: string) => {
      setTitle(value);
      saveTitleDebounced(value);
    },
    [saveTitleDebounced],
  );

  const handleKeyChange = useCallback(
    (value: string) => {
      setKey(value);
      saveKeyDebounced(value);
    },
    [saveKeyDebounced],
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

  if (isLoading) {
    return <PageLoader />;
  }

  guardNotFound(layout);

  const showEditor = viewMode === 'split' || viewMode === 'code';
  const showPreview = viewMode === 'split' || viewMode === 'preview';
  const activePreviewLocale =
    normalizeLocale(activeEditLocale.activeLocale) ??
    translationEntriesQuery.data?.sourceLocale ??
    normalizeLocale(currentLocale) ??
    'en';

  return (
    <EditorRuntimeProvider provider={currentProvider} entityType="email_layout" entityId={layoutId}>
      <Stack flex={1} gap="md" style={{ minHeight: 0 }}>
        <EditorHeader
          title={title}
          onTitleChange={activeEditLocale.isSourceLocale ? handleTitleChange : undefined}
          titleDisabled={!activeEditLocale.isSourceLocale}
          isConnected={isConnected}
          isSynced={isSynced}
          onBack={() => router.push('/admin/email-layouts')}
          backTooltip={tPage('backTooltip')}
        />

        <Group>
          <TextInput
            label={tCommon('labels.key')}
            value={key}
            onChange={(e) => handleKeyChange(e.currentTarget.value)}
            disabled={!activeEditLocale.isSourceLocale}
            style={{ width: 200 }}
            styles={{ input: { fontFamily: 'monospace' } }}
          />
          {activeEditLocale.isControlVisible ? (
            <TranslationLocaleControl
              variant="select"
              label={tCommon('labels.language')}
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

        <Paper withBorder p="xs">
          <TextButton
            appearance="default"
            size="xs"
            fullWidth
            display="flex"
            aria-expanded={variablesExpanded}
            aria-controls={variablesPanelId}
            onClick={() => setVariablesExpanded((prev) => !prev)}
          >
            <Group gap="xs">
              {variablesExpanded ? (
                <IconChevronDown size={14} opacity={0.5} />
              ) : (
                <IconChevronRight size={14} opacity={0.5} />
              )}
              <Text size="xs" c="dimmed">
                {tCommonLabels('availableVariables', { count: layoutVariables.length })}
              </Text>
            </Group>
          </TextButton>
          <Collapse id={variablesPanelId} expanded={variablesExpanded}>
            <Stack gap={4} mt="xs" pl="md">
              {layoutVariables.map((variable) => (
                <Group key={variable.name} gap="xs" wrap="nowrap">
                  <Text size="xs" ff="monospace" fw={500} style={{ minWidth: 190 }}>
                    {`{{${variable.name}}}`}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {variable.description}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Collapse>
        </Paper>

        <SimpleGrid
          cols={viewMode === 'split' ? { base: 1, sm: 2 } : 1}
          spacing="md"
          style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            height: '100%',
            gridTemplateRows: 'minmax(0, 1fr)',
          }}
        >
          {showEditor && (
            <Stack gap={0} style={{ minHeight: 0, minWidth: 0, height: '100%' }}>
              <Text size="xs" c="dimmed" mb={4}>
                {activeEditLocale.isSourceLocale ? tCommon('labels.htmlContent') : tPage('targetEditor.title')}
              </Text>
              <Box
                style={{
                  flex: 1,
                  minHeight: 0,
                  minWidth: 0,
                  overflow: 'hidden',
                }}
              >
                {currentProvider && currentDoc ? (
                  activeEditLocale.isSourceLocale ? (
                    <EmailLayoutEditor
                      key={`email-layout-${layoutId}-${roomLocale ?? 'fallback'}-${currentDoc.clientID}`}
                      provider={currentProvider}
                      doc={currentDoc}
                      isSynced={isSynced}
                      editable={canEditCurrentLocale}
                      initialContent={layout.htmlContent}
                      onChange={setHtmlContent}
                    />
                  ) : (
                    <EmailLayoutTargetEditor
                      units={layoutRoom.targetUnits}
                      editable={canEditCurrentLocale}
                      onChange={layoutRoom.setTargetValue}
                      onUseSource={layoutRoom.useSourceFallback}
                    />
                  )
                ) : (
                  <Box p="md">
                    <Text c="dimmed">{tCommon('states.connectingEditor')}</Text>
                  </Box>
                )}
              </Box>
            </Stack>
          )}

          {showPreview && (
            <Box style={{ minHeight: 0, minWidth: 0, height: '100%' }}>
              <EmailLayoutPreview
                layoutId={layoutId}
                htmlContent={htmlContent}
                refreshKey={activeEditLocale.isSourceLocale ? undefined : targetPreviewKey}
                locale={activePreviewLocale}
                sourceLocale={translationEntriesQuery.data?.sourceLocale}
                debounceMs={activeEditLocale.isSourceLocale ? undefined : 2500}
              />
            </Box>
          )}
        </SimpleGrid>

        <EmailEntityTranslationsPanel entityId={layoutId} />
      </Stack>
    </EditorRuntimeProvider>
  );
}
