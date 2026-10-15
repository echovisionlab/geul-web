'use client';

import { useEditorAccessLevel } from '@/features/editor/useEditorAccessLevel';

import { AuthoringExtension } from '@/features/authoring/AuthoringExtensionsContext';
import { SupportingText, Text as DsText, VisuallyHidden } from '@/components/core/Typography';
import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
  LayoutInset,
} from '@/components/core/Layout';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconCheck, IconChevronDown, IconChevronUp, IconUsers, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Spinner as Loader, Pagination, StatusIcon, Table } from '@/components/core/Display';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { Button } from '@/components/core/Button';
import { DateTime } from '@/features/date-time/DateTime';
import { EditorHeader, type StatusOption } from '@/features/editor/EditorHeader';
import { IconButton } from '@/components/core/IconButton';
import { Textarea, TextInput } from '@/components/core/Input';
import { TextButton } from '@/components/core/TextButton';
import { MediaPreviewGrid } from '@/components/core/MediaPreviewGrid';
import { OgImagePreview } from '@/features/metadata/OgImagePreview';
import { EditorActiveLocaleControl } from '@/features/translation/EditorActiveLocaleControl';
import { EntityTranslationsPanel } from '@/features/translation/EntityTranslationsPanel';
import { useLocaleDocumentSession } from '@/features/translation/useLocaleDocumentSession';
import { flushEditorSaves } from '@/lib/editor/editor-save-registry';
import { SectionCard } from '@/components/core/Section';
import { ImageUploadCropController } from '@/features/upload/ImageUploadCropController';
import {
  regenerateSeriesOgImageAction,
  removeSeriesFeaturedImageAction,
  reorderSeriesPostsAction,
  setSeriesFeaturedImageAction,
  unassignPostFromSeriesAction,
  updateSeriesAction,
} from '@/lib/actions/series';
import { useSeriesOgLifecycle } from './useSeriesOgLifecycle';
import { useSlugManagement } from '@/lib/hooks/useSlugManagement';
import { useUpload } from '@/lib/hooks/useUpload';
import { listSeriesPosts } from '@/lib/queries/series-browser';
import type { SeriesStatus } from '@/lib/types/series/model';
import { UploadType } from '@/lib/types/upload/model';
import { SeriesManagersModal, type SeriesManagerBindings } from './SeriesManagersModal';
import { usePostSeriesCollaboration } from './usePostSeriesCollaboration';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
interface SeriesManager {
  memberId: string;
  nickname: string;
  avatarUrl?: string | null;
  createdAt?: Date;
}
interface SeriesPost {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  seriesOrder: number;
  publishedAt?: Date;
}
interface SeriesData {
  series: {
    id: string;
    title: string;
    slug: string;
    description?: string | null;
    status: SeriesStatus;
    featuredImageUrl?: string | null;
    ogImageUrl?: string | null;
    sourceLocale: string;
    createdAt?: Date;
    updatedAt?: Date;
  } | null;
  managers: SeriesManager[];
}
interface SeriesDetailProps {
  initialData: SeriesData;
  scope: 'admin' | 'my';
}
const STATUS_COLORS: Record<SeriesPost['status'], import('@/components/core/Typography').TextTone> = {
  draft: 'secondary',
  published: 'positive',
  archived: 'secondary',
};
function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const copy = [...items];
  const [picked] = copy.splice(from, 1);
  copy.splice(to, 0, picked);
  return copy;
}
function useSeriesDetailModel({ initialData, scope }: SeriesDetailProps) {
  const tPagination = useTranslations('dataTable.pagination');
  const t = useTranslations('seriesDetail');
  const tCommon = useTranslations('common');
  const tCommonLabels = useTranslations('common.labels');
  const tActions = useTranslations('common.actions');
  const tCommonNotifications = useTranslations('common.notifications');
  const tStatuses = useTranslations('common.statuses');
  const tFeaturedImage = useTranslations('featuredImage');
  const router = useRouter();
  const series = initialData.series!;
  const seriesId = series.id;
  const queryClient = useQueryClient();
  const [managersOpened, { open: openManagers, close: closeManagers }] = useDisclosure(false);
  const canManageManagers = scope === 'admin';
  const backHref = scope === 'admin' ? '/admin/series' : '/my/series';
  const canRegenerateOg = scope === 'admin';
  const [slug, setSlug] = useState(series.slug);
  const [status, setStatus] = useState<SeriesStatus>(series.status);
  const [featuredImageUrl, setFeaturedImageUrl] = useState(series.featuredImageUrl ?? null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const localeSession = useLocaleDocumentSession({
    entityType: 'post_series',
    entityId: seriesId,
    sourceTitle: series.title,
    sourceSummary: series.description ?? '',
    initialSourceLocale: series.sourceLocale,
  });
  const { activeEditLocale, roomLocale } = localeSession;
  const collaboration = usePostSeriesCollaboration(seriesId, roomLocale);
  const accessLevel = useEditorAccessLevel(collaboration.provider);
  const canEdit = accessLevel === 'edit';
  const roomState = collaboration.roomState;
  const displayedTitle = roomState?.fields.title ?? activeEditLocale.displayTitle;
  const displayedDescription = roomState?.fields.summary ?? activeEditLocale.displaySummary;
  const canEditCurrentCopy =
    canEdit &&
    collaboration.isSynced &&
    activeEditLocale.canEditActiveLocale &&
    activeEditLocale.hasLiveRow &&
    roomState?.locale === activeEditLocale.activeLocale &&
    roomState.sourceLocale === activeEditLocale.sourceLocale;
  const slugMgmt = useSlugManagement({
    entityType: 'series',
    entityId: seriesId,
    slug,
    onSlugChange: setSlug,
  });
  const ogImage = useSeriesOgLifecycle({
    seriesId,
    locale: activeEditLocale.hasLiveRow ? activeEditLocale.activeLocale : null,
    initialOgImageUrl: activeEditLocale.isSourceLocale
      ? (series.ogImageUrl ?? null)
      : activeEditLocale.displayOgImageUrl,
  });
  const translationOgGenerationRun = activeEditLocale.ogGenerationRun;
  useEffect(() => {
    if (translationOgGenerationRun) {
      ogImage.trackAutomaticGenerationRun(translationOgGenerationRun.runId);
    }
  }, [ogImage.trackAutomaticGenerationRun, translationOgGenerationRun]);
  const { upload, isUploading } = useUpload(UploadType.SERIES_FEATURED_IMAGE);
  const { data: posts = [] } = useQuery({
    queryKey: ['series', seriesId, 'posts'],
    queryFn: () => listSeriesPosts(seriesId),
  });
  const showPostMutationFailure = useCallback(
    (error: 'post_permission_revoked' | 'series_unavailable' | 'failed') => {
      notifications.show({
        message: error === 'failed' ? t('notifications.postsUpdateFailed') : t('notifications.accessChanged'),
        tone: 'danger',
      });
    },
    [t],
  );
  const [postsPage, setPostsPage] = useState(1);
  const postsPerPage = 10;
  const totalPostPages = Math.max(1, Math.ceil(posts.length / postsPerPage));
  const safePostsPage = Math.min(postsPage, totalPostPages);
  const seriesStatusOptions: StatusOption<SeriesStatus>[] = [
    {
      value: 'draft',
      label: tStatuses('draft'),
      actionLabel: tActions('unpublish'),
      tone: 'neutral',
    },
    {
      value: 'published',
      label: tStatuses('published'),
      actionLabel: tActions('publish'),
      tone: 'positive',
    },
  ];
  const pagedPosts = useMemo(() => {
    const start = (safePostsPage - 1) * postsPerPage;
    return posts.slice(start, start + postsPerPage);
  }, [posts, safePostsPage]);
  const updateSeries = useMutation({
    mutationFn: (data: {
      id: string;
      title?: string;
      slug?: string;
      description?: string | null;
      status?: SeriesStatus;
    }) => updateSeriesAction(data.id, data),
    onSuccess: (result, variables) => {
      if (result.error) {
        notifications.show({ message: t('notifications.updateFailed'), tone: 'danger' });
        return;
      }
      notifications.show({ message: t('notifications.updated'), tone: 'positive' });
      ogImage.trackTitleUpdate(variables);
    },
    onError: () => {
      notifications.show({ message: t('notifications.updateFailed'), tone: 'danger' });
    },
  });
  const changeStatus = useMutation({
    mutationFn: (nextStatus: SeriesStatus) =>
      updateSeriesAction(seriesId, {
        status: nextStatus,
      }),
    onSuccess: (result, nextStatus) => {
      if (result.error) {
        notifications.show({ message: t('notifications.statusUpdateFailed'), tone: 'danger' });
        return;
      }
      setStatus(nextStatus);
      notifications.show({ message: t('notifications.statusUpdated'), tone: 'positive' });
    },
    onError: () => {
      notifications.show({ message: t('notifications.statusUpdateFailed'), tone: 'danger' });
    },
  });
  const regenerateOgImage = useMutation({
    mutationFn: (request: { locale: string; targetKey: string }) =>
      regenerateSeriesOgImageAction(seriesId, request.locale),
    onSuccess: (result, request) => {
      if (result.error) {
        notifications.show({ message: tCommonNotifications('ogRegenerationFailed'), tone: 'danger' });
        return;
      }
      notifications.show({ message: tCommonNotifications('ogGenerationRequested'), tone: 'neutral' });
      ogImage.trackManualGeneration(result.generationId, request.targetKey);
    },
    onError: () => {
      notifications.show({ message: tCommonNotifications('ogRegenerationFailed'), tone: 'danger' });
    },
  });
  const reorderPosts = useMutation({
    mutationFn: (postIds: string[]) => reorderSeriesPostsAction(seriesId, postIds),
    onMutate: async (postIds) => {
      const queryKey = ['series', seriesId, 'posts'] as const;
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<typeof posts>(queryKey);
      if (previous) {
        const byId = new Map(previous.map((post) => [post.id, post]));
        queryClient.setQueryData(
          queryKey,
          postIds.flatMap((id, index) => {
            const post = byId.get(id);
            return post ? [{ ...post, seriesOrder: index }] : [];
          }),
        );
      }
      return { previous, queryKey };
    },
    onSuccess: (result, _postIds, context) => {
      if (result.error) {
        if (context?.previous) {
          queryClient.setQueryData(context.queryKey, context.previous);
        }
        showPostMutationFailure(result.error);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['series', seriesId, 'posts'] });
    },
    onError: (_error, _postIds, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
      showPostMutationFailure('failed');
    },
  });
  const unassignPost = useMutation({
    mutationFn: (postId: string) => unassignPostFromSeriesAction(seriesId, postId),
    onMutate: async (postId) => {
      const queryKey = ['series', seriesId, 'posts'] as const;
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<typeof posts>(queryKey);
      if (previous) {
        queryClient.setQueryData(
          queryKey,
          previous.filter((post) => post.id !== postId).map((post, index) => ({ ...post, seriesOrder: index })),
        );
      }
      return { previous, queryKey };
    },
    onSuccess: (result, _postId, context) => {
      if (result.error) {
        if (context?.previous) {
          queryClient.setQueryData(context.queryKey, context.previous);
        }
        showPostMutationFailure(result.error);
        return;
      }
      notifications.show({
        message: tCommonNotifications('postRemovedFromSeries'),
        tone: 'positive',
      });
      void queryClient.invalidateQueries({ queryKey: ['series', seriesId, 'posts'] });
    },
    onError: (_error, _postId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
      showPostMutationFailure('failed');
    },
  });
  const setFeaturedImage = useMutation({
    mutationFn: (fileId: string) => setSeriesFeaturedImageAction(seriesId, fileId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: tCommonNotifications('updateFailed'), tone: 'danger' });
        return;
      }
      setFeaturedImageUrl(result.imageUrl ?? null);
      ogImage.trackAutomaticGenerationRun(result.ogGenerationRunId);
      notifications.show({
        message: tCommonNotifications('featuredImageUpdated'),
        tone: 'positive',
      });
    },
    onError: () => {
      notifications.show({ message: tCommonNotifications('updateFailed'), tone: 'danger' });
    },
  });
  const removeFeaturedImage = useMutation({
    mutationFn: () => removeSeriesFeaturedImageAction(seriesId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: tCommonNotifications('updateFailed'), tone: 'danger' });
        return;
      }
      setFeaturedImageUrl(null);
      ogImage.trackAutomaticGenerationRun(result.ogGenerationRunId);
      notifications.show({
        message: tCommonNotifications('featuredImageRemoved'),
        tone: 'positive',
      });
    },
    onError: () => {
      notifications.show({ message: tCommonNotifications('updateFailed'), tone: 'danger' });
    },
  });
  const handleSave = () => {
    updateSeries.mutate({
      id: seriesId,
      slug,
    });
  };
  const flushPendingSaves = useCallback(async () => {
    const saved = await flushEditorSaves(`post_series:${seriesId}`);
    if (!saved) {
      notifications.show({ message: tCommonNotifications('saveFailed'), tone: 'danger' });
    }
    return saved;
  }, [seriesId, tCommonNotifications]);
  const handleBack = useCallback(async () => {
    if (await flushPendingSaves()) {
      router.push(backHref);
    }
  }, [backHref, flushPendingSaves, router]);
  const handleStatusChange = useCallback(
    async (nextStatus: SeriesStatus) => {
      if (nextStatus === status || !(await flushPendingSaves())) {
        return;
      }
      changeStatus.mutate(nextStatus);
    },
    [changeStatus, flushPendingSaves, status],
  );
  const handleTitleChange = useCallback(
    (value: string) => {
      if (!canEditCurrentCopy) {
        return;
      }
      collaboration.setField('title', value);
      if (activeEditLocale.isSourceLocale) {
        slugMgmt.updateFromTitle(value);
      }
    },
    [activeEditLocale.isSourceLocale, slugMgmt.updateFromTitle, canEditCurrentCopy, collaboration],
  );
  const movePost = (postId: string, direction: 'up' | 'down') => {
    const currentIndex = posts.findIndex((p) => p.id === postId);
    if (currentIndex === -1) {
      return;
    }
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= posts.length) {
      return;
    }
    const moved = moveItem(posts, currentIndex, nextIndex);
    reorderPosts.mutate(moved.map((p) => p.id));
  };
  const handleFeaturedImageUpload = async (croppedBlob: Blob) => {
    setUploadProgress(0);
    try {
      const { fileId } = await upload(croppedBlob, {
        entityId: seriesId,
        fileName: 'featured',
        onProgress: (progress) => setUploadProgress(progress.percentage),
      });
      await setFeaturedImage.mutateAsync(fileId);
    } catch (error) {
      notifications.show({
        message: error instanceof Error ? error.message : tCommonNotifications('uploadFailed'),
        tone: 'danger',
      });
    } finally {
      setUploadProgress(0);
    }
  };
  return {
    kind: 'ready' as const,
    collaboration,
    seriesId,
    displayedTitle,
    handleTitleChange,
    tCommon,
    canEdit,
    canEditCurrentCopy,
    activeEditLocale,
    status,
    seriesStatusOptions,
    handleBack,
    handleStatusChange,
    changeStatus,
    tCommonLabels,
    openManagers,
    ogImage,
    canRegenerateOg,
    regenerateOgImage,
    featuredImageUrl,
    isUploading,
    uploadProgress,
    removeFeaturedImage,
    handleFeaturedImageUpload,
    tFeaturedImage,
    slug,
    slugMgmt,
    t,
    displayedDescription,
    handleSave,
    updateSeries,
    tActions,
    scope,
    posts,
    postsPerPage,
    totalPostPages,
    safePostsPage,
    setPostsPage,
    tPagination,
    pagedPosts,
    tStatuses,
    reorderPosts,
    movePost,
    unassignPost,
    managersOpened,
    closeManagers,
    canManageManagers,
  };
}

