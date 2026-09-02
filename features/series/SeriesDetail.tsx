'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconChevronDown, IconChevronUp, IconUsers, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Group, Loader, Pagination, Stack, Table, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
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
import { SeriesManagersModal } from './SeriesManagersModal';
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

const STATUS_COLORS: Record<SeriesPost['status'], string> = {
  draft: 'yellow',
  published: 'green',
  archived: 'gray',
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

export function SeriesDetail({ initialData, scope }: SeriesDetailProps) {
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
  const roomState = collaboration.roomState;
  const displayedTitle = roomState?.fields.title ?? activeEditLocale.displayTitle;
  const displayedDescription = roomState?.fields.summary ?? activeEditLocale.displaySummary;
  const canEditCurrentCopy =
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
        color: 'red',
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
        notifications.show({ message: t('notifications.updateFailed'), color: 'red' });
        return;
      }
      notifications.show({ message: t('notifications.updated'), color: 'green' });
      ogImage.trackTitleUpdate(variables);
    },
    onError: () => {
      notifications.show({ message: t('notifications.updateFailed'), color: 'red' });
    },
  });

  const changeStatus = useMutation({
    mutationFn: (nextStatus: SeriesStatus) =>
      updateSeriesAction(seriesId, {
        status: nextStatus,
      }),
    onSuccess: (result, nextStatus) => {
      if (result.error) {
        notifications.show({ message: t('notifications.statusUpdateFailed'), color: 'red' });
        return;
      }
      setStatus(nextStatus);
      notifications.show({ message: t('notifications.statusUpdated'), color: 'green' });
    },
    onError: () => {
      notifications.show({ message: t('notifications.statusUpdateFailed'), color: 'red' });
    },
  });

  const regenerateOgImage = useMutation({
    mutationFn: (request: { locale: string; targetKey: string }) =>
      regenerateSeriesOgImageAction(seriesId, request.locale),
    onSuccess: (result, request) => {
      if (result.error) {
        notifications.show({ message: tCommonNotifications('ogRegenerationFailed'), color: 'red' });
        return;
      }
      notifications.show({ message: tCommonNotifications('ogGenerationRequested'), color: 'blue' });
      ogImage.trackManualGeneration(result.generationId, request.targetKey);
    },
    onError: () => {
      notifications.show({ message: tCommonNotifications('ogRegenerationFailed'), color: 'red' });
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
        color: 'yellow',
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
        notifications.show({ message: tCommonNotifications('updateFailed'), color: 'red' });
        return;
      }
      setFeaturedImageUrl(result.imageUrl ?? null);
      ogImage.trackAutomaticGenerationRun(result.ogGenerationRunId);
      notifications.show({
        message: tCommonNotifications('featuredImageUpdated'),
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({ message: tCommonNotifications('updateFailed'), color: 'red' });
    },
  });

  const removeFeaturedImage = useMutation({
    mutationFn: () => removeSeriesFeaturedImageAction(seriesId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: tCommonNotifications('updateFailed'), color: 'red' });
        return;
      }
      setFeaturedImageUrl(null);
      ogImage.trackAutomaticGenerationRun(result.ogGenerationRunId);
      notifications.show({
        message: tCommonNotifications('featuredImageRemoved'),
        color: 'yellow',
      });
    },
    onError: () => {
      notifications.show({ message: tCommonNotifications('updateFailed'), color: 'red' });
    },
  });

  const handleSave = () => {
    updateSeries.mutate({
      id: seriesId,
      slug,
    });
  };

  const handleStatusChange = (nextStatus: SeriesStatus) => {
    if (nextStatus === status) {
      return;
    }
    changeStatus.mutate(nextStatus);
  };

  const handleTitleChange = useCallback(
    (value: string) => {
      if (!canEditCurrentCopy) {
        return;
      }
      collaboration.setField('title', value);
    },
    [canEditCurrentCopy, collaboration],
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
        color: 'red',
      });
    } finally {
      setUploadProgress(0);
    }
  };

  return (
    <EditorRuntimeProvider provider={collaboration.provider} entityType="series" entityId={seriesId}>
      <Stack>
        <EditorHeader
          title={displayedTitle}
          onTitleChange={handleTitleChange}
          titlePlaceholder={tCommon('states.untitledEntity', { entity: tCommon('entities.series') })}
          titleDisabled={!canEditCurrentCopy || activeEditLocale.isLoading}
          status={status}
          statusOptions={seriesStatusOptions}
          isConnected={collaboration.isConnected}
          isSynced={collaboration.isSynced}
          onBack={() => router.push(backHref)}
          onStatusChange={handleStatusChange}
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
            canRegenerate={canRegenerateOg && activeEditLocale.hasLiveRow && Boolean(activeEditLocale.activeLocale)}
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
            canEdit
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            isRemoving={removeFeaturedImage.isPending}
            onUpload={handleFeaturedImageUpload}
            onRemove={() => removeFeaturedImage.mutate()}
            label={tFeaturedImage('label')}
          />
        </MediaPreviewGrid>

        <SectionCard mt="md">
          <Stack>
            <Group gap="xs">
              <Text size="sm" fw={500}>
                {tCommon('labels.slug')}
              </Text>
            </Group>
            <TextInput
              value={slug}
              onChange={(e) => slugMgmt.handleChange(e.currentTarget.value)}
              disabled={!activeEditLocale.isSourceLocale}
              error={slugMgmt.error}
              rightSection={slugMgmt.isChecking ? <Loader size={14} /> : undefined}
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
              <Group justify="flex-end">
                <Button onClick={handleSave} loading={updateSeries.isPending}>
                  {tActions('saveChanges')}
                </Button>
              </Group>
            )}
          </Stack>
        </SectionCard>

        <EntityTranslationsPanel
          entityType="post_series"
          entityId={seriesId}
          canManage
          canAdministerTranslations={scope === 'admin'}
        />

        <SectionCard mt="md">
          <Group justify="space-between" mb="md">
            <Text fw={600}>{t('posts.title', { count: posts.length })}</Text>
            {posts.length > postsPerPage && (
              <Pagination total={totalPostPages} value={safePostsPage} onChange={setPostsPage} size="sm" />
            )}
          </Group>

          {posts.length === 0 ? (
            <Text c="dimmed" size="sm">
              {tCommon('messages.noPostsFound')}
            </Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={72}>{t('posts.columns.order')}</Table.Th>
                  <Table.Th>{tCommon('entities.post')}</Table.Th>
                  <Table.Th w={120}>{tCommon('labels.status')}</Table.Th>
                  <Table.Th w={160}>{tCommon('labels.published')}</Table.Th>
                  <Table.Th w={110}>{tCommon('labels.actions')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {pagedPosts.map((post) => {
                  const absoluteIndex = posts.findIndex((p) => p.id === post.id);
                  const isFirst = absoluteIndex <= 0;
                  const isLast = absoluteIndex === posts.length - 1;

                  return (
                    <Table.Tr key={post.id}>
                      <Table.Td>#{absoluteIndex + 1}</Table.Td>
                      <Table.Td>
                        <Stack gap={2}>
                          <TextButton
                            href={`/posts/${post.id}?edit=true`}
                            size="sm"
                            weight="medium"
                            appearance="accent"
                          >
                            {post.title || tCommon('states.untitled')}
                          </TextButton>
                          {post.slug && (
                            <Text size="xs" c="dimmed">
                              /{post.slug}
                            </Text>
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c={STATUS_COLORS[post.status]}>
                          {tStatuses(post.status)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          <DateTime value={post.publishedAt} />
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <IconButton
                            size="sm"
                            emphasis="low"
                            disabled={isFirst || reorderPosts.isPending}
                            onClick={() => movePost(post.id, 'up')}
                            aria-label={t('posts.actions.moveUp')}
                          >
                            <IconChevronUp size={14} />
                          </IconButton>
                          <IconButton
                            size="sm"
                            emphasis="low"
                            disabled={isLast || reorderPosts.isPending}
                            onClick={() => movePost(post.id, 'down')}
                            aria-label={t('posts.actions.moveDown')}
                          >
                            <IconChevronDown size={14} />
                          </IconButton>
                          <IconButton
                            size="sm"
                            tone="danger"
                            emphasis="low"
                            disabled={unassignPost.isPending}
                            onClick={() => unassignPost.mutate(post.id)}
                            aria-label={t('posts.actions.remove')}
                          >
                            <IconX size={14} />
                          </IconButton>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </SectionCard>

        <SeriesManagersModal
          seriesId={seriesId}
          opened={managersOpened}
          onClose={closeManagers}
          canManageManagers={canManageManagers}
        />
      </Stack>
    </EditorRuntimeProvider>
  );
}
