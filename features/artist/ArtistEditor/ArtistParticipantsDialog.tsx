'use client';

import { ReactNode, useState } from 'react';
import { IconArrowsExchange, IconUserOff, IconUserPlus, IconX } from '@tabler/icons-react';
import { ArtistParticipantRole } from '@echovisionlab/geul-proto/secure/artist_pb.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Avatar, Group, Loader, Modal, ScrollArea, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { LabelBadge } from '@/components/core/Badge';
import { IconButton } from '@/components/core/IconButton';
import { Select } from '@/components/core/Input';
import { Tooltip } from '@/components/core/Tooltip';
import { SearchCombobox } from '@/features/search/SearchCombobox';
import {
  listArtistParticipantsAction,
  removeArtistParticipantAction,
  setArtistParticipantAction,
} from '@/lib/actions/artist';
import { useSearchCombobox } from '@/lib/hooks/useSearchCombobox';
import { searchMembers } from '@/lib/queries/user-browser';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';

interface ArtistParticipantsDialogProps {
  artistId: string;
  opened: boolean;
  onClose: () => void;
  canManageParticipants: boolean;
  canRemoveOwner: boolean;
}

export interface ArtistParticipantViewModel {
  memberId: string;
  nickname: string;
  avatarUrl: string | null;
  role: ArtistParticipantRole;
  hasEffectiveAuthority: boolean;
}

export function ArtistParticipantsDialog({
  artistId,
  opened,
  onClose,
  canManageParticipants,
  canRemoveOwner,
}: ArtistParticipantsDialogProps) {
  const t = useTranslations('artistManagers');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const tCommonMessages = useTranslations('common.messages');
  const [newRole, setNewRole] = useState<ArtistParticipantRole>(ArtistParticipantRole.MANAGER);
  const { search, setSearch, debouncedSearch, combobox, isEnabled, reset } = useSearchCombobox();
  const queryClient = useQueryClient();
  const queryKey = ['artist', 'participants', artistId] as const;

  const { data: participants = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listArtistParticipantsAction(artistId),
    enabled: opened,
  });

  const participantIds = participants.map((participant) => participant.memberId);
  const { data: searchResults = [], isFetching } = useQuery({
    queryKey: ['members', 'artist-participant-search', debouncedSearch, participantIds],
    queryFn: () => searchMembers(debouncedSearch, participantIds),
    enabled: opened && isEnabled && canManageParticipants,
  });

  const setParticipant = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: ArtistParticipantRole }) =>
      setArtistParticipantAction(artistId, memberId, role),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: t('notifications.updated'), color: 'green' });
      queryClient.invalidateQueries({ queryKey });
      reset();
    },
  });

  const removeParticipant = useMutation({
    mutationFn: (memberId: string) => removeArtistParticipantAction(artistId, memberId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: t('notifications.removed'), color: 'yellow' });
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const participantList = (
    <ArtistParticipantsListView
      participants={participants}
      canManageParticipants={canManageParticipants}
      canRemoveOwner={canRemoveOwner}
      pending={setParticipant.isPending || removeParticipant.isPending}
      labels={{
        owner: t('owner'),
        manager: t('manager'),
        inactive: t('inactive'),
        makeOwner: t('makeOwner'),
        makeManager: t('makeManager'),
        remove: t('remove'),
      }}
      onChangeRole={(memberId, role) => setParticipant.mutate({ memberId, role })}
      onRemove={(memberId) => removeParticipant.mutate(memberId)}
    />
  );

  const renderContent = (): ReactNode => {
    if (isLoading) {
      return (
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      );
    }
    if (participants.length === 0) {
      return (
        <Text c="dimmed" ta="center" py="md">
          {t('empty')}
        </Text>
      );
    }
    return participants.length <= 5 ? (
      participantList
    ) : (
      <ScrollArea.Autosize mah={280}>{participantList}</ScrollArea.Autosize>
    );
  };

  return (
    <Modal opened={opened} onClose={onClose} title={t('title')} size="lg">
      {canManageParticipants && (
        <Group gap="sm" mb="md" align="flex-end" wrap="nowrap">
          <SearchCombobox
            inputId={`artist-${artistId}-participant-search`}
            combobox={combobox}
            search={search}
            onSearchChange={setSearch}
            placeholder={tCommonPlaceholders('searchByEmailOrName')}
            leftSection={<IconUserPlus size={16} />}
            items={searchResults}
            isLoading={isFetching}
            debouncedSearch={debouncedSearch}
            onSelect={(memberId) => setParticipant.mutate({ memberId, role: newRole })}
            getItemId={(member) => member.id}
            emptyMessage={tCommonMessages('noUsersFound')}
            size="sm"
            flex={1}
            renderItem={(member) => (
              <Group gap="sm">
                <Avatar
                  src={buildManagedImageUrl(member.avatarUrl, MANAGED_IMAGE_PRESET.AVATAR_SM)}
                  size="sm"
                  radius="xl"
                >
                  {member.nickname.charAt(0)}
                </Avatar>
                <Text size="sm">{member.nickname}</Text>
              </Group>
            )}
          />
          <Select
            label={t('role')}
            value={String(newRole)}
            data={[
              { value: String(ArtistParticipantRole.OWNER), label: t('owner') },
              { value: String(ArtistParticipantRole.MANAGER), label: t('manager') },
            ]}
            onChange={(value) => setNewRole(Number(value) as ArtistParticipantRole)}
            allowDeselect={false}
            w={160}
          />
        </Group>
      )}
      {renderContent()}
    </Modal>
  );
}

