'use client';

import { useState } from 'react';
import { LabelParticipantRole } from '@echovisionlab/geul-proto/secure/label_pb.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  listLabelParticipantsAction,
  removeLabelParticipantAction,
  setLabelParticipantAction,
} from '@/lib/actions/label';
import { searchMembers } from '@/lib/queries/user-browser';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import { LabelParticipantsDialogView, type LabelParticipantRoleName } from './ui/LabelParticipantsDialogView';
import { useLabelParticipantsDialogLabels } from './useLabelParticipantsDialogLabels';

interface LabelParticipantsDialogProps {
  labelId: string;
  opened: boolean;
  onClose: () => void;
  canManageParticipants: boolean;
  canRemoveOwner: boolean;
}

function toProtoRole(role: LabelParticipantRoleName): LabelParticipantRole {
  return role === 'owner' ? LabelParticipantRole.OWNER : LabelParticipantRole.MANAGER;
}

export function LabelParticipantsDialog({
  labelId,
  opened,
  onClose,
  canManageParticipants,
  canRemoveOwner,
}: LabelParticipantsDialogProps) {
  const t = useTranslations('artistManagers');
  const labels = useLabelParticipantsDialogLabels();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);
  const [selectedRole, setSelectedRole] = useState<LabelParticipantRoleName>('manager');
  const queryClient = useQueryClient();
  const queryKey = ['label', 'participants', labelId] as const;

  const { data: participants = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listLabelParticipantsAction(labelId),
    enabled: opened,
  });
  const participantIds = participants.map((participant) => participant.memberId);
  const { data: candidates = [], isFetching } = useQuery({
    queryKey: ['members', 'label-participant-search', debouncedSearch, participantIds],
    queryFn: () => searchMembers(debouncedSearch, participantIds),
    enabled: opened && canManageParticipants && debouncedSearch.length >= 2,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });
  const setParticipant = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: LabelParticipantRoleName }) =>
      setLabelParticipantAction(labelId, memberId, toProtoRole(role)),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      void invalidate();
      setSearchQuery('');
      notifications.show({ message: t('notifications.updated'), color: 'green' });
    },
  });
  const removeParticipant = useMutation({
    mutationFn: (memberId: string) => removeLabelParticipantAction(labelId, memberId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      void invalidate();
      notifications.show({ message: t('notifications.removed'), color: 'yellow' });
    },
  });

  return (
    <LabelParticipantsDialogView
      opened={opened}
      onClose={onClose}
      participants={participants.map((participant) => ({
        memberId: participant.memberId,
        nickname: participant.nickname,
        avatarUrl: buildManagedImageUrl(participant.avatarUrl, MANAGED_IMAGE_PRESET.AVATAR_SM) ?? undefined,
        role: participant.role === LabelParticipantRole.OWNER ? 'owner' : 'manager',
        hasEffectiveAuthority: participant.hasEffectiveAuthority,
      }))}
      candidates={candidates.map((candidate) => ({
        id: candidate.id,
        nickname: candidate.nickname,
        avatarUrl: buildManagedImageUrl(candidate.avatarUrl, MANAGED_IMAGE_PRESET.AVATAR_SM) ?? null,
      }))}
      searchQuery={searchQuery}
      selectedRole={selectedRole}
      canManageParticipants={canManageParticipants}
      canRemoveOwner={canRemoveOwner}
      loading={isLoading}
      searching={isFetching}
      mutating={setParticipant.isPending || removeParticipant.isPending}
      onSearchQueryChange={setSearchQuery}
      onSelectedRoleChange={setSelectedRole}
      onAdd={(memberId, role) => setParticipant.mutate({ memberId, role })}
      onRemove={(memberId) => removeParticipant.mutate(memberId)}
      onChangeRole={(memberId, role) => setParticipant.mutate({ memberId, role })}
      labels={labels}
    />
  );
}
