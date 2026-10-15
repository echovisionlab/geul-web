'use client';

import { getEditorWriteToken } from '@/lib/editor/editor-write-origin';
import { useEditorAccessLevel } from '@/features/editor/useEditorAccessLevel';

import { AuthoringExtension } from '@/features/authoring/AuthoringExtensionsContext';
import { SupportingText, Text as DsText } from '@/components/core/Typography';

import { HierarchyIndent } from '@/components/core/Hierarchy';

import { SectionCard as DsSectionCard } from '@/components/core/Section/SectionCard';
import { Disclosure as DsDisclosure } from '@/components/core/Disclosure';
import {
  LayoutGrid as DsLayoutGrid,
  LayoutInline as DsLayoutInline,
  LayoutStack as DsLayoutStack,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TranslationEntityType } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { IconCode, IconColumns2, IconEye } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

import { useDebouncedCallback } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { EditorHeader } from '@/features/editor/EditorHeader';
import { TextInput } from '@/components/core/Input';

import { PageLoader } from '@/features/site/PageLoader';
import { getEmailLayoutActionErrorMessage } from '@/features/admin/email-layout/action-error-message';
import { EmailLayoutEditor } from '@/features/admin/email-layout/EmailLayoutEditor';
import { EmailLayoutPreview, type EmailLayoutPreviewBindings } from '@/features/admin/email-layout/EmailLayoutPreview';
import { EmailLayoutTargetEditor } from '@/features/admin/email-layout/EmailLayoutTargetEditor';
import { IconViewModeControl } from '@/features/admin/IconViewModeControl';
import { EmailEntityTranslationsPanel } from '@/features/translation/EmailEntityTranslationsPanel';
import { TranslationLocaleControl } from '@/features/translation/TranslationLocaleControl';
import { useActiveEditLocale } from '@/features/translation/useActiveEditLocale';
import { updateEmailLayoutAction, type EmailLayoutActionErrorCode } from '@/lib/actions/email-layout';
import { createTranslationClient } from '@/lib/api/browser/secure-translation';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import { normalizeLocale } from '@/lib/i18n/locale';
import { getEmailLayout } from '@/lib/queries/email-layout';
import { guardNotFound } from '@/lib/utils/not-found-guard';
import { useEmailLayoutCollaboration } from '@/features/translation/useSourceDocumentCollaboration';
import { resolveLocaleRoomLocale } from '@/features/translation/locale-document-mode';

type ViewMode = 'split' | 'code' | 'preview';

const TITLE_DEBOUNCE_MS = 500;
const KEY_DEBOUNCE_MS = 500;

function useEmailLayoutEditPageModel() {
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

  const layoutQuery = useQuery({
    queryKey: ['emailLayouts', layoutId],
    queryFn: () => getEmailLayout(layoutId),
  });

  const { data: layout, isLoading } = layoutQuery;
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
  const canEditTranslationSource = useEditorAccessLevel(currentProvider) === 'edit';
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
    // Bound to the member whose edit this is: a write flushed after an account switch is refused.
    mutationFn: (data: { key?: string; name?: string }) =>
      updateEmailLayoutAction(layoutId, data, getEditorWriteToken()),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: emailLayoutErrorMessage(result), tone: 'danger' });
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
      if (!canEditTranslationSource) {
        return;
      }
      setTitle(value);
      saveTitleDebounced(value);
    },
    [canEditTranslationSource, saveTitleDebounced],
  );

  const handleKeyChange = useCallback(
    (value: string) => {
      if (!canEditTranslationSource) {
        return;
      }
      setKey(value);
      saveKeyDebounced(value);
    },
    [canEditTranslationSource, saveKeyDebounced],
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
    return { kind: 'state' as const, content: <PageLoader /> };
  }

  if (layoutQuery.isError && !layout) {
    return { kind: 'state' as const, content: <QueryErrorAlert queries={[layoutQuery]} /> };
  }
  guardNotFound(layout);

  const showEditor = viewMode === 'split' || viewMode === 'code';
  const showPreview = viewMode === 'split' || viewMode === 'preview';
  const activePreviewLocale =
    normalizeLocale(activeEditLocale.activeLocale) ??
    translationEntriesQuery.data?.sourceLocale ??
    normalizeLocale(currentLocale) ??
    'en';

  return {
    kind: 'ready' as const,
    currentProvider,
    layoutId,
    title,
    activeEditLocale,
    handleTitleChange,
    isConnected,
    isSynced,
    router,
    tPage,
    tCommon,
    key,
    handleKeyChange,
    handleActiveLocaleChange,
    viewMode,
    setViewMode,
    viewModeOptions,
    variablesExpanded,
    setVariablesExpanded,
    tCommonLabels,
    layoutVariables,
    showEditor,
    currentDoc,
    roomLocale,
    canEditTranslationSource,
    canEditCurrentLocale,
    layout,
    setHtmlContent,
    layoutRoom,
    showPreview,
    htmlContent,
    targetPreviewKey,
    activePreviewLocale,
    translationEntriesQuery,
  };
}

