'use client';

import { AuthoringExtension } from '@/features/authoring/AuthoringExtensionsContext';

import { DocumentEditorPanels } from '@/features/authoring/DocumentEditorPanels';
import { SectionCard, SectionHeader } from '@/components/core/Section';

import { LayoutStack as DsLayoutStack, LayoutGrid as DsLayoutGrid } from '@/components/core/Layout';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PostAction } from '@echovisionlab/geul-proto/secure/post_pb.ts';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Checkbox } from '@/components/core/Input';
import { useDisclosure, useWindowEvent } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { useEditorPermissionRevocation } from '@/features/editor/useEditorPermissionRevocation';
import { MediaPreviewGrid } from '@/components/core/MediaPreviewGrid';
import { OgImagePreview } from '@/features/metadata/OgImagePreview';
import { ShareLinkSection } from '@/features/share/ShareLinkSection';
import { UrlSection } from '@/features/metadata/UrlSection';
import { VersionHistoryDrawer } from '@/features/version-history';
import type { DocumentLayout } from '@/features/document-layout';
import { ContentLayoutField } from '@/features/document-layout/ContentLayoutField';
import { MetadataPanel } from '@/features/metadata/MetadataPanel/MetadataPanel';
import { SummaryFieldCard } from '@/features/metadata/SummaryFieldCard/SummaryFieldCard';
import { CreatePlaceModal, type CreatePlaceFormState } from '@/features/place/CreatePlaceModal';
import { EditorActiveLocaleControl } from '@/features/translation/EditorActiveLocaleControl';
import { EntityTranslationsPanel } from '@/features/translation/EntityTranslationsPanel';
import { isLocaleDocumentEditable } from '@/features/translation/locale-document-mode';
import { usePostBlockRoomController } from '@/features/editor/hooks/useBlockRoomTiptapController';
import { exportPostMarkdownAction, regeneratePostOgImageAction } from '@/lib/actions/post';
import {
  createMapPlaceForBlockWithBrowserClient,
  createMapPlaceWithBrowserClient,
} from '@/lib/api/map-place-browser-client';
import type { PostMeta } from '@/lib/collab/post-meta';
import { updateBlockRoomLocaleMetadata } from '@/lib/collab/block-room-metadata';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import { MapPlaceActionProvider } from '@/lib/contexts/MapPlaceActionContext';
import { PostMetaProvider, usePostMeta } from '@/lib/contexts/PostMetaContext';
import { useEditorNavigation } from '@/features/editor/useEditorNavigation';
import { useOgImage } from '@/lib/hooks/useOgImage';
import { useOgGenerationLookupSignal } from '@/lib/hooks/useOgGenerationLookupSignal';
import { useSlugManagement } from '@/lib/hooks/useSlugManagement';
import type { CategorySelect } from '@/lib/types/category/model';
import type { PostStatus } from '@/lib/types/post/model';
import type { SeriesBasic } from '@/lib/types/series/model';
import type { ShareLink } from '@/lib/types/share-link/model';
import type { TagSelect } from '@/lib/types/tag/model';
import { downloadMarkdown } from '@/lib/utils/export';
import { normalizeOgRegenerationLocale } from '@/lib/utils/og-regeneration';
import { toNullableSlug, toSlugInputValue } from '@/lib/utils/slug';
import { resolvePostEditorBodyMode } from './body-mode';
import { CategorySelector } from './CategorySelector';
import { resolvePostEditorAiTarget } from './collaboration-mode';
import { FeaturedImageUploader } from './FeaturedImageUploader';
import { LocationSelector } from './LocationSelector';
import { PostEditorBody } from './PostEditorBody';
import { PostEditorHeaderSection } from './PostEditorHeaderSection';
import { PostParticipantsDialog } from './PostParticipantsDialog';
import { PostPermissionRevokedDialog } from './PostPermissionRevokedDialog';
import { PostScheduleDialog } from './PostScheduleDialog';
import { PostSessionExpiredDialog } from './PostSessionExpiredDialog';
import { SeriesSelector } from './SeriesSelector';
import { TagSelector } from './TagSelector';
import { usePostConfigSave } from './usePostConfigSave';
import { diffPostLayout } from './post-config-save';
import { usePostLifecycle } from './usePostLifecycle';
import { useDebouncedRoomMetadata } from '@/lib/editor/useDebouncedRoomMetadata';
import { useBlockRoomMetadataUpdates } from '@/lib/editor/useBlockRoomMetadataUpdates';