type SeriesDetailControllerModel = ReturnType<typeof useSeriesDetailModel>;
type SeriesDetailReadyModel = Extract<SeriesDetailControllerModel, { kind: 'ready' }>;
export type SeriesDetailViewModel =
  | Exclude<SeriesDetailControllerModel, { kind: 'ready' }>
  | (Omit<
      SeriesDetailReadyModel,
      | 'collaboration'
      | 'changeStatus'
      | 'ogImage'
      | 'regenerateOgImage'
      | 'removeFeaturedImage'
      | 'slugMgmt'
      | 'updateSeries'
      | 'reorderPosts'
      | 'unassignPost'
    > & {
      collaboration:
        | Pick<
            NonNullable<SeriesDetailReadyModel['collaboration']>,
            'provider' | 'isConnected' | 'isSynced' | 'setField'
          >
        | Extract<SeriesDetailReadyModel['collaboration'], null | undefined>;
      changeStatus:
        | Pick<NonNullable<SeriesDetailReadyModel['changeStatus']>, 'isPending'>
        | Extract<SeriesDetailReadyModel['changeStatus'], null | undefined>;
      ogImage:
        | Pick<
            NonNullable<SeriesDetailReadyModel['ogImage']>,
            'src' | 'isRegenerating' | 'status' | 'error' | 'targetKey'
          >
        | Extract<SeriesDetailReadyModel['ogImage'], null | undefined>;
      regenerateOgImage:
        | Pick<NonNullable<SeriesDetailReadyModel['regenerateOgImage']>, 'isPending' | 'mutate'>
        | Extract<SeriesDetailReadyModel['regenerateOgImage'], null | undefined>;
      removeFeaturedImage:
        | Pick<NonNullable<SeriesDetailReadyModel['removeFeaturedImage']>, 'isPending' | 'mutate'>
        | Extract<SeriesDetailReadyModel['removeFeaturedImage'], null | undefined>;
      slugMgmt:
        | Pick<NonNullable<SeriesDetailReadyModel['slugMgmt']>, 'handleChange' | 'error' | 'isChecking' | 'isAvailable'>
        | Extract<SeriesDetailReadyModel['slugMgmt'], null | undefined>;
      updateSeries:
        | Pick<NonNullable<SeriesDetailReadyModel['updateSeries']>, 'isPending'>
        | Extract<SeriesDetailReadyModel['updateSeries'], null | undefined>;
      reorderPosts:
        | Pick<NonNullable<SeriesDetailReadyModel['reorderPosts']>, 'isPending'>
        | Extract<SeriesDetailReadyModel['reorderPosts'], null | undefined>;
      unassignPost:
        | Pick<NonNullable<SeriesDetailReadyModel['unassignPost']>, 'isPending' | 'mutate'>
        | Extract<SeriesDetailReadyModel['unassignPost'], null | undefined>;
    });
