'use client';
import { SupportingText, Text as DsText } from '@/components/core/Typography';

import {
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';

import { unwrapQueryResult } from '@/lib/api/query-result';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { ReactNode, useId, useState } from 'react';
import { IconArrowsExchange, IconUserOff, IconUserPlus, IconX } from '@tabler/icons-react';
import { ArtistParticipantRole } from '@echovisionlab/geul-proto/secure/artist_pb.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Avatar, ScrollArea } from '@/components/core/Display';
import { PageLoader } from '@/features/site/PageLoader';
import { ContentModal } from '@/components/core/Modal';
import { notifications } from '@/components/core/Notification';
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
  const tModalActions = useTranslations('common.actions');
  const t = useTranslations('artistManagers');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const tCommonMessages = useTranslations('common.messages');
  const [newRole, setNewRole] = useState<ArtistParticipantRole>(ArtistParticipantRole.MANAGER);
  const { search, setSearch, debouncedSearch, combobox, isEnabled, reset } = useSearchCombobox();
  const queryClient = useQueryClient();
  const queryKey = ['artist', 'participants', artistId] as const;

  const participantsQuery = useQuery({
    queryKey,
    queryFn: () => listArtistParticipantsAction(artistId).then(unwrapQueryResult),
    enabled: opened,
  });
  const { data: participants = [], isLoading } = participantsQuery;

  const participantIds = participants.map((participant) => participant.memberId);
  const searchResultsQuery = useQuery({
    queryKey: ['members', 'artist-participant-search', debouncedSearch, participantIds],
    queryFn: () => searchMembers(debouncedSearch, participantIds),
    enabled: opened && isEnabled && canManageParticipants,
  });
  const { data: searchResults = [], isFetching } = searchResultsQuery;

  const tCommonNotifications = useTranslations('common.notifications');
  const showMutationError = () => notifications.show({ message: tCommonNotifications('saveFailed'), tone: 'danger' });
  const setParticipant = useMutation({
    onError: showMutationError,
    mutationFn: ({ memberId, role }: { memberId: string; role: ArtistParticipantRole }) =>
      setArtistParticipantAction(artistId, memberId, role),
    onSuccess: async (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: t('notifications.updated'), tone: 'positive' });
      await queryClient.invalidateQueries({ queryKey });
      reset();
    },
  });

  const removeParticipant = useMutation({
    onError: showMutationError,
    mutationFn: (memberId: string) => removeArtistParticipantAction(artistId, memberId),
    onSuccess: async (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: t('notifications.removed'), tone: 'positive' });
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const participantList = (
    <ArtistParticipantsListView
      participants={participants}
      canManageParticipants={canManageParticipants}
      canRemoveOwner={canRemoveOwner}
      pending={setParticipant.isPending || removeParticipant.isPending}
      changingMemberId={setParticipant.isPending ? setParticipant.variables?.memberId : undefined}
      removingMemberId={removeParticipant.isPending ? removeParticipant.variables : undefined}
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
      return <PageLoader placement="flow" />;
    }
    if (participantsQuery.isError && participants.length === 0) {
      return null;
    }
    if (participants.length === 0) {
      return (
        <DsLayoutInset block="md">
          <SupportingText tone="secondary" align="center">
            {t('empty')}
          </SupportingText>
        </DsLayoutInset>
      );
    }
    return participants.length <= 5 ? (
      participantList
    ) : (
      <ScrollArea.Autosize size="standard">{participantList}</ScrollArea.Autosize>
    );
  };

  return (
    <ContentModal opened={opened} onClose={onClose} title={t('title')} size="large" closeLabel={tModalActions('close')}>
      <QueryErrorAlert queries={[searchResultsQuery, participantsQuery]} />
      {canManageParticipants && (
        <DsLayoutInset blockEnd="md">
          <DsLayoutInline gap="sm" align="end" wrap="nowrap">
            <SearchCombobox
              inputId={`artist-${artistId}-participant-search`}
              combobox={combobox}
              search={search}
              onSearchChange={setSearch}
              placeholder={tCommonPlaceholders('searchByEmailOrName')}
              leftSection={<IconUserPlus size={16} />}
              items={searchResults}
              isLoading={isFetching || setParticipant.isPending}
              disabled={setParticipant.isPending || removeParticipant.isPending || isLoading}
              debouncedSearch={debouncedSearch}
              onSelect={(memberId) => {
                if (!setParticipant.isPending && !removeParticipant.isPending) {
                  setParticipant.mutate({ memberId, role: newRole });
                }
              }}
              getItemId={(member) => member.id}
              getItemText={(member) => member.nickname}
              emptyMessage={tCommonMessages('noUsersFound')}
              size="sm"
              grow
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
            />
            <div style={{ width: 160 }}>
              <Select
                label={t('role')}
                value={String(newRole)}
                data={[
                  { value: String(ArtistParticipantRole.OWNER), label: t('owner') },
                  { value: String(ArtistParticipantRole.MANAGER), label: t('manager') },
                ]}
                onChange={(value) => setNewRole(Number(value) as ArtistParticipantRole)}
                allowDeselect={false}
              />
            </div>
          </DsLayoutInline>
        </DsLayoutInset>
      )}
      {renderContent()}
    </ContentModal>
  );
}