interface PostEditorProps {
  postId: string;
  currentMemberId: string;
  initialTitle: string;
  initialSummary: string | null;
  initialSlug: string | null;
  initialStatus: PostStatus;
  initialScheduledAt: string | null;
  initialScheduledTimeZone: string | null;
  initialAllowedActions: PostAction[];
  initialCategories: PostMeta['categories'];
  initialTags: PostMeta['tags'];
  initialFeaturedImageUrl: string | null;
  initialCommentsEnabled: boolean;
  initialConfigurationRevision: string;
  initialDocumentLayout: DocumentLayout;
  initialSeriesId: string | null;
  initialSeriesOrder: number | null;
  initialMapPlaceId: string | null;
  initialOgImageUrl: string | null;
  userName: string;
  isAdmin: boolean;
  baseUrl: string;
  canonicalOrigin: string;
  siteName: string;
  // Prefetched data for selectors
  categories: CategorySelect[];
  tags: TagSelect[];
  series: SeriesBasic[];
  shareLinks: ShareLink<'post'>[];
}

export function PostEditor(props: PostEditorProps) {
  const initialMeta: PostMeta = {
    title: props.initialTitle,
    summary: props.initialSummary ?? '',
    categories: props.initialCategories,
    tags: props.initialTags,
    commentsEnabled: props.initialCommentsEnabled,
    ...props.initialDocumentLayout,
  };

  return (
    <PostMetaProvider
      key={props.postId}
      postId={props.postId}
      initialMeta={initialMeta}
      initialSlug={props.initialSlug}
      initialFeaturedImageUrl={props.initialFeaturedImageUrl}
    >
      <MapPlaceActionProvider createMapPlaceForBlock={createMapPlaceForBlockWithBrowserClient}>
        <PostEditorContent {...props} />
      </MapPlaceActionProvider>
    </PostMetaProvider>
  );
}