export function SeriesDetailView({
  model,
  managerBindings,
}: {
  model: SeriesDetailViewModel;
  managerBindings?: SeriesManagerBindings;
}) {
  const viewId = useId();
  const viewRef = useRef<HTMLElement>(null);
  const pendingRemoval = useRef<{ id: string; nextId?: string } | null>(null);
  const pendingReorder = useRef<{ id: string; label: string } | null>(null);
  const [orderAnnouncement, setOrderAnnouncement] = useState('');
  const {
    collaboration,
    seriesId,
    displayedTitle,
    handleTitleChange,
    tCommon,
    canEdit,
    canEditCurrentCopy,
    activeEditLocale,
    status,
    seriesStatusOptions,
    handleBack,
    handleStatusChange,
    changeStatus,
    tCommonLabels,
    openManagers,
    ogImage,
    canRegenerateOg,
    regenerateOgImage,
    featuredImageUrl,
    isUploading,
    uploadProgress,
    removeFeaturedImage,
    handleFeaturedImageUpload,
    tFeaturedImage,
    slug,
    slugMgmt,
    t,
    displayedDescription,
    handleSave,
    updateSeries,
    tActions,
    scope,
    posts,
    postsPerPage,
    totalPostPages,
    safePostsPage,
    setPostsPage,
    tPagination,
    pagedPosts,
    tStatuses,
    reorderPosts,
    movePost,
    unassignPost,
    managersOpened,
    closeManagers,
    canManageManagers,
  } = model;
  useEffect(() => {
    const reorder = pendingReorder.current;
    if (!reorder || reorderPosts.isPending) {
      return;
    }
    pendingReorder.current = null;
    const row = Array.from(viewRef.current?.querySelectorAll<HTMLElement>('[data-series-post]') ?? []).find(
      (candidate) => candidate.dataset.seriesPost === reorder.id,
    );
    const buttons = Array.from(row?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    (
      buttons.find((button) => button.getAttribute('aria-label') === reorder.label) ??
      buttons[0] ??
      viewRef.current?.querySelector<HTMLElement>('[data-series-posts-heading]')
    )?.focus();
  }, [posts, pagedPosts, reorderPosts.isPending]);
  useEffect(() => {
    const removal = pendingRemoval.current;
    if (!removal || posts.some((post) => post.id === removal.id)) {
      return;
    }
    pendingRemoval.current = null;
    const rows = Array.from(viewRef.current?.querySelectorAll<HTMLElement>('[data-series-post]') ?? []);
    const next = rows.find((row) => row.dataset.seriesPost === removal.nextId) ?? rows[0];
    (
      next?.querySelector<HTMLElement>('a, button:not(:disabled)') ??
      viewRef.current?.querySelector<HTMLElement>('[data-series-posts-heading]')
    )?.focus();
  }, [posts]);
  return (
    <EditorRuntimeProvider provider={collaboration.provider} entityType="series" entityId={seriesId}>
      <DsLayoutStack ref={viewRef}>
        <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
          {orderAnnouncement}
        </VisuallyHidden>
        <EditorHeader
          title={displayedTitle}
          onTitleChange={handleTitleChange}
          titlePlaceholder={tCommon('states.untitledEntity', { entity: tCommon('entities.series') })}
          titleDisabled={!canEditCurrentCopy || activeEditLocale.isLoading}
          status={status}
          statusOptions={seriesStatusOptions}
          isConnected={collaboration.isConnected}
          isSynced={collaboration.isSynced}
          onBack={handleBack}
          onStatusChange={canEdit ? handleStatusChange : undefined}
          isStatusChanging={changeStatus.isPending}
          backTooltip={tCommon('actions.back')}
          controls={<EditorActiveLocaleControl state={activeEditLocale} />}
          actionItems={[
            {
              key: 'members',
              label: tCommonLabels('managers'),
              tooltip: tCommonLabels('managers'),
              ariaLabel: tCommonLabels('managers'),
              icon: <IconUsers size={20} />,
              iconOnly: true,
              onClick: openManagers,
            },
          ]}
        />

        <MediaPreviewGrid>
          <OgImagePreview
            src={ogImage.src}
            canRegenerate={
              canEdit && canRegenerateOg && activeEditLocale.hasLiveRow && Boolean(activeEditLocale.activeLocale)
            }
            isRegenerating={regenerateOgImage.isPending || ogImage.isRegenerating}
            generationStatus={ogImage.status}
            generationError={ogImage.error}
            onRegenerate={() => {
              if (activeEditLocale.activeLocale) {
                regenerateOgImage.mutate({
                  locale: activeEditLocale.activeLocale,
                  targetKey: ogImage.targetKey,
                });
              }
            }}
          />
          <ImageUploadCropController
            imageUrl={featuredImageUrl}
            canEdit={canEdit}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            isRemoving={removeFeaturedImage.isPending}
            onUpload={handleFeaturedImageUpload}
            onRemove={() => removeFeaturedImage.mutate()}
            label={tFeaturedImage('label')}
          />
        </MediaPreviewGrid>

        <LayoutInset space="none" blockStart="md">
          <SectionCard>
            <DsLayoutStack>
              <DsLayoutInline gap="xs">
                <DsText id={`${viewId}-slug`} size="sm" weight="medium">
                  {tCommon('labels.slug')}
                </DsText>
              </DsLayoutInline>
              <TextInput
                aria-labelledby={`${viewId}-slug`}
                value={slug}
                onChange={(e) => slugMgmt.handleChange(e.currentTarget.value)}
                disabled={!canEdit || !activeEditLocale.isSourceLocale}
                error={slugMgmt.error}
                rightSection={
                  slugMgmt.isChecking ? (
                    <Loader size="xs" />
                  ) : slug && slugMgmt.isAvailable === true ? (
                    <StatusIcon icon={IconCheck} tone="positive" />
                  ) : undefined
                }
                description={t('slug.manualDescription')}
              />
              <Textarea
                label={tCommon('labels.description')}
                value={displayedDescription}
                onChange={(event) => {
                  if (!canEditCurrentCopy) {
                    return;
                  }
                  collaboration.setField('summary', event.currentTarget.value);
                }}
                disabled={!canEditCurrentCopy || activeEditLocale.isLoading}
                minRows={3}
              />
              {activeEditLocale.isSourceLocale && (
                <DsLayoutInline justify="end">
                  <Button disabled={!canEdit} onClick={handleSave} loading={updateSeries.isPending}>
                    {tActions('saveChanges')}
                  </Button>
                </DsLayoutInline>
              )}
            </DsLayoutStack>
          </SectionCard>
        </LayoutInset>

        <AuthoringExtension kind="translations">
          <EntityTranslationsPanel
            entityType="post_series"
            entityId={seriesId}
            canManage
            canMutateTargets={canEdit}
            canAdministerTranslations={canEdit && scope === 'admin'}
          />
        </AuthoringExtension>

        <LayoutInset space="none" blockStart="md">
          <SectionCard>
            <DsLayoutInset blockEnd="md">
              <DsLayoutInline justify="between">
                <DsText
                  id={`${viewId}-posts`}
                  role="heading"
                  aria-level={2}
                  tabIndex={-1}
                  data-series-posts-heading
                  size="sm"
                  weight="strong"
                >
                  {t('posts.title', { count: posts.length })}
                </DsText>
                {posts.length > postsPerPage && (
                  <Pagination
                    total={totalPostPages}
                    value={safePostsPage}
                    onChange={setPostsPage}
                    size="sm"
                    labels={{
                      previousPage: tPagination('previousPage'),
                      nextPage: tPagination('nextPage'),
                      page: (page) => tPagination('page', { page }),
                    }}
                  />
                )}
              </DsLayoutInline>
            </DsLayoutInset>

            {posts.length === 0 ? (
              <SupportingText tone="secondary">{tCommon('messages.noPostsFound')}</SupportingText>
            ) : (
              <Table.ScrollContainer
                minWidth={640}
                role="region"
                aria-label={t('posts.title', { count: posts.length })}
                tabIndex={0}
              >
                <Table
                  striped
                  highlightOnHover
                  aria-labelledby={`${viewId}-posts`}
                  aria-busy={reorderPosts.isPending || unassignPost.isPending}
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th scope="col" width={72}>
                        {t('posts.columns.order')}
                      </Table.Th>
                      <Table.Th scope="col">{tCommon('entities.post')}</Table.Th>
                      <Table.Th scope="col" width={120}>
                        {tCommon('labels.status')}
                      </Table.Th>
                      <Table.Th scope="col" width={160}>
                        {tCommon('labels.published')}
                      </Table.Th>
                      <Table.Th scope="col" width={110}>
                        {tCommon('labels.actions')}
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {pagedPosts.map((post) => {
                      const absoluteIndex = posts.findIndex((p) => p.id === post.id);
                      const isFirst = absoluteIndex <= 0;
                      const isLast = absoluteIndex === posts.length - 1;
                      return (
                        <Table.Tr key={post.id} data-series-post={post.id}>
                          <Table.Td id={`${viewId}-order-${post.id}`}>#{absoluteIndex + 1}</Table.Td>
                          <Table.Td>
                            <DsLayoutStack gap="xxs">
                              <TextButton
                                id={`${viewId}-post-${post.id}`}
                                href={`/posts/${post.id}?edit=true`}
                                size="sm"
                                weight="medium"
                                appearance="accent"
                              >
                                {post.title || tCommon('states.untitled')}
                              </TextButton>
                              {post.slug && (
                                <DsText size="xs" tone="secondary">
                                  /{post.slug}
                                </DsText>
                              )}
                            </DsLayoutStack>
                          </Table.Td>
                          <Table.Td>
                            <DsText size="sm" tone={STATUS_COLORS[post.status]}>
                              {tStatuses(post.status)}
                            </DsText>
                          </Table.Td>
                          <Table.Td>
                            <DsText size="sm" tone="secondary">
                              <DateTime value={post.publishedAt} />
                            </DsText>
                          </Table.Td>
                          <Table.Td>
                            <DsLayoutInline gap="xxs">
                              <IconButton
                                size="sm"
                                emphasis="low"
                                disabled={!canEdit || isFirst || reorderPosts.isPending}
                                onClick={() => {
                                  pendingReorder.current = { id: post.id, label: t('posts.actions.moveUp') };
                                  setOrderAnnouncement(
                                    `${post.title || tCommon('states.untitled')}: ${t('posts.columns.order')} #${absoluteIndex}`,
                                  );
                                  movePost(post.id, 'up');
                                }}
                                aria-describedby={`${viewId}-post-${post.id} ${viewId}-order-${post.id}`}
                                aria-label={t('posts.actions.moveUp')}
                              >
                                <IconChevronUp size={14} />
                              </IconButton>
                              <IconButton
                                size="sm"
                                emphasis="low"
                                disabled={!canEdit || isLast || reorderPosts.isPending}
                                onClick={() => {
                                  pendingReorder.current = { id: post.id, label: t('posts.actions.moveDown') };
                                  setOrderAnnouncement(
                                    `${post.title || tCommon('states.untitled')}: ${t('posts.columns.order')} #${absoluteIndex + 2}`,
                                  );
                                  movePost(post.id, 'down');
                                }}
                                aria-describedby={`${viewId}-post-${post.id} ${viewId}-order-${post.id}`}
                                aria-label={t('posts.actions.moveDown')}
                              >
                                <IconChevronDown size={14} />
                              </IconButton>
                              <IconButton
                                size="sm"
                                tone="danger"
                                emphasis="low"
                                disabled={!canEdit || unassignPost.isPending}
                                onClick={() => {
                                  pendingRemoval.current = {
                                    id: post.id,
                                    nextId: posts[absoluteIndex + 1]?.id ?? posts[absoluteIndex - 1]?.id,
                                  };
                                  unassignPost.mutate(post.id);
                                }}
                                aria-describedby={`${viewId}-post-${post.id}`}
                                aria-label={t('posts.actions.remove')}
                              >
                                <IconX size={14} />
                              </IconButton>
                            </DsLayoutInline>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </SectionCard>
        </LayoutInset>

        <SeriesManagersModal
          seriesId={seriesId}
          opened={managersOpened}
          onClose={closeManagers}
          canManageManagers={canEdit && canManageManagers}
          bindings={managerBindings}
        />
      </DsLayoutStack>
    </EditorRuntimeProvider>
  );
}
export function SeriesDetail(...args: Parameters<typeof useSeriesDetailModel>) {
  return <SeriesDetailView model={useSeriesDetailModel(...args)} />;
}