type EmailLayoutEditPageControllerModel = ReturnType<typeof useEmailLayoutEditPageModel>;
type EmailLayoutEditPageReadyModel = Extract<EmailLayoutEditPageControllerModel, { kind: 'ready' }>;
export type EmailLayoutEditPageViewModel =
  | Exclude<EmailLayoutEditPageControllerModel, { kind: 'ready' }>
  | (Omit<EmailLayoutEditPageReadyModel, 'layout' | 'layoutRoom' | 'translationEntriesQuery'> & {
      layout:
        | Pick<NonNullable<EmailLayoutEditPageReadyModel['layout']>, 'htmlContent'>
        | Extract<EmailLayoutEditPageReadyModel['layout'], null | undefined>;
      layoutRoom:
        | Pick<
            NonNullable<EmailLayoutEditPageReadyModel['layoutRoom']>,
            'targetUnits' | 'setTargetValue' | 'useSourceFallback'
          >
        | Extract<EmailLayoutEditPageReadyModel['layoutRoom'], null | undefined>;
      translationEntriesQuery:
        | Pick<NonNullable<EmailLayoutEditPageReadyModel['translationEntriesQuery']>, 'data'>
        | Extract<EmailLayoutEditPageReadyModel['translationEntriesQuery'], null | undefined>;
    });