function usePostEditorViewModel({
  postId,
  currentMemberId,
  initialTitle,
  initialSummary,
  initialStatus,
  initialScheduledAt,
  initialScheduledTimeZone,
  initialConfigurationRevision,
  initialAllowedActions,
  initialSeriesId,
  initialSeriesOrder,
  initialMapPlaceId,
  initialOgImageUrl,
  userName,
  isAdmin,
  baseUrl,
  canonicalOrigin,
  siteName,
  categories,
  tags,
  series,
  shareLinks,
}: PostEditorProps) {
  const tCommon = useTranslations('common');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonNotifications = useTranslations('common.notifications');
  const t = useTranslations('postEditor');
  const tLayout = useTranslations('contentLayout');
  const router = useRouter();
  const navigateWithSave = useEditorNavigation(`post:${postId}`);
  const [isZenMode, setIsZenMode] = useState(false);
  const [mapPlaceId, setMapPlaceId] = useState<string | null>(initialMapPlaceId);
  const adoptedSlugRef = useRef<string | null | undefined>(undefined);
  const localSlugEditRef = useRef(false);
  const [createPlaceInitialName, setCreatePlaceInitialName] = useState('');

  const [participantsOpened, { open: openParticipants, close: closeParticipants }] = useDisclosure(false);
  const [scheduleOpened, { open: openSchedule, close: closeSchedule }] = useDisclosure(false);
  const [versionHistoryOpened, { open: openVersionHistory, close: closeVersionHistory }] = useDisclosure(false);
  const [createPlaceOpened, { open: openCreatePlace, close: closeCreatePlace }] = useDisclosure(false);

  const lifecycle = usePostLifecycle({
    postId,
    initialStatus,
    initialScheduledAt,
    initialScheduledTimeZone,
    allowedActions: initialAllowedActions,
    openSchedule,
    closeSchedule,
  });
  const { status, scheduledAt, scheduledTimeZone } = lifecycle;
  const {
    canEdit,
    canSchedule,
    canDelete,
    canAddAuthor,
    canRemoveAuthor,
    canManageCollaborators,
    canViewVersions,
    canRestoreVersion,
    canManageShareLinks,
  } = lifecycle.permissions;

  const {
    setSourceTitle,
    setSourceSummary,
    slug,
    setSlug,
    commentsEnabled,
    setCommentsEnabled,
    layout,
    setLayout,
    featuredImageUrl,
    provider,
    doc,
    isConnected,
    isSynced,
    bootstrap,
    protocol,
    acceptEpochAck,
    reloadCanonical,
    roomLocale,
    localeSession,
  } = usePostMeta();
  const { activeEditLocale } = localeSession;
  const canEditTranslationSource = canEdit;
  const ogRegenerationLocale = normalizeOgRegenerationLocale(activeEditLocale.activeLocale);
  const { isEditingScopedLocale, shouldUseLocaleDocument } = localeSession.mode;
  useWindowEvent('keydown', (event) => {
    if (event.key === 'Escape' && isZenMode) {
      setIsZenMode(false);
    }
  });

  const currentProvider = provider;
  const currentDoc = doc;
  const currentIsConnected = isConnected;
  const currentIsSynced = isSynced;
  const handleBack = useCallback(async () => {
    await navigateWithSave(() => router.back());
  }, [navigateWithSave, router]);
  const postConfigUpdate = usePostConfigSave(
    postId,
    {
      configurationRevision: initialConfigurationRevision,
      slug,
      commentsEnabled,
      mapPlaceId,
      documentLayout: layout,
    },
    provider,
  );
  useEffect(() => {
    const configuration = postConfigUpdate.configuration;
    if (configuration.slug === slug) {
      localSlugEditRef.current = false;
    } else if (!localSlugEditRef.current) {
      adoptedSlugRef.current = configuration.slug;
      setSlug(configuration.slug);
    }
    setCommentsEnabled(configuration.commentsEnabled);
    setMapPlaceId(configuration.mapPlaceId);
    setLayout(configuration.documentLayout);
  }, [postConfigUpdate.configuration, setCommentsEnabled, setLayout, setSlug, slug]);
  const permissionRevocation = useEditorPermissionRevocation(provider, 'post', postId);
  const blockRoomController = usePostBlockRoomController(currentDoc, roomLocale);
  const editorSession =
    currentProvider && blockRoomController && currentIsSynced
      ? { provider: currentProvider, controller: blockRoomController }
      : null;
  const isEditorReady = editorSession !== null;
  const canMutateContent = canEdit && !permissionRevocation.blocked;

  // Track the durable server-side OG generation for the active target.
  const ogImage = useOgImage({
    entityType: 'post',
    entityId: postId,
    initialOgImageUrl: activeEditLocale.isSourceLocale ? initialOgImageUrl : activeEditLocale.displayOgImageUrl,
    locale: activeEditLocale.hasLiveRow ? activeEditLocale.activeLocale : null,
    provider: currentProvider,
  });
  useOgGenerationLookupSignal(activeEditLocale.ogGenerationRun, activeEditLocale.activeLocale, ogImage.trackLatest);

  // Slug management with auto-save
  const slugMgmt = useSlugManagement({
    entityType: 'post',
    entityId: postId,
    slug: toSlugInputValue(slug),
    onSlugChange: (val) => {
      adoptedSlugRef.current = undefined;
      localSlugEditRef.current = true;
      setSlug(toNullableSlug(val));
    },
    onSave: (newSlug) => {
      const nextSlug = toNullableSlug(newSlug);
      if (adoptedSlugRef.current === nextSlug) {
        adoptedSlugRef.current = undefined;
        return;
      }
      postConfigUpdate({ slug: toSlugInputValue(nextSlug) });
    },
  });

  const regenerateOgImage = useMutation({
    mutationFn: (request: { locale: string; targetKey: string }) => regeneratePostOgImageAction(postId, request.locale),
    onSuccess: (result, request) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tCommon('notifications.ogGenerationRequested'), tone: 'neutral' });
      ogImage.trackRequestedGeneration(result.generationId, request.targetKey);
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('notifications.ogRegenerationFailed'),
        tone: 'danger',
      });
    },
  });

  const markdown = useMutation({
    mutationFn: () => exportPostMarkdownAction(postId),
  });

  const createPlace = useMutation({
    mutationFn: (data: CreatePlaceFormState) =>
      createMapPlaceWithBrowserClient({
        name: data.name,
        address: data.address,
        lat: data.lat,
        lng: data.lng,
        google_place_id: data.googlePlaceId,
        address_components: data.addressComponents ?? undefined,
      }),
    onSuccess: (result) => {
      if (result.error || !result.data?.id) {
        notifications.show({
          message: result.error || tCommon('notifications.createPlaceFailed'),
          tone: 'danger',
        });
        return;
      }

      const nextMapPlaceId = result.data.id;
      setMapPlaceId(nextMapPlaceId);
      postConfigUpdate({ mapPlaceId: nextMapPlaceId });
      void postConfigUpdate.flush();
      closeCreatePlace();
      notifications.show({
        message: tCommon('notifications.placeCreatedAndLinked'),
        tone: 'positive',
      });
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('notifications.createPlaceFailed'),
        tone: 'danger',
      });
    },
  });

  const [residentTitle, setResidentTitle] = useState(initialTitle);
  const [residentSummary, setResidentSummary] = useState(initialSummary ?? '');
  const debouncedResidentMetadataUpdate = useDebouncedRoomMetadata({
    connection: { protocol, bootstrap, acceptEpochAck, reloadCanonical },
    document: `post:${postId}`,
    delay: 500,
    write: (protocol, update: { locale: string; title?: string | null; summary?: string | null }) =>
      updateBlockRoomLocaleMetadata(protocol, { type: 'post', ...update }),
  });
  useEffect(() => {
    const pending = debouncedResidentMetadataUpdate.getPendingPatch();
    const pendingForRoom = pending?.locale === roomLocale ? pending : null;
    setResidentTitle(
      pendingForRoom && Object.hasOwn(pendingForRoom, 'title')
        ? (pendingForRoom.title ?? '')
        : activeEditLocale.displayTitle,
    );
    setResidentSummary(
      pendingForRoom && Object.hasOwn(pendingForRoom, 'summary')
        ? (pendingForRoom.summary ?? '')
        : activeEditLocale.displaySummary,
    );
  }, [
    activeEditLocale.displaySummary,
    activeEditLocale.displayTitle,
    debouncedResidentMetadataUpdate,
    postId,
    roomLocale,
  ]);

  useBlockRoomMetadataUpdates({ protocol }, `post:${postId}`, ({ operation, values }) => {
    if (operation !== 'locale') {
      return;
    }
    if (values.title === null || typeof values.title === 'string') {
      const title = values.title ?? '';
      setResidentTitle(title);
      if (activeEditLocale.isSourceLocale) {
        setSourceTitle(title);
      }
    }
    if (values.summary === null || typeof values.summary === 'string') {
      const summary = values.summary ?? '';
      setResidentSummary(summary);
      if (activeEditLocale.isSourceLocale) {
        setSourceSummary(summary);
      }
    }
  });

  const handleCommentsEnabledChange = useCallback(
    (enabled: boolean) => {
      setCommentsEnabled(enabled);
      postConfigUpdate({ commentsEnabled: enabled });
    },
    [setCommentsEnabled, postConfigUpdate],
  );

  const handleScopedLocaleSummaryChange = useCallback(
    (value: string) => {
      if (!roomLocale) {
        return;
      }
      setResidentSummary(value);
      if (activeEditLocale.isSourceLocale) {
        setSourceSummary(value);
      }
      debouncedResidentMetadataUpdate({ locale: roomLocale, summary: value || null });
    },
    [activeEditLocale.isSourceLocale, debouncedResidentMetadataUpdate, roomLocale, setSourceSummary],
  );

  const handleLayoutChange = useCallback(
    (nextLayout: DocumentLayout) => {
      const layoutIntent = diffPostLayout(layout, nextLayout);
      setLayout(nextLayout);
      if (Object.keys(layoutIntent).length > 0) {
        postConfigUpdate(layoutIntent);
      }
    },
    [layout, postConfigUpdate, setLayout],
  );

  const handleMapPlaceChange = useCallback(
    (nextMapPlaceId: string | null) => {
      setMapPlaceId(nextMapPlaceId);
      postConfigUpdate({ mapPlaceId: nextMapPlaceId ?? '' });
      void postConfigUpdate.flush();
    },
    [postConfigUpdate],
  );

  const handleCreatePlaceStart = useCallback(
    (searchTerm: string) => {
      setCreatePlaceInitialName(searchTerm);
      openCreatePlace();
    },
    [openCreatePlace],
  );

  const handleCreatePlaceSubmit = useCallback(
    (data: CreatePlaceFormState) => {
      createPlace.mutate(data);
    },
    [createPlace],
  );

  const handleExportMarkdown = async () => {
    try {
      const result = await markdown.mutateAsync();
      if (result.error || !result.markdown) {
        notifications.show({
          message: result.error || tCommonNotifications('exportFailed'),
          tone: 'danger',
        });
        return;
      }
      downloadMarkdown(displayedTitle || tCommon('states.untitled'), result.markdown);
    } catch {
      notifications.show({ message: tCommonNotifications('exportFailed'), tone: 'danger' });
    }
  };

  const displayedTitle = roomLocale ? residentTitle : activeEditLocale.displayTitle;
  const displayedSummary = roomLocale ? residentSummary : activeEditLocale.displaySummary;
  const hasLocaleRoomMutationAuthority = localeSession.hasRoomMutationAuthority({
    sourceLocale: bootstrap?.sourceLocale ?? null,
    locale: bootstrap?.locale ?? null,
    localeExists: bootstrap?.localeExists ?? false,
    documentRevision: bootstrap?.documentRevision ?? null,
    targetRevision: bootstrap?.targetRevision,
  });
  const currentLocalePermission = activeEditLocale.isSourceLocale
    ? canEditTranslationSource
    : activeEditLocale.canEditActiveLocale;
  const currentLocaleCanEdit =
    canEdit && currentLocalePermission && hasLocaleRoomMutationAuthority && !permissionRevocation.blocked;
  const hasLocaleEditPermission = activeEditLocale.isSourceLocaleReady ? currentLocaleCanEdit : false;
  const canEditLocaleDocument = isLocaleDocumentEditable({
    activeLocale: roomLocale,
    shouldUseLocaleDocument,
    canEditActiveLocale: hasLocaleEditPermission,
    isSynced: currentIsSynced,
  });
  const canMutateSourceDocument = canEditLocaleDocument && activeEditLocale.isSourceLocale;
  const handleScopedLocaleTitleChange = useCallback(
    (value: string) => {
      if (!roomLocale) {
        return;
      }
      setResidentTitle(value);
      if (canMutateSourceDocument) {
        slugMgmt.updateFromTitle(value);
      }
      if (activeEditLocale.isSourceLocale) {
        setSourceTitle(value);
      }
      debouncedResidentMetadataUpdate({ locale: roomLocale, title: value });
    },
    [
      canMutateSourceDocument,
      slugMgmt.updateFromTitle,
      activeEditLocale.isSourceLocale,
      debouncedResidentMetadataUpdate,
      roomLocale,
      setSourceTitle,
    ],
  );
  const canEditSharedTaxonomy = canMutateSourceDocument && isSynced;
  const editorAiTarget = resolvePostEditorAiTarget({ postId, roomLocale, canEditLocaleDocument });
  const canRestoreCurrentVersion = canRestoreVersion && !permissionRevocation.blocked;
  const bodyPreviewLoading = activeEditLocale.contentPreviewLoading;
  const showEditorChrome = !isZenMode;
  const hasParticipantActions = canAddAuthor || canRemoveAuthor || canManageCollaborators;
  const bodyMode = resolvePostEditorBodyMode({
    isSourceLocaleReady: activeEditLocale.isSourceLocaleReady,
    isEditingScopedLocale,
    hasLiveRow: activeEditLocale.hasLiveRow,
    isEditorReady,
  });
  return {
    currentProvider,
    postId,
    protocol,
    isZenMode,
    displayedTitle,
    canEditLocaleDocument,
    handleScopedLocaleTitleChange,
    status,
    lifecycle: {
      statusOptions: lifecycle.statusOptions,
      isChanging: lifecycle.isChanging,
      changeStatus: lifecycle.changeStatus,
      deletePost: { isPending: lifecycle.deletePost.isPending, mutate: lifecycle.deletePost.mutate },
      schedule: { mutate: lifecycle.schedule.mutate, isPending: lifecycle.schedule.isPending },
    },
    currentIsConnected,
    currentIsSynced,
    activeEditLocale,
    scheduledAt,
    scheduledTimeZone,
    handleBack,
    canDelete,
    canViewVersions,
    openVersionHistory,
    hasParticipantActions,
    openParticipants,
    canSchedule,
    openSchedule,
    handleExportMarkdown,
    setIsZenMode,
    showEditorChrome,
    baseUrl,
    slug,
    slugMgmt: {
      isAvailable: slugMgmt.isAvailable,
      error: slugMgmt.error,
      isChecking: slugMgmt.isChecking,
      handleChange: slugMgmt.handleChange,
      handleBlur: slugMgmt.handleBlur,
    },
    postConfigUpdate: { isPending: postConfigUpdate.isPending },
    canMutateSourceDocument,
    canManageShareLinks,
    t,
    shareLinks,
    canMutateContent,
    ogImage: {
      src: ogImage.src,
      isRegenerating: ogImage.isRegenerating,
      status: ogImage.status,
      error: ogImage.error,
      targetKey: ogImage.targetKey,
      trackLatest: ogImage.trackLatest,
    },
    ogRegenerationLocale,
    regenerateOgImage: { isPending: regenerateOgImage.isPending, mutate: regenerateOgImage.mutate },
    tCommonLabels,
    commentsEnabled,
    handleCommentsEnabledChange,
    layout,
    handleLayoutChange,
    tLayout,
    displayedSummary,
    editorAiTarget,
    currentDoc,
    currentMemberId,
    userName,
    handleScopedLocaleSummaryChange,
    canonicalOrigin,
    siteName,
    featuredImageUrl,
    canEditSharedTaxonomy,
    isAdmin,
    categories,
    tags,
    initialSeriesId,
    initialSeriesOrder,
    series,
    permissionRevocation: {
      revoke: permissionRevocation.revoke,
      revoked: permissionRevocation.revoked,
      sessionExpired: permissionRevocation.sessionExpired,
    },
    mapPlaceId,
    handleMapPlaceChange,
    handleCreatePlaceStart,
    bodyMode,
    editorSession,
    tCommon,
    bodyPreviewLoading,
    participantsOpened,
    closeParticipants,
    canAddAuthor,
    canRemoveAuthor,
    canManageCollaborators,
    versionHistoryOpened,
    closeVersionHistory,
    canRestoreCurrentVersion,
    reloadCanonical,
    scheduleOpened,
    closeSchedule,
    createPlaceOpened,
    closeCreatePlace,
    handleCreatePlaceSubmit,
    createPlace: { isPending: createPlace.isPending },
    createPlaceInitialName,
  };
}

