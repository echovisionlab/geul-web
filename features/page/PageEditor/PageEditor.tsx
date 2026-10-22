'use client';
import type { EditorSnapshot } from '@/features/editor/editor-snapshot';
import { EditorSnapshotHandoff } from '@/features/editor/EditorSnapshotHandoff';
import { PageEditorSnapshot } from './PageEditorSnapshot';

import { AuthoringExtension } from '@/features/authoring/AuthoringExtensionsContext';

import { DocumentEditorPanels } from '@/features/authoring/DocumentEditorPanels';
import { EditorSettingsSection } from '@/features/authoring/EditorSettingsSection';

import { Text as DsText } from '@/components/core/Typography';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconHistory } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { ScrollArea } from '@/components/core/Display';
import { Checkbox } from '@/components/core/Input';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { EditorHeader } from '@/features/editor/EditorHeader';
import { useEditorPermissionRevocation } from '@/features/editor/useEditorPermissionRevocation';
import { MediaPreviewGrid } from '@/components/core/MediaPreviewGrid';
import { OgImagePreview } from '@/features/metadata/OgImagePreview';
import { Button } from '@/components/core/Button';
import { SectionCard } from '@/components/core/Section';
import { ShareLinkSection } from '@/features/share/ShareLinkSection';
import { UrlSection } from '@/features/metadata/UrlSection';
import { VersionHistoryDrawer } from '@/features/version-history';
import type { DocumentLayout } from '@/features/document-layout';
import { ContentLayoutField } from '@/features/document-layout/ContentLayoutField';
import { getEditorBodyLoadingId, getEditorBodyReadyId } from '@/features/editor/lib/media-test-ids';
import { MetadataPanel } from '@/features/metadata/MetadataPanel/MetadataPanel';
import { SummaryFieldCard } from '@/features/metadata/SummaryFieldCard/SummaryFieldCard';
import { EditorActiveLocaleControl } from '@/features/translation/EditorActiveLocaleControl';
import { EntityTranslationsPanel } from '@/features/translation/EntityTranslationsPanel';
import { isLocaleDocumentEditable } from '@/features/translation/locale-document-mode';
import { useLocaleDocumentSession } from '@/features/translation/useLocaleDocumentSession';
import { LocalizedCollaborativePageBodyEditor } from '@/features/page/PageEditor/LocalizedCollaborativePageBodyEditor';
import {
  deletePageAdminAction,
  getPageAccessTagOptionsAction,
  publishPageAction,
  regeneratePageOgImageAction,
  unpublishPageAction,
  updatePageSlugAction,
} from '@/lib/actions/page';
import { updateBlockRoomLocaleMetadata } from '@/lib/collab/block-room-metadata';
import { PageDocumentMetadataError, updatePageDocumentMetadata } from '@/lib/collab/page-document-metadata';
import { createMapPlaceForBlockWithBrowserClient } from '@/lib/api/map-place-browser-client';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import { MapPlaceActionProvider } from '@/lib/contexts/MapPlaceActionContext';
import { PageEditorProvider } from '@/features/page/PageEditor/PageEditorContext';
import { useOgImage } from '@/lib/hooks/useOgImage';
import { useOgGenerationLookupSignal } from '@/lib/hooks/useOgGenerationLookupSignal';
import { usePageEditorCollaboration } from './usePageEditorCollaboration';
import { useSlugManagement } from '@/lib/hooks/useSlugManagement';
import { normalizeOgRegenerationLocale } from '@/lib/utils/og-regeneration';
import { buildPageEditPath } from '@/lib/utils/page-route';
import { toNullableSlug, toSlugInputValue } from '@/lib/utils/slug';
import { PageFeaturedImageUploader } from './PageFeaturedImageUploader';
import { PageEditorInterruptionDialogs } from './PageEditorInterruptionDialogs';
import { SectionList } from './SectionList';
import { usePageResidentMetadata } from './usePageResidentMetadata';
import type { PageAccessPolicyValue } from '@/lib/types/page-access';
import { PageAccessSettings } from './PageAccessSettings';
import { usePageNeutralConfiguration } from './usePageNeutralConfiguration';
import { useDebouncedRoomMetadata } from '@/lib/editor/useDebouncedRoomMetadata';
import { useDebouncedPatch } from '@/lib/editor/useDebouncedPatch';
import { createBlockRoomDocumentName } from '@/lib/collab/block-room-bootstrap';
import { useEditorNavigation } from '@/features/editor/useEditorNavigation';
import { applyPageLayoutMetadataUpdate } from './page-layout-metadata';
import { useBlockRoomMetadataUpdates } from '@/lib/editor/useBlockRoomMetadataUpdates';
import { requireBlockRoomDurabilityProtocol } from '@/lib/collab/block-room-durability';
import { runPageStatusChangeAfterSave } from './page-lifecycle';