export function EmailLayoutEditPageView({
  model,
  previewBindings,
}: {
  model: EmailLayoutEditPageViewModel;
  previewBindings?: EmailLayoutPreviewBindings;
}) {
  if (model.kind !== 'ready') {
    return model.content;
  }
  const {
    currentProvider,
    layoutId,
    title,
    activeEditLocale,
    handleTitleChange,
    isConnected,
    isSynced,
    router,
    tPage,
    tCommon,
    key,
    handleKeyChange,
    handleActiveLocaleChange,
    viewMode,
    setViewMode,
    viewModeOptions,
    variablesExpanded,
    setVariablesExpanded,
    tCommonLabels,
    layoutVariables,
    showEditor,
    currentDoc,
    roomLocale,
    canEditTranslationSource,
    canEditCurrentLocale,
    layout,
    setHtmlContent,
    layoutRoom,
    showPreview,
    htmlContent,
    targetPreviewKey,
    activePreviewLocale,
    translationEntriesQuery,
  } = model;
  return (
    <EditorRuntimeProvider provider={currentProvider} entityType="email_layout" entityId={layoutId}>
      <DsLayoutStack flexible gap="md">
        <EditorHeader
          title={title}
          onTitleChange={canEditTranslationSource && activeEditLocale.isSourceLocale ? handleTitleChange : undefined}
          titleDisabled={!canEditTranslationSource || !activeEditLocale.isSourceLocale}
          isConnected={isConnected}
          isSynced={isSynced}
          onBack={() => router.push('/admin/email-layouts')}
          backTooltip={tPage('backTooltip')}
        />

        <DsLayoutInline>
          <div style={{ width: 200 }}>
            <TextInput
              textRole="code"
              label={tCommon('labels.key')}
              value={key}
              onChange={(e) => handleKeyChange(e.currentTarget.value)}
              disabled={!canEditTranslationSource || !activeEditLocale.isSourceLocale}
            />
          </div>
          {activeEditLocale.isControlVisible ? (
            <div style={{ width: 220 }}>
              <TranslationLocaleControl
                variant="select"
                label={tCommon('labels.language')}
                value={activeEditLocale.activeLocale}
                options={activeEditLocale.localeOptions}
                sourceLocale={activeEditLocale.sourceLocale}
                onChange={handleActiveLocaleChange}
              />
            </div>
          ) : null}
          <div style={{ marginInlineStart: 'auto' }}>
            <IconViewModeControl value={viewMode} onChange={setViewMode} options={viewModeOptions} />
          </div>
        </DsLayoutInline>

        <DsSectionCard padding="xs">
          <DsDisclosure
            opened={variablesExpanded}
            onChange={setVariablesExpanded}
            density="compact"
            label={tCommonLabels('availableVariables', { count: layoutVariables.length })}
          >
            <DsLayoutInset blockStart="xs">
              <HierarchyIndent>
                <DsLayoutStack gap="xxs">
                  {layoutVariables.map((variable) => (
                    <DsLayoutGrid key={variable.name} columns={{ base: 1, md: 2 }} gap="xxs">
                      <div>
                        <DsText size="xs" font="mono" weight="medium" wrap="anywhere">
                          {`{{${variable.name}}}`}
                        </DsText>
                      </div>
                      <DsText size="xs" tone="secondary">
                        {variable.description}
                      </DsText>
                    </DsLayoutGrid>
                  ))}
                </DsLayoutStack>
              </HierarchyIndent>
            </DsLayoutInset>
          </DsDisclosure>
        </DsSectionCard>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            height: '100%',
          }}
        >
          <DsLayoutGrid
            columns={viewMode === 'split' ? { base: 1, sm: 2 } : 1}
            gap="md"
            fill="both"
            flexible
            rows="stretch"
          >
            {showEditor && (
              <DsLayoutStack gap="none" fill="block">
                <DsLayoutInset blockEnd="xxs">
                  <DsText size="xs" tone="secondary">
                    {activeEditLocale.isSourceLocale ? tCommon('labels.htmlContent') : tPage('targetEditor.title')}
                  </DsText>
                </DsLayoutInset>
                <DsSectionCard padding="none" border="none" appearance="plain" grow clip>
                  {currentDoc ? (
                    activeEditLocale.isSourceLocale ? (
                      <EmailLayoutEditor
                        key={`email-layout-${layoutId}-${roomLocale ?? 'fallback'}-${currentDoc.clientID}`}
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
                    <DsSectionCard padding="md" border="none" appearance="plain">
                      <SupportingText tone="secondary">{tCommon('states.connectingEditor')}</SupportingText>
                    </DsSectionCard>
                  )}
                </DsSectionCard>
              </DsLayoutStack>
            )}

            {showPreview && (
              <div style={{ minHeight: 0, minWidth: 0, height: '100%' }}>
                <EmailLayoutPreview
                  layoutId={layoutId}
                  bindings={previewBindings}
                  htmlContent={htmlContent}
                  refreshKey={activeEditLocale.isSourceLocale ? undefined : targetPreviewKey}
                  locale={activePreviewLocale}
                  sourceLocale={translationEntriesQuery.data?.sourceLocale}
                  debounceMs={activeEditLocale.isSourceLocale ? undefined : 2500}
                />
              </div>
            )}
          </DsLayoutGrid>
        </div>

        <AuthoringExtension kind="translations">
          <EmailEntityTranslationsPanel entityId={layoutId} canEdit={canEditTranslationSource} />
        </AuthoringExtension>
      </DsLayoutStack>
    </EditorRuntimeProvider>
  );
}
export default function EmailLayoutEditPage(...args: Parameters<typeof useEmailLayoutEditPageModel>) {
  return <EmailLayoutEditPageView model={useEmailLayoutEditPageModel(...args)} />;
}