function PostEditorContent(props: PostEditorProps) {
  return <PostEditorView model={usePostEditorViewModel(props)} />;
}

export type PostEditorViewModel = ReturnType<typeof usePostEditorViewModel>;

/** Complete production editor composition; controllers supply data and commands. */
export function PostEditorView({ model }: { model: PostEditorViewModel }) {
  const {
    currentProvider,
    postId,
    protocol,
    isZenMode,
    displayedTitle,
    canEditLocaleDocument,
    handleScopedLocaleTitleChange,
    status,
    lifecycle,
    currentIsConnected,
    currentIsSynced,
    activeEditLocale,
    scheduledAt,
    scheduledTimeZone,
    handleBack,
    canDelete,
    canViewVersions,
    openVersionHistory,
    hasParticipantActions,
    openParticipants,
    canSchedule,
    openSchedule,
    handleExportMarkdown,
    setIsZenMode,
    showEditorChrome,
    baseUrl,
    slug,
    slugMgmt,
    postConfigUpdate,
    canMutateSourceDocument,
    canManageShareLinks,
    t,
    shareLinks,
    canMutateContent,
    ogImage,
    ogRegenerationLocale,
    regenerateOgImage,
    tCommonLabels,
    commentsEnabled,
    handleCommentsEnabledChange,
    layout,
    handleLayoutChange,
    tLayout,
    displayedSummary,
    editorAiTarget,
    currentDoc,
    currentMemberId,
    userName,
    handleScopedLocaleSummaryChange,
    canonicalOrigin,
    siteName,
    featuredImageUrl,
    canEditSharedTaxonomy,
    isAdmin,
    categories,
    tags,
    initialSeriesId,
    initialSeriesOrder,
    series,
    permissionRevocation,
    mapPlaceId,
    handleMapPlaceChange,
    handleCreatePlaceStart,
    bodyMode,
    editorSession,
    tCommon,
    bodyPreviewLoading,
    participantsOpened,
    closeParticipants,
    canAddAuthor,
    canRemoveAuthor,
    canManageCollaborators,
    versionHistoryOpened,
    closeVersionHistory,
    canRestoreCurrentVersion,
    reloadCanonical,
    scheduleOpened,
    closeSchedule,
    createPlaceOpened,
    closeCreatePlace,
    handleCreatePlaceSubmit,
    createPlace,
    createPlaceInitialName,
  } = model;
  return (
    <EditorRuntimeProvider provider={currentProvider} entityType="post" entityId={postId} blockRoomProtocol={protocol}>
      <div style={{ minHeight: '100%' }}>
        <div
          style={{
            ...(isZenMode
              ? {
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  // Keep zen layer above page content but below portal popovers/modals.
                  zIndex: 'var(--geul-layer-sticky)',

                  overflow: 'auto',
                }
              : undefined),
          }}
        >
          <SectionCard appearance="surface" padding={isZenMode ? 'md' : 'none'}>
            <DsLayoutStack gap="xs">
              <PostEditorHeaderSection
                postId={postId}
                title={displayedTitle}
                canEditTitle={canEditLocaleDocument}
                onTitleChange={handleScopedLocaleTitleChange}
                status={status}
                statusOptions={lifecycle.statusOptions}
                isConnected={currentIsConnected}
                isSynced={currentIsSynced}
                isStatusChanging={lifecycle.isChanging}
                isDeleting={lifecycle.deletePost.isPending}
                isZenMode={isZenMode}
                controls={<EditorActiveLocaleControl state={activeEditLocale} hidden={isZenMode} />}
                scheduledAt={scheduledAt}
                scheduledTimeZone={scheduledTimeZone}
                onBack={handleBack}
                onStatusChange={lifecycle.statusOptions.length > 1 ? lifecycle.changeStatus : undefined}
                onDelete={canDelete ? () => lifecycle.deletePost.mutate() : undefined}
                onOpenVersionHistory={canViewVersions ? openVersionHistory : undefined}
                onOpenParticipants={hasParticipantActions ? openParticipants : undefined}
                onReschedule={status === 'scheduled' && canSchedule ? openSchedule : undefined}
                onExportMarkdown={handleExportMarkdown}
                onToggleZenMode={() => setIsZenMode((current) => !current)}
              />

              <DocumentEditorPanels
                focused={!showEditorChrome}
                settings={
                  <>
                    {/* URL Section */}
                    {showEditorChrome && (
                      <UrlSection
                        baseUrl={baseUrl}
                        entityType="post"
                        entityId={postId}
                        slug={toSlugInputValue(slug)}
                        isAvailable={slugMgmt.isAvailable}
                        idPrefix={`post-${postId}`}
                        error={slugMgmt.error}
                        saving={slugMgmt.isChecking || postConfigUpdate.isPending}
                        disabled={!canMutateSourceDocument}
                        onChange={slugMgmt.handleChange}
                        onBlur={slugMgmt.handleBlur}
                      />
                    )}

                    {/* Share Links */}
                    {showEditorChrome && canManageShareLinks && (
                      <AuthoringExtension kind="sharing">
                        <ShareLinkSection
                          entityType="post"
                          entityId={postId}
                          description={t('shareLinksDescription')}
                          disabled={!canManageShareLinks || !canMutateSourceDocument}
                          initialData={shareLinks}
                        />
                      </AuthoringExtension>
                    )}

                    {showEditorChrome && (
                      <AuthoringExtension kind="translations">
                        <EntityTranslationsPanel
                          entityType="post"
                          entityId={postId}
                          canManage={canMutateContent}
                          canAdministerTranslations={canMutateContent}
                          canMutateTargets={canMutateContent}
                        />
                      </AuthoringExtension>
                    )}

                    {/* OG Image & Featured Image */}
                    {showEditorChrome && (
                      <SectionCard padding={{ base: 'none', sm: 'md' }}>
                        <MediaPreviewGrid>
                          <OgImagePreview
                            src={ogImage.src}
                            canRegenerate={
                              canMutateContent && activeEditLocale.hasLiveRow && ogRegenerationLocale !== null
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
                            <FeaturedImageUploader
                              postId={postId}
                              idPrefix={`post-${postId}-featured-image`}
                              canEdit={canMutateSourceDocument}
                              onOgGenerationRequested={() => void ogImage.trackLatest()}
                            />
                          </AuthoringExtension>
                        </MediaPreviewGrid>
                      </SectionCard>
                    )}

                    {/* Options */}
                    {showEditorChrome && (
                      <SectionCard padding={{ base: 'none', sm: 'md' }}>
                        <DsLayoutStack gap="md">
                          <SectionHeader title={tCommonLabels('options')} />
                          <Checkbox
                            id={`post-${postId}-comments-enabled`}
                            label={t('allowComments')}
                            checked={commentsEnabled}
                            onChange={(e) => handleCommentsEnabledChange(e.currentTarget.checked)}
                            disabled={!canMutateSourceDocument}
                            size="sm"
                          />
                          <ContentLayoutField
                            value={layout}
                            onChange={handleLayoutChange}
                            disabled={!canMutateSourceDocument}
                            labels={{
                              contentHeight: tLayout('contentHeight'),
                              content: tLayout('content'),
                              viewport: tLayout('viewport'),
                              pageChrome: tLayout('chrome'),
                              footer: tLayout('footer'),
                              flow: tLayout('flow'),
                              pinned: tLayout('pinned'),
                            }}
                          />
                        </DsLayoutStack>
                      </SectionCard>
                    )}

                    {showEditorChrome && (
                      <DsLayoutStack gap={{ base: 'xl', sm: 'md' }}>
                        <SummaryFieldCard
                          entityType="post"
                          entityId={postId}
                          title={displayedTitle}
                          summary={displayedSummary}
                          summaryReadOnly={!canEditLocaleDocument}
                          hideAiActions={!editorAiTarget}
                          aiTarget={editorAiTarget}
                          provider={activeEditLocale.isSourceLocaleReady ? currentProvider : null}
                          doc={activeEditLocale.isSourceLocaleReady ? currentDoc : null}
                          currentMemberId={currentMemberId}
                          currentMemberDisplayName={userName}
                          onSummaryChange={canEditLocaleDocument ? handleScopedLocaleSummaryChange : undefined}
                        />
                        <MetadataPanel
                          title={displayedTitle}
                          summary={displayedSummary}
                          routePath={`/posts/${slug || postId}`}
                          canonicalOrigin={canonicalOrigin}
                          siteName={siteName}
                          defaultImageUrl={featuredImageUrl}
                          defaultSchemaType="Article"
                        />
                      </DsLayoutStack>
                    )}

                    {/* Selectors */}
                    {showEditorChrome && (
                      <DsLayoutGrid columns={{ base: 1, sm: 2, lg: 4 }}>
                        <AuthoringExtension kind="relations">
                          <CategorySelector
                            postId={postId}
                            canEdit={canEditSharedTaxonomy}
                            isAdmin={isAdmin}
                            categories={categories}
                          />
                        </AuthoringExtension>
                        <AuthoringExtension kind="relations">
                          <TagSelector postId={postId} canEdit={canEditSharedTaxonomy} isAdmin={isAdmin} tags={tags} />
                        </AuthoringExtension>
                        <AuthoringExtension kind="relations">
                          <SeriesSelector
                            postId={postId}
                            idPrefix={`post-${postId}-series`}
                            initialSeriesId={initialSeriesId}
                            initialSeriesOrder={initialSeriesOrder}
                            canEdit={canMutateSourceDocument}
                            isAdmin={isAdmin}
                            series={series}
                            onPostPermissionRevoked={permissionRevocation.revoke}
                          />
                        </AuthoringExtension>
                        <DsLayoutStack gap="xxs">
                          <AuthoringExtension kind="relations">
                            <LocationSelector
                              value={mapPlaceId}
                              idPrefix={`post-${postId}-location`}
                              onChange={handleMapPlaceChange}
                              onCreateNew={handleCreatePlaceStart}
                              canEdit={canMutateSourceDocument}
                            />
                          </AuthoringExtension>
                        </DsLayoutStack>
                      </DsLayoutGrid>
                    )}
                  </>
                }
              >
                <PostEditorBody
                  bodyMode={bodyMode}
                  session={editorSession}
                  postId={postId}
                  userName={userName}
                  editable={canEditLocaleDocument}
                  showLabel={false}
                  bodyLabel={tCommon('labels.body')}
                  activeLocale={activeEditLocale.activeLocale}
                  activeLocaleLabel={activeEditLocale.activeLocaleLabel}
                  hasLiveRow={activeEditLocale.hasLiveRow}
                  contentPreview={activeEditLocale.contentPreview}
                  previewLoading={bodyPreviewLoading}
                  isSourceLocale={activeEditLocale.isSourceLocale}
                />
              </DocumentEditorPanels>

              <PostParticipantsDialog
                postId={postId}
                opened={participantsOpened}
                onClose={closeParticipants}
                canAddAuthor={canAddAuthor}
                canRemoveAuthor={canRemoveAuthor}
                canManageCollaborators={canManageCollaborators}
              />

              {/* Version History */}
              <VersionHistoryDrawer
                entityType="post"
                entityId={postId}
                opened={versionHistoryOpened}
                onClose={closeVersionHistory}
                currentSourceLocale={activeEditLocale.sourceLocale}
                canRestore={canRestoreCurrentVersion}
                onRestored={async () => {
                  reloadCanonical();
                  await ogImage.trackLatest();
                }}
              />

              <PostScheduleDialog
                opened={scheduleOpened}
                onClose={closeSchedule}
                onSubmit={(schedule) => lifecycle.schedule.mutate(schedule)}
                initialInstant={scheduledAt}
                initialTimeZone={scheduledTimeZone}
                loading={lifecycle.schedule.isPending}
              />

              <PostPermissionRevokedDialog opened={permissionRevocation.revoked} postId={postId} />

              <PostSessionExpiredDialog opened={permissionRevocation.sessionExpired} />

              <CreatePlaceModal
                opened={createPlaceOpened}
                onClose={closeCreatePlace}
                onSubmit={handleCreatePlaceSubmit}
                isPending={createPlace.isPending}
                initialName={createPlaceInitialName}
              />
            </DsLayoutStack>
          </SectionCard>
        </div>
      </div>
    </EditorRuntimeProvider>
  );
}
