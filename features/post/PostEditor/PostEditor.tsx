'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PostAction } from '@echovisionlab/geul-proto/secure/post_pb.ts';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { SimpleGrid, Stack, Text } from '@mantine/core';
import { Checkbox } from '@/components/core/Input';
import { useDebouncedCallback, useDisclosure, useWindowEvent } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { EditorReloadRequiredDialog } from '@/features/editor/EditorReloadRequiredDialog';
import { useEditorPermissionRevocation } from '@/features/editor/useEditorPermissionRevocation';
import { useEditorReloadRequired } from '@/features/editor/useEditorReloadRequired';
import { MediaPreviewGrid } from '@/components/core/MediaPreviewGrid';
import { OgImagePreview } from '@/features/metadata/OgImagePreview';
import { ShareLinkSection } from '@/features/share/ShareLinkSection';
import { UrlSection } from '@/features/metadata/UrlSection';
import { VersionHistoryDrawer } from '@/features/version-history';
import { ContentLayoutField, type DocumentLayout } from '@/features/document-layout';
import { MetadataPanel } from '@/features/metadata/MetadataPanel/MetadataPanel';
import { SummaryFieldCard } from '@/features/metadata/SummaryFieldCard/SummaryFieldCard';
import { CreatePlaceModal, type CreatePlaceFormState } from '@/features/place/CreatePlaceModal';
import { EditorActiveLocaleControl } from '@/features/translation/EditorActiveLocaleControl';
import { EntityTranslationsPanel } from '@/features/translation/EntityTranslationsPanel';
import { isLocaleDocumentEditable } from '@/features/translation/locale-document-mode';
import { usePostBlockRoomController } from '@/features/editor/hooks/useBlockRoomTiptapController';
import {
  exportPostMarkdownAction,
  regeneratePostOgImageAction,
  updatePostAction,
  updatePostSlugAction,
} from '@/lib/actions/post';
import {
  createMapPlaceForBlockWithBrowserClient,
  createMapPlaceWithBrowserClient,
} from '@/lib/api/map-place-browser-client';
import type { PostMeta } from '@/lib/collab/post-meta';
import { BlockRoomMetadataError, updateBlockRoomLocaleMetadata } from '@/lib/collab/block-room-metadata';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import { MapPlaceActionProvider } from '@/lib/contexts/MapPlaceActionContext';
import { PostMetaProvider, usePostMeta } from '@/lib/contexts/PostMetaContext';
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
import { usePostLifecycle } from './usePostLifecycle';

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

