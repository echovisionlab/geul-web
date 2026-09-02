'use client';

import { useCallback, useEffect, useState } from 'react';
import { IconChevronDown, IconChevronUp, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Combobox, Group, InputBase, Loader, Stack, Text, useCombobox } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { LabelBadge } from '@/components/core/Badge';
import { IconButton } from '@/components/core/IconButton';
import {
  assignPostToSeriesAction,
  createSeriesAction,
  reorderSeriesPostsAction,
  type SeriesPostMutationError,
  unassignPostFromSeriesAction,
} from '../../../lib/actions/series';
import { listMySeries, listSeriesPosts, listSeriesSimple } from '../../../lib/queries/series-browser';
import type { SeriesBasic } from '@/lib/types/series/model';

interface SeriesSelectorProps {
  postId: string;
  idPrefix?: string;
  initialSeriesId: string | null;
  initialSeriesOrder: number | null;
  canEdit: boolean;
  isAdmin: boolean;
  series: SeriesBasic[];
  onPostPermissionRevoked: () => void;
}

export function SeriesSelector({
  postId,
  idPrefix,
  initialSeriesId,
  initialSeriesOrder,
  canEdit,
  isAdmin,
  series: initialSeries,
  onPostPermissionRevoked,
}: SeriesSelectorProps) {
  const t = useTranslations('postEditor.seriesSelector');
  const tSeriesPostActions = useTranslations('seriesDetail.posts.actions');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonNotifications = useTranslations('common.notifications');
  const tCommonStates = useTranslations('common.states');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(initialSeriesId);
  const [seriesOrder, setSeriesOrder] = useState<number | null>(initialSeriesOrder);
  const [committedSeriesId, setCommittedSeriesId] = useState<string | null>(initialSeriesId);
  const [committedSeriesOrder, setCommittedSeriesOrder] = useState<number | null>(initialSeriesOrder);
  const [search, setSearch] = useState('');
  const [isRefreshingOptions, setIsRefreshingOptions] = useState(false);

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const queryClient = useQueryClient();

  const {
    data: allSeriesList = initialSeries,
    isError: allError,
    isFetching: allFetching,
    isLoading: allLoading,
    refetch: refetchAllSeries,
  } = useQuery({
    queryKey: ['series', 'listAllSimple'],
    queryFn: () => listSeriesSimple(),
    enabled: isAdmin,
    initialData: isAdmin ? initialSeries : undefined,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });

  const {
    data: mySeriesList = initialSeries,
    isError: myError,
    isFetching: myFetching,
    isLoading: myLoading,
    refetch: refetchMySeries,
  } = useQuery({
    queryKey: ['series', 'mySeriesList'],
    queryFn: () => listMySeries(),
    enabled: !isAdmin,
    initialData: !isAdmin ? initialSeries : undefined,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });

  const seriesList = isAdmin ? allSeriesList : mySeriesList;
  const optionsError = isAdmin ? allError : myError;
  const optionsFetching = isAdmin ? allFetching : myFetching;
  const isLoading = isAdmin ? allLoading : myLoading;
  const selectedSeries = seriesList.find((item) => item.id === selectedSeriesId);
  const canManageSelectedSeries = selectedSeries !== undefined && !optionsError && !optionsFetching;

  const { data: seriesPosts = [] } = useQuery({
    queryKey: ['series', selectedSeriesId, 'posts'],
    queryFn: () => listSeriesPosts(selectedSeriesId!),
    enabled: !!selectedSeriesId && canManageSelectedSeries,
  });

  useEffect(() => {
    if (!selectedSeriesId) {
      setSeriesOrder(null);
      return;
    }
    const current = seriesPosts.find((post) => post.id === postId);
    const nextOrder = current ? current.seriesOrder : null;
    setSeriesOrder(nextOrder);
    if (selectedSeriesId === committedSeriesId) {
      setCommittedSeriesOrder(nextOrder);
    }
  }, [committedSeriesId, selectedSeriesId, seriesPosts, postId]);

  const refreshSeriesOptions = useCallback(async (): Promise<boolean> => {
    setIsRefreshingOptions(true);
    try {
      if (isAdmin) {
        const result = await refetchAllSeries();
        return result.isSuccess;
      }
      const result = await refetchMySeries();
      return result.isSuccess;
    } finally {
      setIsRefreshingOptions(false);
    }
  }, [isAdmin, refetchAllSeries, refetchMySeries]);

  const showMutationFailure = useCallback(
    (error: SeriesPostMutationError) => {
      if (error === 'post_permission_revoked') {
        onPostPermissionRevoked();
        return;
      }
      notifications.show({
        message:
          error === 'series_unavailable' ? t('notifications.seriesUnavailable') : t('notifications.updateFailed'),
        color: 'red',
      });
      if (error === 'series_unavailable') {
        void refreshSeriesOptions().then((success) => {
          if (!success) {
            notifications.show({ message: tCommonNotifications('updateFailed'), color: 'red' });
          }
        });
      }
    },
    [onPostPermissionRevoked, refreshSeriesOptions, t, tCommonNotifications],
  );

  const assignPost = useMutation({
    mutationFn: ({ seriesId }: { seriesId: string; previousId: string | null; previousOrder: number | null }) =>
      assignPostToSeriesAction(seriesId, postId),
    onSuccess: (result, { seriesId, previousId, previousOrder }) => {
      if (result.error) {
        setSelectedSeriesId(previousId);
        setSeriesOrder(previousOrder);
        showMutationFailure(result.error);
        return;
      }
      setCommittedSeriesId(seriesId);
      setCommittedSeriesOrder(null);
      notifications.show({ message: t('notifications.assigned'), color: 'green' });
      void queryClient.invalidateQueries({ queryKey: ['series', seriesId, 'posts'] });
      if (previousId) {
        void queryClient.invalidateQueries({ queryKey: ['series', previousId, 'posts'] });
      }
    },
    onError: (_error, { previousId, previousOrder }) => {
      setSelectedSeriesId(previousId);
      setSeriesOrder(previousOrder);
      showMutationFailure('failed');
    },
  });

  const createSeries = useMutation({
    mutationFn: (title: string) => createSeriesAction({ title }),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: t('notifications.createFailed'), color: 'red' });
        return;
      }
      if (result.data) {
        void queryClient.invalidateQueries({ queryKey: ['series', 'listAllSimple'] });
        const previousId = committedSeriesId;
        const previousOrder = committedSeriesOrder;
        setSelectedSeriesId(result.data.id);
        assignPost.mutate({ seriesId: result.data.id, previousId, previousOrder });
        setSeriesOrder(0);
        notifications.show({ message: tCommonNotifications('seriesCreated'), color: 'green' });
        setSearch('');
      }
    },
  });

  const unassignPost = useMutation({
    mutationFn: ({ seriesId }: { seriesId: string; previousOrder: number | null }) =>
      unassignPostFromSeriesAction(seriesId, postId),
    onSuccess: (result, { seriesId, previousOrder }) => {
      if (result.error) {
        setSelectedSeriesId(seriesId);
        setSeriesOrder(previousOrder);
        showMutationFailure(result.error);
        return;
      }
      setCommittedSeriesId(null);
      setCommittedSeriesOrder(null);
      notifications.show({
        message: tCommonNotifications('postRemovedFromSeries'),
        color: 'yellow',
      });
      void queryClient.invalidateQueries({ queryKey: ['series', seriesId, 'posts'] });
    },
    onError: (_error, { seriesId, previousOrder }) => {
      setSelectedSeriesId(seriesId);
      setSeriesOrder(previousOrder);
      showMutationFailure('failed');
    },
  });

  const reorderPosts = useMutation({
    mutationFn: ({ seriesId, postIds }: { seriesId: string; postIds: string[] }) =>
      reorderSeriesPostsAction(seriesId, postIds),
    onMutate: async ({ seriesId, postIds }) => {
      const queryKey = ['series', seriesId, 'posts'] as const;
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<typeof seriesPosts>(queryKey);
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
    onSuccess: (result, variables, context) => {
      if (result.error) {
        if (context?.previous) {
          queryClient.setQueryData(context.queryKey, context.previous);
        }
        showMutationFailure(result.error);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['series', variables.seriesId, 'posts'] });
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
      showMutationFailure('failed');
    },
  });

  const handleSelect = (value: string) => {
    setSearch('');

    if (value === '$create') {
      createSeries.mutate(search.trim());
      combobox.closeDropdown();
      return;
    }

    if (value === selectedSeriesId) {
      combobox.closeDropdown();
      return;
    }

    const previousId = committedSeriesId;
    const previousOrder = committedSeriesOrder;
    setSelectedSeriesId(value);
    setSeriesOrder(null); // We don't know the exact order yet
    assignPost.mutate({ seriesId: value, previousId, previousOrder });
    combobox.closeDropdown();
  };

  const handleRemove = () => {
    if (!selectedSeriesId || !canManageSelectedSeries) {
      return;
    }
    const currentSeriesId = selectedSeriesId;
    const previousOrder = committedSeriesOrder;
    setSelectedSeriesId(null);
    setSeriesOrder(null);
    unassignPost.mutate({ seriesId: currentSeriesId, previousOrder });
  };

  const movePost = (direction: 'up' | 'down') => {
    if (!selectedSeriesId || !canManageSelectedSeries) {
      return;
    }
    const currentIndex = seriesPosts.findIndex((post) => post.id === postId);
    if (currentIndex < 0) {
      return;
    }

    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= seriesPosts.length) {
      return;
    }

    const reordered = [...seriesPosts];
    const [current] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, current);
    reorderPosts.mutate({ seriesId: selectedSeriesId, postIds: reordered.map((post) => post.id) });
  };

  const isPending =
    assignPost.isPending ||
    unassignPost.isPending ||
    createSeries.isPending ||
    reorderPosts.isPending ||
    isRefreshingOptions;

  const filteredSeriesList = seriesList.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()));
  const exactMatch = seriesList.some((s) => s.title.toLowerCase() === search.trim().toLowerCase());
  const currentIndex = seriesPosts.findIndex((post) => post.id === postId);
  const displayOrder = currentIndex >= 0 ? currentIndex : seriesOrder;
  const canMoveUp = currentIndex > 0;
  const canMoveDown = currentIndex >= 0 && currentIndex < seriesPosts.length - 1;

  return (
    <Stack gap={4}>
      <Text size="xs" c="dimmed">
        {tCommonEntities('series')}
      </Text>
      <Combobox store={combobox} onOptionSubmit={handleSelect} withinPortal={false} disabled={!canEdit}>
        <Combobox.DropdownTarget>
          <InputBase
            id={idPrefix ? `${idPrefix}-trigger` : undefined}
            component="button"
            type="button"
            pointer
            onClick={() => {
              if (!canEdit || isPending) {
                return;
              }
              void refreshSeriesOptions().then((success) => {
                if (success) {
                  combobox.openDropdown();
                  return;
                }
                notifications.show({ message: tCommonNotifications('updateFailed'), color: 'red' });
              });
            }}
            rightSection={
              isPending ? (
                <Loader size={16} />
              ) : selectedSeriesId && canEdit && canManageSelectedSeries ? (
                <IconButton
                  size="xs"
                  emphasis="low"
                  aria-label={tSeriesPostActions('remove')}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove();
                  }}
                >
                  <IconX size={14} />
                </IconButton>
              ) : null
            }
            disabled={!canEdit}
          >
            {selectedSeries ? (
              <Group gap="xs">
                <Text size="sm">{selectedSeries.title}</Text>
                {displayOrder !== null && <LabelBadge size="xs">#{displayOrder + 1}</LabelBadge>}
              </Group>
            ) : selectedSeriesId ? (
              <Text size="sm" c="dimmed">
                {t('states.unavailable')}
              </Text>
            ) : (
              <Text size="sm" c="dimmed">
                {isLoading
                  ? tCommonStates('loading')
                  : seriesList.length === 0
                    ? t('states.empty')
                    : t('states.select')}
              </Text>
            )}
          </InputBase>
        </Combobox.DropdownTarget>

        <Combobox.Dropdown>
          {isAdmin && (
            <Combobox.Search
              id={idPrefix ? `${idPrefix}-search` : undefined}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder={t('searchPlaceholder')}
            />
          )}
          <Combobox.Options>
            {filteredSeriesList.length === 0 && !isAdmin ? (
              <Combobox.Empty>{seriesList.length === 0 ? t('states.notMember') : t('states.notFound')}</Combobox.Empty>
            ) : (
              filteredSeriesList.map((series) => (
                <Combobox.Option key={series.id} value={series.id} active={series.id === selectedSeriesId}>
                  <Text size="sm">{series.title}</Text>
                </Combobox.Option>
              ))
            )}

            {isAdmin && !exactMatch && search.trim().length > 0 && (
              <Combobox.Option value="$create">{t('actions.createNamed', { name: search })}</Combobox.Option>
            )}

            {filteredSeriesList.length === 0 && isAdmin && search.trim().length === 0 && (
              <Combobox.Empty>{t('states.empty')}</Combobox.Empty>
            )}
          </Combobox.Options>
        </Combobox.Dropdown>
      </Combobox>
      {selectedSeriesId && canManageSelectedSeries && displayOrder !== null && canEdit && seriesPosts.length > 1 && (
        <Group gap={6}>
          <IconButton
            size="xs"
            emphasis="low"
            aria-label={tSeriesPostActions('moveUp')}
            disabled={!canMoveUp || isPending}
            onClick={() => movePost('up')}
          >
            <IconChevronUp size={14} />
          </IconButton>
          <IconButton
            size="xs"
            emphasis="low"
            aria-label={tSeriesPostActions('moveDown')}
            disabled={!canMoveDown || isPending}
            onClick={() => movePost('down')}
          >
            <IconChevronDown size={14} />
          </IconButton>
          <Text size="xs" c="dimmed">
            {displayOrder + 1} / {seriesPosts.length}
          </Text>
        </Group>
      )}
    </Stack>
  );
}
