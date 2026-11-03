'use client';
import { InputValidationGlyph } from '@/components/core/Input/InputGlyphs';
import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { Select, useInputCombobox } from '@/components/core/Input';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { useCallback, useEffect, useRef, useState } from 'react';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
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

  const combobox = useInputCombobox();
  const openIntent = useRef(0);
  useEffect(
    () => () => {
      openIntent.current += 1;
    },
    [postId],
  );

  const queryClient = useQueryClient();

  const allSeriesListQuery = useQuery({
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
    data: allSeriesList = initialSeries,
    isError: allError,
    isFetching: allFetching,
    isLoading: allLoading,
    refetch: refetchAllSeries,
  } = allSeriesListQuery;

  const mySeriesListQuery = useQuery({
    queryKey: ['series', 'mySeriesList'],
    queryFn: () => listMySeries(),
    enabled: !isAdmin,
    initialData: !isAdmin ? initialSeries : undefined,
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
  } = mySeriesListQuery;

  const seriesList = isAdmin ? allSeriesList : mySeriesList;
  const optionsError = isAdmin ? allError : myError;
  const optionsFetching = isAdmin ? allFetching : myFetching;
  const isLoading = isAdmin ? allLoading : myLoading;
  const selectedSeries = seriesList.find((item) => item.id === selectedSeriesId);
  const canManageSelectedSeries = selectedSeries !== undefined && !optionsError && !optionsFetching;

  const seriesPostsQuery = useQuery({
    queryKey: ['series', selectedSeriesId, 'posts'],
    queryFn: () => listSeriesPosts(selectedSeriesId!),
    enabled: !!selectedSeriesId && canManageSelectedSeries,
  });
  const { data: seriesPosts = [] } = seriesPostsQuery;

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
        tone: 'danger',
      });
      if (error === 'series_unavailable') {
        void refreshSeriesOptions().then((success) => {
          if (!success) {
            notifications.show({ message: tCommonNotifications('updateFailed'), tone: 'danger' });
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
      notifications.show({ message: t('notifications.assigned'), tone: 'positive' });
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
        notifications.show({ message: t('notifications.createFailed'), tone: 'danger' });
        return;
      }
      if (result.data) {
        void queryClient.invalidateQueries({ queryKey: ['series', 'listAllSimple'] });
        const previousId = committedSeriesId;
        const previousOrder = committedSeriesOrder;
        setSelectedSeriesId(result.data.id);
        assignPost.mutate({ seriesId: result.data.id, previousId, previousOrder });
        setSeriesOrder(0);
        notifications.show({ message: tCommonNotifications('seriesCreated'), tone: 'positive' });
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
        tone: 'positive',
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

  const exactMatch = seriesList.some((s) => s.title.toLowerCase() === search.trim().toLowerCase());
  const currentIndex = seriesPosts.findIndex((post) => post.id === postId);
  const displayOrder = currentIndex >= 0 ? currentIndex : seriesOrder;
  const canMoveUp = currentIndex > 0;
  const canMoveDown = currentIndex >= 0 && currentIndex < seriesPosts.length - 1;

  return (
    <DsLayoutStack gap="xxs">
      <QueryErrorAlert queries={[allSeriesListQuery, mySeriesListQuery, seriesPostsQuery]} />
      <Select
        id={idPrefix ? `${idPrefix}-trigger` : undefined}
        label={tCommonEntities('series')}
        searchable={isAdmin}
        disabled={!canEdit || isPending}
        aria-busy={isLoading || optionsFetching || isPending || seriesPostsQuery.isLoading}
        rightSection={
          isLoading || optionsFetching || isPending ? <InputValidationGlyph status="checking" /> : undefined
        }
        value={selectedSeriesId}
        searchValue={combobox.dropdownOpened ? search : (selectedSeries?.title ?? '')}
        onSearchChange={setSearch}
        dropdownOpened={combobox.dropdownOpened}
        onDropdownClose={() => {
          if (combobox.dropdownOpened) {
            openIntent.current += 1;
          }
          combobox.closeDropdown();
        }}
        onDropdownOpen={() => {
          if (!combobox.dropdownOpened) {
            const intent = ++openIntent.current;
            void refreshSeriesOptions().then((success) => {
              if (intent !== openIntent.current) {
                return;
              }
              if (success) {
                combobox.openDropdown();
              } else {
                notifications.show({ message: tCommonNotifications('updateFailed'), tone: 'danger' });
              }
            });
          }
        }}
        clearable={Boolean(selectedSeriesId && canEdit && canManageSelectedSeries)}
        clearLabel={tSeriesPostActions('remove')}
        onChange={(id) => {
          if (id) {
            handleSelect(id);
          } else {
            handleRemove();
          }
        }}
        placeholder={
          // An assigned Series outside the refreshed managed list keeps its unavailable state visible.
          selectedSeriesId && !selectedSeries && !isLoading
            ? t('states.unavailable')
            : isLoading
              ? tCommonStates('loading')
              : seriesList.length === 0
                ? t('states.empty')
                : t('states.select')
        }
        data={[
          ...seriesList.map((series) => ({ value: series.id, label: series.title })),
          ...(isAdmin && !exactMatch && search.trim()
            ? [{ value: '$create', label: t('actions.createNamed', { name: search.trim() }) }]
            : []),
        ]}
        nothingFoundMessage={
          isLoading || optionsFetching
            ? tCommonStates('loading')
            : optionsError
              ? null
              : seriesList.length === 0
                ? t('states.notMember')
                : t('states.notFound')
        }
      />
      {selectedSeriesId && displayOrder !== null ? <LabelBadge>#{displayOrder + 1}</LabelBadge> : null}
      {selectedSeriesId && canManageSelectedSeries && displayOrder !== null && canEdit && seriesPosts.length > 1 && (
        <DsLayoutInline gap="xxs">
          <IconButton
            size="xs"
            emphasis="low"
            aria-label={tSeriesPostActions('moveUp')}
            disabled={!canMoveUp || isPending}
            loading={reorderPosts.isPending}
            onClick={() => movePost('up')}
          >
            <IconChevronUp size={14} />
          </IconButton>
          <IconButton
            size="xs"
            emphasis="low"
            aria-label={tSeriesPostActions('moveDown')}
            disabled={!canMoveDown || isPending}
            loading={reorderPosts.isPending}
            onClick={() => movePost('down')}
          >
            <IconChevronDown size={14} />
          </IconButton>
          <DsText size="xs" tone="secondary">
            {displayOrder + 1} / {seriesPosts.length}
          </DsText>
        </DsLayoutInline>
      )}
    </DsLayoutStack>
  );
}
