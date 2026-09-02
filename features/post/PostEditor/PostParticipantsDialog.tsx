'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  addPostAuthorAction,
  addPostCollaboratorAction,
  removePostAuthorAction,
  removePostCollaboratorAction,
} from '@/lib/actions/post';
import { listPostParticipants } from '@/lib/queries/post-browser';
import { searchMembers } from '@/lib/queries/user-browser';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import { normalizeSelectedParticipantRole, PostParticipantsDialogView } from './ui/PostParticipantsDialogView';
import { usePostParticipantsDialogLabels } from './usePostParticipantsDialogLabels';

interface PostParticipantsDialogProps {
  postId: string;
  opened: boolean;
  onClose: () => void;
  canAddAuthor: boolean;
  canRemoveAuthor: boolean;
  canManageCollaborators: boolean;
}

export function PostParticipantsDialog({
  postId,
  opened,
  onClose,
  canAddAuthor,
  canRemoveAuthor,
  canManageCollaborators,
}: PostParticipantsDialogProps) {
  const t = useTranslations('postParticipants');
  const labels = usePostParticipantsDialogLabels();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);
  const [selectedRole, setSelectedRole] = useState<'author' | 'collaborator'>(canAddAuthor ? 'author' : 'collaborator');
  useEffect(() => {
    const normalizedRole = normalizeSelectedParticipantRole(selectedRole, canAddAuthor, canManageCollaborators);
    if (normalizedRole && normalizedRole !== selectedRole) {
      setSelectedRole(normalizedRole);
    }
  }, [canAddAuthor, canManageCollaborators, selectedRole]);
  const { data: participants = [], isLoading } = useQuery({
    queryKey: ['post', 'participants', postId],
    queryFn: () => listPostParticipants(postId),
    enabled: opened,
  });
  const participantIds = participants.map((participant) => participant.memberId);
  const { data: candidates = [], isFetching } = useQuery({
    queryKey: ['members', 'post-participant-search', debouncedSearch, participantIds],
    queryFn: () => searchMembers(debouncedSearch, participantIds),
    enabled: opened && debouncedSearch.length >= 2 && (canAddAuthor || canManageCollaborators),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['post', 'participants', postId] });
  const addParticipant = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: 'author' | 'collaborator' }) =>
      role === 'author' ? addPostAuthorAction(postId, memberId) : addPostCollaboratorAction(postId, memberId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      void invalidate();
      setSearchQuery('');
      notifications.show({ message: t('notifications.added'), color: 'green' });
    },
  });
  const removeParticipant = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: 'author' | 'collaborator' }) =>
      role === 'author' ? removePostAuthorAction(postId, memberId) : removePostCollaboratorAction(postId, memberId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      void invalidate();
      notifications.show({ message: t('notifications.removed'), color: 'yellow' });
    },
  });
  const changeParticipantRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: 'author' | 'collaborator' }) =>
      role === 'author' ? addPostAuthorAction(postId, memberId) : addPostCollaboratorAction(postId, memberId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      void invalidate();
      notifications.show({ message: t('notifications.roleChanged'), color: 'green' });
    },
  });

  return (
    <PostParticipantsDialogView
      opened={opened}
      onClose={onClose}
      participants={participants
        .filter((participant) => participant.memberId)
        .map((participant) => ({
          ...participant,
          avatarUrl: buildManagedImageUrl(participant.avatarUrl, MANAGED_IMAGE_PRESET.AVATAR_SM) ?? undefined,
        }))}
      candidates={candidates.map((candidate) => ({
        ...candidate,
        avatarUrl: buildManagedImageUrl(candidate.avatarUrl, MANAGED_IMAGE_PRESET.AVATAR_SM) ?? null,
      }))}
      searchQuery={searchQuery}
      selectedRole={selectedRole}
      canAddAuthor={canAddAuthor}
      canRemoveAuthor={canRemoveAuthor}
      canManageCollaborators={canManageCollaborators}
      loading={isLoading}
      searching={isFetching}
      mutating={addParticipant.isPending || removeParticipant.isPending || changeParticipantRole.isPending}
      onSearchQueryChange={setSearchQuery}
      onSelectedRoleChange={setSelectedRole}
      onAdd={(memberId, role) => addParticipant.mutate({ memberId, role })}
      onRemove={(memberId, role) => removeParticipant.mutate({ memberId, role })}
      onChangeRole={(memberId, role) => changeParticipantRole.mutate({ memberId, role })}
      labels={labels}
    />
  );
}
