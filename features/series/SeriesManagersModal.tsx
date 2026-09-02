'use client';

import { useState } from 'react';
import { IconUserPlus, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Avatar, Combobox, Group, InputBase, Loader, Modal, ScrollArea, Stack, Text, useCombobox } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconButton } from '@/components/core/IconButton';
import { addSeriesManagerAction, removeSeriesManagerAction } from '@/lib/actions/series';
import { listSeriesManagers, searchSeriesManagerCandidates } from '@/lib/queries/series-browser';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';

interface SeriesManagersModalProps {
  seriesId: string;
  opened: boolean;
  onClose: () => void;
  canManageManagers: boolean;
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

export function SeriesManagersModal({ seriesId, opened, onClose, canManageManagers }: SeriesManagersModalProps) {
  const t = useTranslations('seriesMembers');
  const tActions = useTranslations('common.actions');
  const tCommonMessages = useTranslations('common.messages');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const queryClient = useQueryClient();

  const {
    data: managers = [],
    isError: managersError,
    isLoading: managersLoading,
  } = useQuery<SeriesManager[]>({
    queryKey: ['series', seriesId, 'managers'],
    queryFn: () => listSeriesManagers(seriesId),
    enabled: opened,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const managerIds = managers.map((m) => m.memberId);
  const { data: searchResults = [], isFetching: searchFetching } = useQuery<SearchMember[]>({
    queryKey: ['series', seriesId, 'manager-search', debouncedSearch, managerIds],
    queryFn: () => searchSeriesManagerCandidates(debouncedSearch, managerIds),
    enabled: opened && canManageManagers && !managersError && debouncedSearch.length >= 2,
  });

  const addManager = useMutation({
    mutationFn: (memberId: string) => addSeriesManagerAction(seriesId, memberId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: t('notifications.addFailed'), color: 'red' });
        return;
      }
      notifications.show({ message: t('notifications.added'), color: 'green' });
      void queryClient.invalidateQueries({ queryKey: ['series', seriesId, 'managers'] });
      setSearchQuery('');
      combobox.closeDropdown();
    },
    onError: () => {
      notifications.show({ message: t('notifications.addFailed'), color: 'red' });
    },
  });

  const removeManager = useMutation({
    mutationFn: (memberId: string) => removeSeriesManagerAction(seriesId, memberId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: t('notifications.removeFailed'), color: 'red' });
        return;
      }
      notifications.show({ message: t('notifications.removed'), color: 'yellow' });
      void queryClient.invalidateQueries({ queryKey: ['series', seriesId, 'managers'] });
    },
    onError: () => {
      notifications.show({ message: t('notifications.removeFailed'), color: 'red' });
    },
  });

  const renderManagerRow = (manager: SeriesManager) => (
    <Group key={manager.memberId} justify="space-between">
      <Group gap="sm">
        <Avatar src={buildManagedImageUrl(manager.avatarUrl, MANAGED_IMAGE_PRESET.AVATAR_SM)} size="sm" radius="xl">
          {manager.nickname.charAt(0).toUpperCase()}
        </Avatar>
        <div>
          <Text size="sm">{manager.nickname}</Text>
        </div>
      </Group>
      {canManageManagers && (
        <IconButton
          tone="danger"
          emphasis="low"
          size="sm"
          aria-label={tActions('remove')}
          onClick={() => removeManager.mutate(manager.memberId)}
          loading={removeManager.isPending}
        >
          <IconX size={14} />
        </IconButton>
      )}
    </Group>
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('title', { count: managersError ? '—' : managers.length })}
      size="md"
    >
      {canManageManagers && !managersError && (
        <Stack gap="xs" mb="md">
          <Combobox store={combobox} onOptionSubmit={(memberId) => addManager.mutate(memberId)}>
            <Combobox.Target>
              <InputBase
                placeholder={tCommonPlaceholders('searchByName')}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.currentTarget.value);
                  combobox.openDropdown();
                }}
                onFocus={() => {
                  if (searchQuery.length >= 2) {
                    combobox.openDropdown();
                  }
                }}
                rightSection={searchFetching ? <Loader size={16} /> : null}
                leftSection={<IconUserPlus size={16} />}
              />
            </Combobox.Target>
            <Combobox.Dropdown>
              <Combobox.Options>
                {searchResults.length === 0 ? (
                  <Combobox.Empty>
                    {debouncedSearch.length < 2
                      ? tCommonMessages('typeAtLeast2Characters')
                      : tCommonMessages('noUsersFound')}
                  </Combobox.Empty>
                ) : (
                  searchResults.map((member) => (
                    <Combobox.Option key={member.id} value={member.id}>
                      <Group gap="sm">
                        <Avatar
                          src={buildManagedImageUrl(member.avatarUrl, MANAGED_IMAGE_PRESET.AVATAR_SM)}
                          size="sm"
                          radius="xl"
                        >
                          {member.nickname.charAt(0).toUpperCase()}
                        </Avatar>
                        <div>
                          <Text size="sm">{member.nickname}</Text>
                        </div>
                      </Group>
                    </Combobox.Option>
                  ))
                )}
              </Combobox.Options>
            </Combobox.Dropdown>
          </Combobox>
        </Stack>
      )}

      {managersLoading ? (
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      ) : managersError ? (
        <Text c="red" size="sm" role="alert">
          {t('states.loadFailed')}
        </Text>
      ) : managers.length <= 5 ? (
        <Stack gap="xs">{managers.map(renderManagerRow)}</Stack>
      ) : (
        <ScrollArea.Autosize mah={320}>
          <Stack gap="xs">{managers.map(renderManagerRow)}</Stack>
        </ScrollArea.Autosize>
      )}
    </Modal>
  );
}