interface PageEditorProps {
  initialSnapshot?: EditorSnapshot;
  pageId: string;
  currentMemberId: string;
  canManageTranslations: boolean;
  initialTitle: string;
  initialSummary: string | null;
  initialSourceLocale?: string | null;
  initialRequestedLocale?: string | null;
  initialRequestedLocaleHasEntry?: boolean;
  initialRequestedLocaleTitle?: string | null;
  initialRequestedLocaleSummary?: string | null;
  initialSlug: string | null;
  initialStatus: string;
  initialShowTitle: boolean;
  initialAccessPolicy: PageAccessPolicyValue;
  initialDocumentLayout: DocumentLayout;
  initialFeaturedImageUrl: string | null;
  initialOgImageUrl: string | null;
  userName: string;
  baseUrl: string;
  canonicalOrigin: string;
  siteName: string;
}

interface PageLayoutPatch {
  value: DocumentLayout;
  previous: DocumentLayout;
}

function mergePageLayoutPatches(pending: PageLayoutPatch, next: PageLayoutPatch): PageLayoutPatch {
  return { value: next.value, previous: pending.previous };
}

function usePageEditorViewModel({
  initialSnapshot,
  pageId,
  currentMemberId,
  canManageTranslations,
  initialTitle,
  initialSummary,
  initialSourceLocale = null,
  initialRequestedLocale = null,
  initialRequestedLocaleHasEntry = false,
  initialRequestedLocaleTitle = null,
  initialRequestedLocaleSummary = null,
  initialSlug,
  initialStatus,
  initialShowTitle,
  initialAccessPolicy,
  initialDocumentLayout,
  initialFeaturedImageUrl,
  initialOgImageUrl,
  userName,
  baseUrl,
  canonicalOrigin,
  siteName,
}: PageEditorProps) {
  const t = useTranslations('pageEditor');
  const tLayout = useTranslations('contentLayout');
  const tToc = useTranslations('tableOfContents');
  const tCommon = useTranslations('common');
  const tCommonLabels = useTranslations('common.labels');
  const router = useRouter();
  const navigateWithSave = useEditorNavigation(`page:${pageId}`);
  const [versionHistoryOpened, { open: openVersionHistory, close: closeVersionHistory }] = useDisclosure(false);
  const [featuredImageUrl, setFeaturedImageUrl] = useState(initialFeaturedImageUrl);
  const [slugMutationErrorReason, setSlugMutationErrorReason] = useState<
    'alreadyExists' | 'invalidPath' | 'emptySegment' | 'dotSegment' | 'reservedRoute' | 'checkFailed' | undefined
  >();
  const [layout, setLayout] = useState(initialDocumentLayout);

  const localeSession = useLocaleDocumentSession({
    entityType: 'page',
    entityId: pageId,
    sourceTitle: initialTitle,
    sourceSummary: initialSummary ?? '',
    initialSourceLocale,
    initialRequestedLocale,
    initialRequestedLocaleHasEntry,
    initialRequestedLocaleTitle,
    initialRequestedLocaleSummary,
  });
  const { activeEditLocale, roomLocale } = localeSession;
  const layoutDocumentName = useMemo(() => {
    if (!roomLocale) {
      return null;
    }
    try {
      return createBlockRoomDocumentName('page', pageId, roomLocale);
    } catch {
      return null;
    }
  }, [pageId, roomLocale]);
  const ogRegenerationLocale = normalizeOgRegenerationLocale(activeEditLocale.activeLocale);
  const { shouldUseLocaleDocument } = localeSession.mode;
  const { provider, doc, bootstrap, protocol, isConnected, isSynced, reloadCanonical, acceptEpochAck } =
    usePageEditorCollaboration(pageId, roomLocale, initialSnapshot);
  const durabilityProtocol = useMemo(
    () => (protocol ? requireBlockRoomDurabilityProtocol(protocol) : null),
    [protocol],
  );
  const initialNeutralConfiguration = useMemo(
    () => ({
      slug: initialSlug,
      showTitle: initialShowTitle,
      accessPolicy: initialAccessPolicy,
      status: initialStatus === 'published' ? ('published' as const) : ('draft' as const),
    }),
    [initialAccessPolicy, initialShowTitle, initialSlug, initialStatus],
  );
  const pageNeutral = usePageNeutralConfiguration({
    pageId,
    initialConfiguration: initialNeutralConfiguration,
    provider,
    onShowTitleSaveError: (message) => notifications.show({ message, tone: 'danger' }),
  });
  const { configuration: neutralConfiguration, setDraft, isDraft, beginFieldWrite, queueShowTitle } = pageNeutral;
  const { slug, showTitle, status, accessPolicy } = neutralConfiguration;
  const lifecycleCommandInFlight = useRef(false);
  const {
    title: residentTitle,
    summary: residentSummary,
    setTitle: setResidentTitle,
    setSummary: setResidentSummary,
    adoptPeerUpdate,
  } = usePageResidentMetadata({
    roomIdentity: provider,
    sessionLocale: activeEditLocale.activeLocale,
    roomLocale,
    bootstrap,
    fallbackTitle: activeEditLocale.displayTitle,
    fallbackSummary: activeEditLocale.displaySummary,
  });
  useBlockRoomMetadataUpdates({ protocol }, `page:${pageId}`, ({ operation, values }) => {
    if (operation === 'locale') {
      adoptPeerUpdate({ operation, values });
      return;
    }
    if (operation === 'page_layout') {
      setLayout((current) => applyPageLayoutMetadataUpdate(current, values));
    }
  });
  const permissionRevocation = useEditorPermissionRevocation(provider, 'page', pageId);
  const canMutate = initialSnapshot?.editable !== false && !permissionRevocation.blocked;
  const hasLocaleRoomMutationAuthority = localeSession.hasRoomMutationAuthority({
    sourceLocale: bootstrap?.sourceLocale ?? null,
    locale: bootstrap?.locale ?? null,
    localeExists: bootstrap?.localeExists ?? false,
    documentRevision: bootstrap?.documentRevision ?? null,
    targetRevision: bootstrap?.targetRevision,
  });
  const currentLocaleCanEdit =
    canManageTranslations && activeEditLocale.canEditActiveLocale && canMutate && hasLocaleRoomMutationAuthority;
  const canEditLocaleDocument = isLocaleDocumentEditable({
    activeLocale: roomLocale,
    shouldUseLocaleDocument,
    canEditActiveLocale: currentLocaleCanEdit,
    isSynced,

    isReady: Boolean(doc),
  });
  const canEditNeutral = canEditLocaleDocument && activeEditLocale.isSourceLocale;
  const accessTags = useQuery({
    queryKey: ['page-access-tags'],
    enabled: canEditNeutral,
    queryFn: async () => {
      const result = await getPageAccessTagOptionsAction();
      if (!result.ok) {
        throw new Error(result.error);
      }
      return result.tagOptions;
    },
    retry: false,
  });
  const handleAccessSave = useCallback(
    async (value: PageAccessPolicyValue) => {
      if (!canEditNeutral) {
        return { ok: false as const, error: tCommon('notifications.saveFailed') };
      }
      return pageNeutral.saveAccess(value);
    },
    [canEditNeutral, pageNeutral.saveAccess, tCommon],
  );

  const publish = useMutation({
    mutationFn: async () => {
      const write = beginFieldWrite('status');
      try {
        const result = await publishPageAction(pageId, write.origin);
        if (result.ok) {
          write.acknowledge(result.status);
        } else {
          write.fail();
        }
        return result;
      } catch (error) {
        write.fail();
        throw error;
      }
    },
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: t('notifications.published'), tone: 'positive' });
    },
  });

  const unpublish = useMutation({
    mutationFn: async () => {
      const write = beginFieldWrite('status');
      try {
        const result = await unpublishPageAction(pageId, write.origin);
        if (result.ok) {
          write.acknowledge(result.status);
        } else {
          write.fail();
        }
        return result;
      } catch (error) {
        write.fail();
        throw error;
      }
    },
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: t('notifications.unpublished'), tone: 'positive' });
    },
  });

  const deletePage = useMutation({
    mutationFn: () => deletePageAdminAction(pageId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: t('notifications.deleted'), tone: 'positive' });
      router.push('/admin/pages');
    },
  });

  const regenerateOgImage = useMutation({
    mutationFn: (request: { locale: string; targetKey: string }) => regeneratePageOgImageAction(pageId, request.locale),
    onSuccess: (result, request) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      ogImage.trackRequestedGeneration(result.generationId, request.targetKey);
      notifications.show({ message: tCommon('notifications.ogGenerationRequested'), tone: 'neutral' });
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('notifications.ogRegenerationFailed'),
        tone: 'danger',
      });
    },
  });

  const updateLayout = useMutation({
    scope: { id: `page-document-layout:${pageId}` },
    mutationFn: async (request: PageLayoutPatch) => {
      if (!canEditNeutral || !bootstrap || !protocol) {
        throw new Error('Page collaboration is not ready.');
      }
      const ack = await updatePageDocumentMetadata(protocol, request.value, request.previous);
      if (!acceptEpochAck(ack)) {
        throw new PageDocumentMetadataError(tCommon('notifications.saveFailed'), true);
      }
      return ack;
    },
    onError: (error) => {
      if (error instanceof PageDocumentMetadataError && error.reloadRequired) {
        reloadCanonical();
      }
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('notifications.updateFailed'),
        tone: 'danger',
      });
    },
  });

  const updateSlug = useMutation({
    mutationFn: async (nextSlug: string | null) => {
      const write = beginFieldWrite('slug', nextSlug);
      try {
        const result = await updatePageSlugAction(pageId, nextSlug, write.origin);
        if (result.ok) {
          write.acknowledge(result.slug);
        } else {
          write.fail(false);
        }
        return result;
      } catch (error) {
        write.fail(false);
        throw error;
      }
    },
    onSuccess: (result) => {
      if (result.error) {
        const reason = result.reason ?? 'checkFailed';
        setSlugMutationErrorReason(reason);
        notifications.show({ message: t(`slugValidation.${reason}`), tone: 'danger' });
        return;
      }
      setSlugMutationErrorReason(undefined);
      router.replace(buildPageEditPath(pageId, window.location.search));
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : t('notifications.slugUpdateFailed'),
        tone: 'danger',
      });
    },
  });

  const slugMgmt = useSlugManagement({
    entityType: 'page',
    entityId: pageId,
    slug: toSlugInputValue(slug),
    onSlugChange: (val) => {
      if (canEditNeutral) {
        setDraft('slug', toNullableSlug(val));
      }
    },
    onSave: (newSlug) => {
      if (canEditNeutral && isDraft('slug')) {
        return updateSlug.mutateAsync(toNullableSlug(newSlug));
      }
    },
  });
  const slugErrorReason = slugMgmt.errorReason ?? slugMutationErrorReason;
  const slugError = slugErrorReason ? t(`slugValidation.${slugErrorReason}`) : undefined;

  const debouncedLayoutUpdate = useDebouncedPatch({
    document: `page:${pageId}`,
    scope: layoutDocumentName ?? pageId,
    recoveryScope: layoutDocumentName,
    recoveryKey: 'page-layout',
    delay: 500,
    merge: mergePageLayoutPatches,
    retry: true,
    write: (request: PageLayoutPatch) => updateLayout.mutateAsync(request).then(() => undefined),
  });

  const handleStatusChange = useCallback(
    async (nextStatus: 'draft' | 'published') => {
      if (!canEditNeutral || lifecycleCommandInFlight.current) {
        return;
      }
      lifecycleCommandInFlight.current = true;
      try {
        await runPageStatusChangeAfterSave(
          pageId,
          nextStatus,
          { publish: () => publish.mutateAsync(), unpublish: () => unpublish.mutateAsync() },
          () => notifications.show({ message: tCommon('notifications.saveFailed'), tone: 'danger' }),
        );
      } catch {
        // The mutation owns action errors; the save barrier reports its own failures above.
      } finally {
        lifecycleCommandInFlight.current = false;
      }
    },
    [canEditNeutral, pageId, publish, tCommon, unpublish],
  );

  const debouncedMetadataUpdate = useDebouncedRoomMetadata({
    connection: { protocol, bootstrap, acceptEpochAck, reloadCanonical },
    document: `page:${pageId}`,
    delay: 500,
    write: (protocol, metadata: { title?: string; summary?: string | null }) =>
      updateBlockRoomLocaleMetadata(protocol, { type: 'page', locale: roomLocale!, ...metadata }),
  });
  const handleLocaleTitleChange = useCallback(
    (value: string) => {
      if (!canEditLocaleDocument) {
        return;
      }
      setResidentTitle(value);
      if (canEditNeutral) {
        slugMgmt.updateFromTitle(value);
      }
      debouncedMetadataUpdate({ title: value });
    },
    [canEditNeutral, slugMgmt.updateFromTitle, canEditLocaleDocument, debouncedMetadataUpdate],
  );

  const handleShowTitleChange = useCallback(
    (checked: boolean) => {
      if (!canEditNeutral) {
        return;
      }
      setDraft('showTitle', checked);
      queueShowTitle(checked);
    },
    [canEditNeutral, queueShowTitle, setDraft],
  );

  const handleLayoutChange = useCallback(
    (value: DocumentLayout) => {
      if (!canEditNeutral) {
        return;
      }
      const previous = layout;
      setLayout(value);
      debouncedLayoutUpdate({ value, previous });
    },
    [canEditNeutral, debouncedLayoutUpdate, layout],
  );

  const handleLocaleSummaryChange = useCallback(
    (value: string) => {
      if (!canEditLocaleDocument) {
        return;
      }
      setResidentSummary(value);
      debouncedMetadataUpdate({ summary: value });
    },
    [canEditLocaleDocument, debouncedMetadataUpdate],
  );

  const pageStatusOptions = [
    {
      value: 'draft' as const,
      label: tCommon('statuses.draft'),
      actionLabel: tCommon('actions.unpublish'),
      tone: 'neutral' as const,
    },
    {
      value: 'published' as const,
      label: tCommon('statuses.published'),
      actionLabel: tCommon('actions.publish'),
      tone: 'positive' as const,
    },
  ];

  const currentTextProvider = provider;
  const ogImage = useOgImage({
    entityType: 'page',
    entityId: pageId,
    initialOgImageUrl: activeEditLocale.isSourceLocale ? initialOgImageUrl : activeEditLocale.displayOgImageUrl,
    locale: activeEditLocale.hasLiveRow ? activeEditLocale.activeLocale : null,
    provider: currentTextProvider,
  });
  useOgGenerationLookupSignal(activeEditLocale.ogGenerationRun, activeEditLocale.activeLocale, ogImage.trackLatest);
  const currentIsConnected = isConnected;
  const currentIsSynced = isSynced;
  const displayedTitle = roomLocale && isSynced ? residentTitle : activeEditLocale.displayTitle;
  const displayedSummary = roomLocale && isSynced ? residentSummary : activeEditLocale.displaySummary;

  return {
    ...(initialSnapshot ? { initialSnapshot } : {}),
    currentTextProvider,
    pageId,
    protocol,
    accessTags: {
      isError: accessTags.isError,
      error: accessTags.error,
      isFetching: accessTags.isFetching,
      refetch: async () => {
        await accessTags.refetch();
      },
      data: accessTags.data,
      isLoading: accessTags.isLoading,
    },
    displayedTitle,
    canEditLocaleDocument,
    handleLocaleTitleChange,
    tCommon,
    status,
    pageStatusOptions,
    currentIsConnected,
    currentIsSynced,
    navigateWithSave,
    router: { back: router.back, replace: router.replace },
    canEditNeutral,
    handleStatusChange,
    deletePage: { mutate: deletePage.mutate, isPending: deletePage.isPending },
    publish: { isPending: publish.isPending },
    unpublish: { isPending: unpublish.isPending },
    tCommonLabels,
    openVersionHistory,
    activeEditLocale,
    baseUrl,
    slug,
    slugMgmt: {
      isAvailable: slugMgmt.isAvailable,
      isChecking: slugMgmt.isChecking,
      handleChange: slugMgmt.handleChange,
      handleBlur: slugMgmt.handleBlur,
    },
    slugError,
    updateSlug: { isPending: updateSlug.isPending },
    setSlugMutationErrorReason,
    t,
    canManageTranslations,
    canMutate,
    showTitle,
    handleShowTitleChange,
    layout,
    handleLayoutChange,
    tLayout,
    tToc,
    displayedSummary,
    roomLocale,
    provider,
    doc,
    currentMemberId,
    userName,
    handleLocaleSummaryChange,
    accessPolicy,
    handleAccessSave,
    canonicalOrigin,
    siteName,
    ogImage: {
      src: ogImage.src,
      isRegenerating: ogImage.isRegenerating,
      status: ogImage.status,
      error: ogImage.error,
      targetKey: ogImage.targetKey,
      trackLatest: ogImage.trackLatest,
    },
    featuredImageUrl,
    ogRegenerationLocale,
    regenerateOgImage: { isPending: regenerateOgImage.isPending, mutate: regenerateOgImage.mutate },
    setFeaturedImageUrl,
    durabilityProtocol,
    isSynced,
    versionHistoryOpened,
    closeVersionHistory,
    reloadCanonical,
    permissionRevocation: { interruption: permissionRevocation.interruption },
  };
}