export function ArtistParticipantsListView({
  participants,
  canManageParticipants,
  canRemoveOwner,
  pending,
  changingMemberId,
  removingMemberId,
  labels,
  onChangeRole,
  onRemove,
}: {
  participants: ArtistParticipantViewModel[];
  canManageParticipants: boolean;
  canRemoveOwner: boolean;
  pending: boolean;
  changingMemberId?: string;
  removingMemberId?: string;
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
  const listId = useId();
  return (
    <DsLayoutStack gap="xs">
      {participants.map((participant) => {
        const isOwner = participant.role === ArtistParticipantRole.OWNER;
        const canChangeRole = canManageParticipants && (!isOwner || canRemoveOwner);
        const canRemove = canManageParticipants && (!isOwner || canRemoveOwner);
        return (
          <DsLayoutInline
            key={participant.memberId}
            justify="between"
            wrap="nowrap"
            data-participant-id={participant.memberId}
            role="group"
            aria-labelledby={`${listId}-${participant.memberId}-name ${listId}-${participant.memberId}-role`}
          >
            <div style={{ minWidth: 0 }}>
              <DsLayoutInline gap="sm" wrap="nowrap">
                <Avatar
                  src={buildManagedImageUrl(participant.avatarUrl, MANAGED_IMAGE_PRESET.AVATAR_SM)}
                  size="sm"
                  shape="circle"
                  name={participant.nickname}
                />
                <DsText id={`${listId}-${participant.memberId}-name`} size="sm" truncate>
                  {participant.nickname}
                </DsText>
                {!participant.hasEffectiveAuthority ? (
                  <Tooltip label={labels.inactive}>
                    <IconUserOff size={16} role="img" aria-label={labels.inactive} />
                  </Tooltip>
                ) : null}
              </DsLayoutInline>
            </div>
            <DsLayoutInline gap="xs" wrap="nowrap">
              <LabelBadge id={`${listId}-${participant.memberId}-role`} size="sm" tone={isOwner ? 'accent' : 'neutral'}>
                {isOwner ? labels.owner : labels.manager}
              </LabelBadge>
              <Tooltip label={isOwner ? labels.makeManager : labels.makeOwner}>
                <IconButton
                  emphasis="low"
                  size="sm"
                  aria-label={isOwner ? labels.makeManager : labels.makeOwner}
                  aria-describedby={`${listId}-${participant.memberId}-name`}
                  loading={changingMemberId === participant.memberId}
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
                  aria-describedby={`${listId}-${participant.memberId}-name`}
                  loading={removingMemberId === participant.memberId}
                  disabled={!canRemove || pending}
                  onClick={() => onRemove(participant.memberId)}
                >
                  <IconX size={14} />
                </IconButton>
              </Tooltip>
            </DsLayoutInline>
          </DsLayoutInline>
        );
      })}
    </DsLayoutStack>
  );
}
