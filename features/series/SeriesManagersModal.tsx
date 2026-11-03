'use client';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { SupportingText, Text as DsText } from '@/components/core/Typography';
import {
  LayoutInline as DsLayoutInline,
  LayoutStack as DsLayoutStack,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';

import { SearchComboboxView, useInputCombobox } from '@/components/core/Input';

import { useEffect, useId, useRef, useState } from 'react';
import { IconUserPlus, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Avatar, ScrollArea } from '@/components/core/Display';
import { PageLoader } from '@/features/site/PageLoader';
import { ContentModal } from '@/components/core/Modal';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { IconButton } from '@/components/core/IconButton';
import { addSeriesManagerAction, removeSeriesManagerAction } from '@/lib/actions/series';
import { listSeriesManagers, searchSeriesManagerCandidates } from '@/lib/queries/series-browser';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';

export interface SeriesManagerBindings {
  add: typeof addSeriesManagerAction;
  remove: typeof removeSeriesManagerAction;
  list: typeof listSeriesManagers;
  search: typeof searchSeriesManagerCandidates;
}
const defaultBindings: SeriesManagerBindings = {
  add: addSeriesManagerAction,
  remove: removeSeriesManagerAction,
  list: listSeriesManagers,
  search: searchSeriesManagerCandidates,
};

interface SeriesManagersModalProps {
  seriesId: string;
  opened: boolean;
  onClose: () => void;
  canManageManagers: boolean;
  bindings?: SeriesManagerBindings;
}

interface SeriesManager {
  memberId: string;
  nickname: string;
  avatarUrl?: string | null;
}

interface SearchMember {
  id: string;
  nickname: string;
  avatarUrl: string | null;
}

export function SeriesManagersModal({
  seriesId,
  opened,
  onClose,
  canManageManagers,
  bindings = defaultBindings,
}: SeriesManagersModalProps) {
  const viewId = useId();
  const pendingRemoval = useRef<string | null>(null);
  const tModalActions = useTranslations('common.actions');
  const t = useTranslations('seriesMembers');
  const tActions = useTranslations('common.actions');
  const tCommonMessages = useTranslations('common.messages');
  const tCommonErrors = useTranslations('common.errors');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);

  const combobox = useInputCombobox();

  const queryClient = useQueryClient();

  const {
    data: managers = [],
    isError: managersError,
    isLoading: managersLoading,
  } = useQuery<SeriesManager[]>({
    queryKey: ['series', seriesId, 'managers'],
    queryFn: () => bindings.list(seriesId),
    enabled: opened,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const managerIds = managers.map((m) => m.memberId);
  const searchResultsQuery = useQuery<SearchMember[]>({
    queryKey: ['series', seriesId, 'manager-search', debouncedSearch, managerIds],
    queryFn: () => bindings.search(debouncedSearch, managerIds),
    enabled: opened && canManageManagers && !managersError && debouncedSearch.length >= 2,
  });
  const { data: searchResults = [], isFetching: searchFetching } = searchResultsQuery;

  const addManager = useMutation({
    mutationFn: (memberId: string) => bindings.add(seriesId, memberId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: t('notifications.addFailed'), tone: 'danger' });
        return;
      }
      notifications.show({ message: t('notifications.added'), tone: 'positive' });
      void queryClient.invalidateQueries({ queryKey: ['series', seriesId, 'managers'] });
      setSearchQuery('');
      combobox.closeDropdown();
    },
    onError: () => {
      notifications.show({ message: t('notifications.addFailed'), tone: 'danger' });
    },
  });

  const removeManager = useMutation({
    mutationFn: (memberId: string) => bindings.remove(seriesId, memberId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: t('notifications.removeFailed'), tone: 'danger' });
        return;
      }
      notifications.show({ message: t('notifications.removed'), tone: 'positive' });
      void queryClient.invalidateQueries({ queryKey: ['series', seriesId, 'managers'] });
    },
    onError: () => {
      notifications.show({ message: t('notifications.removeFailed'), tone: 'danger' });
    },
  });

  useEffect(() => {
    const removedId = pendingRemoval.current;
    if (removedId && !managers.some((manager) => manager.memberId === removedId)) {
      pendingRemoval.current = null;
      document.getElementById(`${viewId}-search`)?.focus();
    }
  }, [managers, viewId]);

  const renderManagerRow = (manager: SeriesManager) => (
    <DsLayoutInline key={manager.memberId} role="listitem" justify="between">
      <DsLayoutInline gap="sm">
        <Avatar
          src={buildManagedImageUrl(manager.avatarUrl, MANAGED_IMAGE_PRESET.AVATAR_SM)}
          size="sm"
          shape="circle"
          name={manager.nickname}
        />
        <div>
          <DsText id={`${viewId}-manager-${manager.memberId}`} size="sm">
            {manager.nickname}
          </DsText>
        </div>
      </DsLayoutInline>
      {canManageManagers && (
        <IconButton
          tone="danger"
          emphasis="low"
          size="sm"
          aria-label={tActions('remove')}
          aria-describedby={`${viewId}-manager-${manager.memberId}`}
          onClick={() => {
            pendingRemoval.current = manager.memberId;
            removeManager.mutate(manager.memberId);
          }}
          loading={removeManager.isPending && removeManager.variables === manager.memberId}
          disabled={addManager.isPending || removeManager.isPending}
        >
          <IconX size={14} />
        </IconButton>
      )}
    </DsLayoutInline>
  );

  return (
    <ContentModal
      opened={opened}
      onClose={onClose}
      title={t('title', { count: managersLoading || managersError ? '—' : managers.length })}
      size="standard"
      closeLabel={tModalActions('close')}
    >
      <QueryErrorAlert queries={[searchResultsQuery]} />
      {canManageManagers && !managersError && (
        <DsLayoutInset blockEnd="md">
          <DsLayoutStack gap="xs">
            <SearchComboboxView
              inputId={`${viewId}-search`}
              combobox={combobox}
              search={searchQuery}
              onSearchChange={setSearchQuery}
              placeholder={tCommonPlaceholders('searchByName')}
              items={searchResults}
              debouncedSearch={debouncedSearch}
              isLoading={searchFetching || addManager.isPending}
              disabled={managersLoading || managersError || addManager.isPending || removeManager.isPending}
              onSelect={(memberId) => {
                if (!addManager.isPending && !removeManager.isPending) {
                  addManager.mutate(memberId);
                }
              }}
              getItemId={(item) => item.id}
              getItemText={(item) => item.nickname}
              renderItem={(member) => (
                <DsLayoutInline gap="sm">
                  <Avatar
                    src={buildManagedImageUrl(member.avatarUrl, MANAGED_IMAGE_PRESET.AVATAR_SM)}
                    size="sm"
                    shape="circle"
                    name={member.nickname}
                  />
                  <DsText size="sm">{member.nickname}</DsText>
                </DsLayoutInline>
              )}
              minimumQueryMessage={tCommonMessages('typeAtLeast2Characters')}
              error={searchResultsQuery.isError ? tCommonErrors('generic') : undefined}
              emptyMessage={searchResultsQuery.isError ? tCommonErrors('generic') : undefined}
              noResultsMessage={tCommonMessages('noUsersFound')}
              leftSection={<IconUserPlus size={16} />}
            />
          </DsLayoutStack>
        </DsLayoutInset>
      )}

      {managersLoading ? (
        <PageLoader placement="flow" />
      ) : managersError ? (
        <SupportingText tone="danger" role="alert">
          {t('states.loadFailed')}
        </SupportingText>
      ) : managers.length <= 5 ? (
        <DsLayoutStack role="list" aria-label={t('title', { count: managers.length })} gap="xs">
          {managers.map(renderManagerRow)}
        </DsLayoutStack>
      ) : (
        <ScrollArea.Autosize size="large">
          <DsLayoutStack role="list" aria-label={t('title', { count: managers.length })} gap="xs">
            {managers.map(renderManagerRow)}
          </DsLayoutStack>
        </ScrollArea.Autosize>
      )}
    </ContentModal>
  );
}