export function ArtistParticipantsListView({
  participants,
  canManageParticipants,
  canRemoveOwner,
  pending,
  labels,
  onChangeRole,
  onRemove,
}: {
  participants: ArtistParticipantViewModel[];
  canManageParticipants: boolean;
  canRemoveOwner: boolean;
  pending: boolean;
  labels: {
    owner: string;
    manager: string;
    inactive: string;
    makeOwner: string;
    makeManager: string;
    remove: string;
  };
  onChangeRole: (memberId: string, role: ArtistParticipantRole) => void;
  onRemove: (memberId: string) => void;
}) {
  return (
    <Stack gap="xs">
      {participants.map((participant) => {
        const isOwner = participant.role === ArtistParticipantRole.OWNER;
        const canChangeRole = canManageParticipants && (!isOwner || canRemoveOwner);
        const canRemove = canManageParticipants && (!isOwner || canRemoveOwner);
        return (
          <Group
            key={participant.memberId}
            justify="space-between"
            wrap="nowrap"
            data-participant-id={participant.memberId}
          >
            <Group gap="sm" wrap="nowrap" miw={0}>
              <Avatar
                src={buildManagedImageUrl(participant.avatarUrl, MANAGED_IMAGE_PRESET.AVATAR_SM)}
                size="sm"
                radius="xl"
              >
                {participant.nickname.charAt(0)}
              </Avatar>
              <Text size="sm" truncate>
                {participant.nickname}
              </Text>
              {!participant.hasEffectiveAuthority ? (
                <Tooltip label={labels.inactive}>
                  <IconUserOff size={16} aria-label={labels.inactive} />
                </Tooltip>
              ) : null}
            </Group>
            <Group gap="xs" wrap="nowrap">
              <LabelBadge size="sm" tone={isOwner ? 'accent' : 'neutral'}>
                {isOwner ? labels.owner : labels.manager}
              </LabelBadge>
              <Tooltip label={isOwner ? labels.makeManager : labels.makeOwner}>
                <IconButton
                  emphasis="low"
                  size="sm"
                  aria-label={isOwner ? labels.makeManager : labels.makeOwner}
                  disabled={!canChangeRole || pending}
                  onClick={() =>
                    onChangeRole(
                      participant.memberId,
                      isOwner ? ArtistParticipantRole.MANAGER : ArtistParticipantRole.OWNER,
                    )
                  }
                >
                  <IconArrowsExchange size={14} />
                </IconButton>
              </Tooltip>
              <Tooltip label={labels.remove}>
                <IconButton
                  tone="danger"
                  emphasis="low"
                  size="sm"
                  aria-label={labels.remove}
                  disabled={!canRemove || pending}
                  onClick={() => onRemove(participant.memberId)}
                >
                  <IconX size={14} />
                </IconButton>
              </Tooltip>
            </Group>
          </Group>
        );
      })}
    </Stack>
  );
}