export function PageEditor(props: PageEditorProps) {
  return <PageEditorView model={usePageEditorViewModel(props)} />;
}

export type PageEditorViewModel = ReturnType<typeof usePageEditorViewModel>;

/** Complete production editor composition; controllers supply data and commands. */
export function PageEditorView({ model }: { model: PageEditorViewModel }) {
  const {
    currentTextProvider,
    pageId,
    protocol,
    accessTags,
    displayedTitle,
    canEditLocaleDocument,
    handleLocaleTitleChange,
    tCommon,
    status,
    pageStatusOptions,
    currentIsConnected,
    currentIsSynced,
    navigateWithSave,
    router,
    canEditNeutral,
    handleStatusChange,
    deletePage,
    publish,
    unpublish,
    tCommonLabels,
    openVersionHistory,
    activeEditLocale,
    baseUrl,
    slug,
    slugMgmt,
    slugError,
    updateSlug,
    setSlugMutationErrorReason,
    t,
    canManageTranslations,
    canMutate,
    showTitle,
    handleShowTitleChange,
    layout,
    handleLayoutChange,
    tLayout,
    tToc,
    displayedSummary,
    roomLocale,
    provider,
    doc,
    currentMemberId,
    userName,
    handleLocaleSummaryChange,
    accessPolicy,
    handleAccessSave,
    canonicalOrigin,
    siteName,
    ogImage,
    featuredImageUrl,
    ogRegenerationLocale,
    regenerateOgImage,
    setFeaturedImageUrl,
    durabilityProtocol,
    versionHistoryOpened,
    closeVersionHistory,
    reloadCanonical,
    permissionRevocation,
  } = model;
  return (
    <EditorRuntimeProvider
      provider={currentTextProvider}
      entityType="page"
      entityId={pageId}
      blockRoomProtocol={protocol}
    >
      <QueryErrorAlert queries={[accessTags]} />
      <DsLayoutStack fill="block" gap={{ base: 'xs', sm: 'md' }}>
        <EditorHeader
          title={displayedTitle}
          onTitleChange={canEditLocaleDocument ? handleLocaleTitleChange : undefined}
          titleInputId={`page-${pageId}-title`}
          titlePlaceholder={tCommon('states.untitledEntity', { entity: tCommon('entities.page') })}
          titleDisabled={!canEditLocaleDocument}
          status={status}
          statusOptions={pageStatusOptions}
          isConnected={currentIsConnected}
          isSynced={currentIsSynced}
          onBack={() => {
            void navigateWithSave(() => router.back());
          }}
          onStatusChange={canEditNeutral ? handleStatusChange : undefined}
          onDelete={canEditNeutral ? () => deletePage.mutate() : undefined}
          deleteConfirmation={{
            title: tCommon('actions.delete'),
            message: (
              <DsText>
                {tCommon.rich('messages.confirmDeleteNamedRich', {
                  name: displayedTitle || tCommon('states.untitled'),
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </DsText>
            ),
          }}
          isStatusChanging={publish.isPending || unpublish.isPending}
          isDeleting={deletePage.isPending}
          backTooltip={tCommon('actions.back')}
          groupStatusWithCollab
          collabActions={[
            {
              label: tCommonLabels('versionHistory'),
              onClick: openVersionHistory,
              icon: <IconHistory />,
              disabled: !canEditNeutral,
            },
          ]}
          controls={<EditorActiveLocaleControl state={activeEditLocale} />}
        />

        <DocumentEditorPanels
          settings={
            <>
              {/* URL Section */}
              <UrlSection
                baseUrl={baseUrl}
                entityType="page"
                entityId={pageId}
                slug={toSlugInputValue(slug)}
                isAvailable={slugMgmt.isAvailable}
                idPrefix={`page-${pageId}`}
                error={slugError}
                saving={slugMgmt.isChecking || updateSlug.isPending}
                disabled={!canEditNeutral}
                onChange={(value) => {
                  setSlugMutationErrorReason(undefined);
                  slugMgmt.handleChange(value);
                }}
                onBlur={slugMgmt.handleBlur}
              />

              {/* Options */}
              <EditorSettingsSection title={tCommonLabels('options')}>
                <Checkbox
                  id={`page-${pageId}-show-title`}
                  label={t('showTitleOnPage')}
                  checked={showTitle}
                  onChange={(e) => handleShowTitleChange(e.currentTarget.checked)}
                  disabled={!canEditNeutral}
                  size="sm"
                />
                <ContentLayoutField
                  value={layout}
                  onChange={handleLayoutChange}
                  disabled={!canEditNeutral}
                  labels={{
                    contentHeight: tLayout('contentHeight'),
                    tableOfContents: tToc('title'),
                    content: tLayout('content'),
                    viewport: tLayout('viewport'),
                    pageChrome: tLayout('chrome'),
                    footer: tLayout('footer'),
                    flow: tLayout('flow'),
                    pinned: tLayout('pinned'),
                  }}
                />
              </EditorSettingsSection>

              <EditorSettingsSection title={t('access.title')}>
                {accessTags.isError ? (
                  <DsLayoutStack gap="xs">
                    <DsText size="sm" tone="danger" role="alert">
                      {t('access.tagsLoadError')}
                    </DsText>
                    <Button
                      tone="neutral"
                      emphasis="low"
                      onClick={() => void accessTags.refetch()}
                      disabled={!canEditNeutral}
                    >
                      {t('access.tagsRetry')}
                    </Button>
                  </DsLayoutStack>
                ) : null}
                <PageAccessSettings
                  key={pageId}
                  value={accessPolicy}
                  tagOptions={accessTags.data ?? []}
                  loadingTags={accessTags.isLoading || accessTags.isError}
                  disabled={!canEditNeutral}
                  onSave={handleAccessSave}
                />
              </EditorSettingsSection>

              <SummaryFieldCard
                entityType="page"
                entityId={pageId}
                title={displayedTitle}
                summary={displayedSummary}
                summaryReadOnly={!canEditLocaleDocument}
                hideAiActions={!canEditLocaleDocument}
                aiTarget={
                  canEditLocaleDocument && roomLocale ? { type: 'page', id: pageId, locale: roomLocale } : undefined
                }
                provider={canEditLocaleDocument ? provider : null}
                doc={canEditLocaleDocument ? doc : null}
                currentMemberId={currentMemberId}
                currentMemberDisplayName={userName}
                onSummaryChange={canEditLocaleDocument ? handleLocaleSummaryChange : undefined}
              />

              {/* OG Image & Featured Image */}
              <EditorSettingsSection title={tCommonLabels('images')}>
                <MediaPreviewGrid>
                  <OgImagePreview
                    src={ogImage.src}
                    canRegenerate={
                      canEditLocaleDocument && activeEditLocale.hasLiveRow && ogRegenerationLocale !== null
                    }
                    isRegenerating={regenerateOgImage.isPending || ogImage.isRegenerating}
                    generationStatus={ogImage.status}
                    generationError={ogImage.error}
                    onRegenerate={() => {
                      if (ogRegenerationLocale) {
                        regenerateOgImage.mutate({
                          locale: ogRegenerationLocale,
                          targetKey: ogImage.targetKey,
                        });
                      }
                    }}
                  />
                  <AuthoringExtension kind="uploads">
                    <PageFeaturedImageUploader
                      pageId={pageId}
                      imageUrl={featuredImageUrl}
                      onImageUrlChange={setFeaturedImageUrl}
                      idPrefix={`page-${pageId}-featured-image`}
                      canEdit={canEditNeutral}
                      onOgGenerationRequested={() => void ogImage.trackLatest()}
                    />
                  </AuthoringExtension>
                </MediaPreviewGrid>
              </EditorSettingsSection>
              <MetadataPanel
                title={displayedTitle}
                summary={displayedSummary}
                routePath={`/${slug || pageId}`}
                canonicalOrigin={canonicalOrigin}
                siteName={siteName}
                defaultImageUrl={ogImage.src ?? featuredImageUrl ?? undefined}
                defaultSchemaType="WebPage"
              />

              {/* Share Links */}
              <AuthoringExtension kind="sharing">
                <ShareLinkSection
                  entityType="page"
                  entityId={pageId}
                  description={t('shareLinksDescription')}
                  disabled={!canEditNeutral}
                />
              </AuthoringExtension>

              <AuthoringExtension kind="translations">
                <EntityTranslationsPanel
                  entityType="page"
                  entityId={pageId}
                  canManage={canManageTranslations && canMutate}
                  canAdministerTranslations={canManageTranslations && canMutate}
                  canMutateTargets={canManageTranslations && canMutate}
                />
              </AuthoringExtension>
            </>
          }
        >
          {/* Content */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <SectionCard layout="stack" grow padding={{ base: 'none', sm: 'md' }}>
              <DsLayoutStack flexible>
                <ScrollArea id={getEditorBodyReadyId('page', pageId)} grow>
                  <EditorSnapshotHandoff
                    key={activeEditLocale.activeLocale ?? model.initialSnapshot?.locale ?? 'source'}
                    page
                    media={
                      !activeEditLocale.activeLocale ||
                      activeEditLocale.activeLocale === model.initialSnapshot?.locale
                        ? model.initialSnapshot?.blockMedia
                        : undefined
                    }
                    ready={Boolean(provider && doc && durabilityProtocol && roomLocale)}
                    editable={canEditLocaleDocument}
                    snapshot={
                      model.initialSnapshot &&
                      (!activeEditLocale.activeLocale ||
                        activeEditLocale.activeLocale === model.initialSnapshot.locale) ? (
                        <PageEditorSnapshot snapshot={model.initialSnapshot} />
                      ) : (
                        <div style={{ minHeight: 200 }}>
                          <DsLayoutStack id={getEditorBodyLoadingId('page', pageId)} justify="center">
                            <DsText size="sm" tone="secondary">
                              {tCommon('labels.body')}
                            </DsText>
                          </DsLayoutStack>
                        </div>
                      )
                    }
                  >
                    {provider && doc && durabilityProtocol && roomLocale ? (
                      <MapPlaceActionProvider createMapPlaceForBlock={createMapPlaceForBlockWithBrowserClient}>
                        <PageEditorProvider
                          doc={doc}
                          provider={provider}
                          protocol={durabilityProtocol}
                          locale={roomLocale}
                          userName={userName}
                          pageId={pageId}
                          editable={canEditLocaleDocument}
                          allowStructuralEdits={canEditNeutral}
                        >
                          {activeEditLocale.isSourceLocale ? (
                            <SectionList />
                          ) : (
                            <LocalizedCollaborativePageBodyEditor
                              fallbackText={tCommon('states.none')}
                              editable={canEditLocaleDocument}
                            />
                          )}
                        </PageEditorProvider>
                      </MapPlaceActionProvider>
                    ) : (
                      <div style={{ minHeight: 200 }}>
                        <DsLayoutStack id={getEditorBodyLoadingId('page', pageId)} justify="center">
                          <DsText size="sm" tone="secondary">
                            {tCommon('labels.body')}
                          </DsText>
                        </DsLayoutStack>
                      </div>
                    )}
                  </EditorSnapshotHandoff>
                </ScrollArea>
              </DsLayoutStack>
            </SectionCard>
          </div>
        </DocumentEditorPanels>

        {/* Version History */}
        <VersionHistoryDrawer
          entityType="page"
          entityId={pageId}
          opened={versionHistoryOpened}
          onClose={closeVersionHistory}
          currentSourceLocale={activeEditLocale.sourceLocale}
          canRestore={canEditNeutral}
          onRestored={async () => {
            reloadCanonical();
            await ogImage.trackLatest();
          }}
        />

        <PageEditorInterruptionDialogs
          interruption={permissionRevocation.interruption}
          permissionRevokedDestination={status === 'published' ? `/${slug || pageId}` : '/'}
          navigate={(destination) => router.replace(destination)}
        />
      </DsLayoutStack>
    </EditorRuntimeProvider>
  );
}