function PostEditorContent({
  postId,
  currentMemberId,
  initialTitle,
  initialSummary,
  initialStatus,
  initialScheduledAt,
  initialScheduledTimeZone,
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
  const [isZenMode, setIsZenMode] = useState(false);
  const [mapPlaceId, setMapPlaceId] = useState<string | null>(initialMapPlaceId);
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
  const permissionRevocation = useEditorPermissionRevocation(provider, 'post', postId);
  const revision = useEditorReloadRequired(provider);
  const blockRoomController = usePostBlockRoomController(currentDoc, roomLocale);
  const editorSession =
    currentProvider && blockRoomController && currentIsSynced
      ? { provider: currentProvider, controller: blockRoomController }
      : null;
  const isEditorReady = editorSession !== null;
  const canMutateContent = canEdit && !permissionRevocation.blocked && !revision.reloadRequired;

  // Track the durable server-side OG generation for the active target.
  const ogImage = useOgImage({
    entityType: 'post',
    entityId: postId,
    initialOgImageUrl: activeEditLocale.isSourceLocale ? initialOgImageUrl : activeEditLocale.displayOgImageUrl,
    locale: activeEditLocale.hasLiveRow ? activeEditLocale.activeLocale : null,
    provider: currentProvider,
  });
  useOgGenerationLookupSignal(activeEditLocale.ogGenerationRun, activeEditLocale.activeLocale, ogImage.trackLatest);

  const updatePost = useMutation({
    mutationFn: (data: { commentsEnabled?: boolean; mapPlaceId?: string; documentLayout?: DocumentLayout }) =>
      updatePostAction(postId, data),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
      }
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : tCommonNotifications('updateFailed'),
        color: 'red',
      });
    },
  });

  const updateSlug = useMutation({
    mutationFn: (nextSlug: string | null) => updatePostSlugAction(postId, nextSlug),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
      }
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : t('notifications.slugUpdateFailed'),
        color: 'red',
      });
    },
  });

  // Slug management with auto-save
  const slugMgmt = useSlugManagement({
    entityType: 'post',
    entityId: postId,
    slug: toSlugInputValue(slug),
    onSlugChange: (val) => setSlug(toNullableSlug(val)),
    onSave: (newSlug) => {
      return updateSlug.mutateAsync(toNullableSlug(newSlug));
    },
  });

  const regenerateOgImage = useMutation({
    mutationFn: (request: { locale: string; targetKey: string }) => regeneratePostOgImageAction(postId, request.locale),
    onSuccess: (result, request) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tCommon('notifications.ogGenerationRequested'), color: 'blue' });
      ogImage.trackRequestedGeneration(result.generationId, request.targetKey);
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('notifications.ogRegenerationFailed'),
        color: 'red',
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
          color: 'red',
        });
        return;
      }

      const nextMapPlaceId = result.data.id;
      setMapPlaceId(nextMapPlaceId);
      updatePost.mutate({ mapPlaceId: nextMapPlaceId });
      closeCreatePlace();
      notifications.show({
        message: tCommon('notifications.placeCreatedAndLinked'),
        color: 'green',
      });
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('notifications.createPlaceFailed'),
        color: 'red',
      });
    },
  });

  const debouncedCommentsEnabledUpdate = useDebouncedCallback((enabled: boolean) => {
    updatePost.mutate({ commentsEnabled: enabled });
  }, 500);

  const debouncedLayoutUpdate = useDebouncedCallback((documentLayout: DocumentLayout) => {
    updatePost.mutate({ documentLayout });
  }, 500);

  const [residentTitle, setResidentTitle] = useState(initialTitle);
  const [residentSummary, setResidentSummary] = useState(initialSummary ?? '');
  useEffect(() => {
    setResidentTitle(activeEditLocale.displayTitle);
    setResidentSummary(activeEditLocale.displaySummary);
  }, [activeEditLocale.displaySummary, activeEditLocale.displayTitle, roomLocale]);
  const updateResidentMetadata = useMutation({
    mutationFn: (update: { locale: string; title?: string | null; summary?: string | null }) => {
      if (!bootstrap || !protocol) {
        throw new Error('Post Block room is not ready.');
      }
      return updateBlockRoomLocaleMetadata(protocol, {
        type: 'post',
        ...update,
      });
    },
    onSuccess: (ack) => {
      acceptEpochAck(ack);
    },
    onError: (error) => {
      if (error instanceof BlockRoomMetadataError && error.reloadRequired) {
        reloadCanonical();
      }
      notifications.show({
        message: error instanceof Error ? error.message : tCommonNotifications('updateFailed'),
        color: 'red',
      });
    },
  });
  const debouncedResidentMetadataUpdate = useDebouncedCallback(
    (update: { locale: string; title?: string | null; summary?: string | null }) => {
      updateResidentMetadata.mutate(update);
    },
    500,
  );
  useEffect(() => {
    debouncedResidentMetadataUpdate.cancel();
  }, [debouncedResidentMetadataUpdate, roomLocale]);

  const handleCommentsEnabledChange = useCallback(
    (enabled: boolean) => {
      setCommentsEnabled(enabled);
      debouncedCommentsEnabledUpdate(enabled);
    },
    [setCommentsEnabled, debouncedCommentsEnabledUpdate],
  );

  const handleScopedLocaleTitleChange = useCallback(
    (value: string) => {
      if (!roomLocale) {
        return;
      }
      setResidentTitle(value);
      debouncedResidentMetadataUpdate({ locale: roomLocale, title: value });
    },
    [debouncedResidentMetadataUpdate, roomLocale],
  );

  const handleScopedLocaleSummaryChange = useCallback(
    (value: string) => {
      if (!roomLocale) {
        return;
      }
      setResidentSummary(value);
      debouncedResidentMetadataUpdate({ locale: roomLocale, summary: value || null });
    },
    [debouncedResidentMetadataUpdate, roomLocale],
  );

  const handleLayoutChange = useCallback(
    (nextLayout: DocumentLayout) => {
      setLayout(nextLayout);
      debouncedLayoutUpdate(nextLayout);
    },
    [debouncedLayoutUpdate, setLayout],
  );

  const handleMapPlaceChange = useCallback(
    (nextMapPlaceId: string | null) => {
      setMapPlaceId(nextMapPlaceId);
      updatePost.mutate({ mapPlaceId: nextMapPlaceId ?? '' });
    },
    [updatePost],
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
          color: 'red',
        });
        return;
      }
      downloadMarkdown(displayedTitle || tCommon('states.untitled'), result.markdown);
    } catch {
      notifications.show({ message: tCommonNotifications('exportFailed'), color: 'red' });
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
    canEdit &&
    currentLocalePermission &&
    hasLocaleRoomMutationAuthority &&
    !permissionRevocation.blocked &&
    !revision.reloadRequired;
  const hasLocaleEditPermission = activeEditLocale.isSourceLocaleReady ? currentLocaleCanEdit : false;
  const canEditLocaleDocument = isLocaleDocumentEditable({
    activeLocale: roomLocale,
    shouldUseLocaleDocument,
    canEditActiveLocale: hasLocaleEditPermission,
    isSynced: currentIsSynced,
  });
  const canMutateSourceDocument = canEditLocaleDocument && activeEditLocale.isSourceLocale;
  const canEditSharedTaxonomy = canMutateSourceDocument && isSynced;
  const editorAiTarget = resolvePostEditorAiTarget({ postId, roomLocale, canEditLocaleDocument });
  const canRestoreCurrentVersion = canRestoreVersion && !permissionRevocation.blocked && !revision.reloadRequired;
  const bodyPreviewLoading = activeEditLocale.contentPreviewLoading;
  const showEditorChrome = !isZenMode;
  const hasParticipantActions = canAddAuthor || canRemoveAuthor || canManageCollaborators;
  const bodyMode = resolvePostEditorBodyMode({
    isSourceLocaleReady: activeEditLocale.isSourceLocaleReady,
    isEditingScopedLocale,
    hasLiveRow: activeEditLocale.hasLiveRow,
    isEditorReady,
  });
  return (
    <EditorRuntimeProvider provider={currentProvider} entityType="post" entityId={postId} blockRoomProtocol={protocol}>
      <Stack
        mih="100%"
        gap="xs"
        style={
          isZenMode
            ? {
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                // Keep zen layer above page content but below portal popovers/modals.
                zIndex: 150,
                background: 'var(--mantine-color-body)',
                padding: '1rem',
                overflow: 'auto',
              }
            : undefined
        }
      >
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
          onBack={router.back}
          onStatusChange={lifecycle.statusOptions.length > 1 ? lifecycle.changeStatus : undefined}
          onDelete={canDelete ? () => lifecycle.deletePost.mutate() : undefined}
          onOpenVersionHistory={canViewVersions ? openVersionHistory : undefined}
          onOpenParticipants={hasParticipantActions ? openParticipants : undefined}
          onReschedule={status === 'scheduled' && canSchedule ? openSchedule : undefined}
          onExportMarkdown={handleExportMarkdown}
          onToggleZenMode={() => setIsZenMode((current) => !current)}
        />

        {/* URL Section */}
        {showEditorChrome && (
          <UrlSection
            baseUrl={baseUrl}
            entityType="post"
            entityId={postId}
            slug={toSlugInputValue(slug)}
            idPrefix={`post-${postId}`}
            error={slugMgmt.error}
            saving={slugMgmt.isChecking || updateSlug.isPending}
            disabled={!canMutateSourceDocument}
            onChange={slugMgmt.handleChange}
            onBlur={slugMgmt.handleBlur}
          />
        )}

        {/* Share Links */}
        {showEditorChrome && canManageShareLinks && (
          <ShareLinkSection
            entityType="post"
            entityId={postId}
            description={t('shareLinksDescription')}
            disabled={!canManageShareLinks || !canMutateSourceDocument}
            initialData={shareLinks}
          />
        )}

        {showEditorChrome && (
          <EntityTranslationsPanel
            entityType="post"
            entityId={postId}
            canManage={canMutateContent}
            canAdministerTranslations={canMutateContent}
            canMutateTargets={canMutateContent}
          />
        )}

        {/* OG Image & Featured Image */}
        {showEditorChrome && (
          <MediaPreviewGrid>
            <OgImagePreview
              src={ogImage.src}
              canRegenerate={canMutateContent && activeEditLocale.hasLiveRow && ogRegenerationLocale !== null}
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
            <FeaturedImageUploader
              postId={postId}
              idPrefix={`post-${postId}-featured-image`}
              canEdit={canMutateSourceDocument}
              onOgGenerationRequested={() => void ogImage.trackLatest()}
            />
          </MediaPreviewGrid>
        )}

        {/* Options */}
        {showEditorChrome && (
          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              {tCommonLabels('options')}
            </Text>
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
          </Stack>
        )}

        {showEditorChrome && (
          <Stack gap="md">
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
          </Stack>
        )}

        {/* Selectors */}
        {showEditorChrome && (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            <CategorySelector
              postId={postId}
              canEdit={canEditSharedTaxonomy}
              isAdmin={isAdmin}
              categories={categories}
            />
            <TagSelector postId={postId} canEdit={canEditSharedTaxonomy} isAdmin={isAdmin} tags={tags} />
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
            <Stack gap={4}>
              <LocationSelector
                value={mapPlaceId}
                idPrefix={`post-${postId}-location`}
                onChange={handleMapPlaceChange}
                onCreateNew={handleCreatePlaceStart}
                canEdit={canMutateSourceDocument}
              />
            </Stack>
          </SimpleGrid>
        )}

        <PostEditorBody
          bodyMode={bodyMode}
          session={editorSession}
          postId={postId}
          userName={userName}
          editable={canEditLocaleDocument}
          showLabel={showEditorChrome}
          bodyLabel={tCommon('labels.body')}
          activeLocale={activeEditLocale.activeLocale}
          activeLocaleLabel={activeEditLocale.activeLocaleLabel}
          hasLiveRow={activeEditLocale.hasLiveRow}
          contentPreview={activeEditLocale.contentPreview}
          previewLoading={bodyPreviewLoading}
          isSourceLocale={activeEditLocale.isSourceLocale}
        />

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

        <EditorReloadRequiredDialog opened={revision.reloadRequired} onReload={() => window.location.reload()} />

        <PostPermissionRevokedDialog
          opened={permissionRevocation.revoked && !revision.reloadRequired}
          postId={postId}
        />

        <PostSessionExpiredDialog opened={permissionRevocation.sessionExpired && !revision.reloadRequired} />

        <CreatePlaceModal
          opened={createPlaceOpened}
          onClose={closeCreatePlace}
          onSubmit={handleCreatePlaceSubmit}
          isPending={createPlace.isPending}
          initialName={createPlaceInitialName}
        />
      </Stack>
    </EditorRuntimeProvider>
  );
}
