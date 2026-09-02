'use client';

import { useMemo } from 'react';
import { IconArrowsExchange, IconUserOff, IconUserPlus, IconX } from '@tabler/icons-react';
import { Avatar, Group, Loader, ScrollArea, Stack, Text, useCombobox } from '@mantine/core';
import { LabelBadge } from '@/components/core/Badge';
import { IconButton } from '@/components/core/IconButton';
import { SearchComboboxView, Select } from '@/components/core/Input';
import { ContentModal } from '@/components/core/Modal';
import { Tooltip } from '@/components/core/Tooltip';
import styles from './PostParticipantsDialogView.module.css';

export interface PostParticipantViewModel {
  memberId: string;
  nickname: string;
  avatarUrl?: string;
  role: 'author' | 'collaborator';
  hasEffectiveAuthority: boolean;
}

export interface PostParticipantCandidate {
  id: string;
  nickname: string;
  avatarUrl: string | null;
}

export interface PostParticipantsDialogViewProps {
  opened: boolean;
  onClose: () => void;
  participants: PostParticipantViewModel[];
  candidates: PostParticipantCandidate[];
  searchQuery: string;
  selectedRole: 'author' | 'collaborator';
  canAddAuthor: boolean;
  canRemoveAuthor: boolean;
  canManageCollaborators: boolean;
  loading?: boolean;
  searching?: boolean;
  mutating?: boolean;
  onSearchQueryChange: (value: string) => void;
  onSelectedRoleChange: (role: 'author' | 'collaborator') => void;
  onAdd: (memberId: string, role: 'author' | 'collaborator') => void;
  onRemove: (memberId: string, role: 'author' | 'collaborator') => void;
  onChangeRole: (memberId: string, role: 'author' | 'collaborator') => void;
  labels: {
    title: string;
    close: string;
    addSectionLabel: string;
    memberLabel: string;
    searchPlaceholder: string;
    typeAtLeast2Characters: string;
    noUsersFound: string;
    roleLabel: string;
    author: string;
    collaborator: string;
    empty: string;
    inactiveAuthority: string;
    lastAuthor: string;
    removeAuthor: string;
    adminOnlyRemoveAuthor: string;
    removeCollaborator: string;
    cannotRemoveCollaborator: string;
    changeToAuthor: string;
    changeToCollaborator: string;
    cannotChangeRole: string;
    inactiveCannotChangeRole: string;
  };
}

export function normalizeSelectedParticipantRole(
  selectedRole: 'author' | 'collaborator',
  canAddAuthor: boolean,
  canManageCollaborators: boolean,
): 'author' | 'collaborator' | null {
  const allowedRoles: Array<'author' | 'collaborator'> = [
    ...(canAddAuthor ? ['author' as const] : []),
    ...(canManageCollaborators ? ['collaborator' as const] : []),
  ];
  return allowedRoles.includes(selectedRole) ? selectedRole : (allowedRoles[0] ?? null);
}

export function PostParticipantsDialogView({
  opened,
  onClose,
  participants,
  candidates,
  searchQuery,
  selectedRole,
  canAddAuthor,
  canRemoveAuthor,
  canManageCollaborators,
  loading = false,
  searching = false,
  mutating = false,
  onSearchQueryChange,
  onSelectedRoleChange,
  onAdd,
  onRemove,
  onChangeRole,
  labels,
}: PostParticipantsDialogViewProps) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const authorCount = participants.filter((participant) => participant.role === 'author').length;
  const roleOptions = useMemo(
    () => [
      ...(canAddAuthor ? [{ value: 'author', label: labels.author }] : []),
      ...(canManageCollaborators ? [{ value: 'collaborator', label: labels.collaborator }] : []),
    ],
    [canAddAuthor, canManageCollaborators, labels.author, labels.collaborator],
  );
  const normalizedSelectedRole = normalizeSelectedParticipantRole(selectedRole, canAddAuthor, canManageCollaborators);

  return (
    <ContentModal opened={opened} onClose={onClose} title={labels.title} closeLabel={labels.close} size="standard">
      <Stack gap="md">
        {roleOptions.length > 0 ? (
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              {labels.addSectionLabel}
            </Text>
            <div className={styles.addControls}>
              <div className={styles.searchControl} data-participant-search-control>
                <SearchComboboxView
                  combobox={combobox}
                  search={searchQuery}
                  onSearchChange={onSearchQueryChange}
                  label={labels.memberLabel}
                  placeholder={labels.searchPlaceholder}
                  leftSection={<IconUserPlus size={16} />}
                  items={candidates}
                  isLoading={searching}
                  debouncedSearch={searchQuery}
                  onSelect={(memberId) => {
                    if (normalizedSelectedRole) {
                      onAdd(memberId, normalizedSelectedRole);
                    }
                    combobox.closeDropdown();
                  }}
                  renderItem={(candidate) => (
                    <Group gap="sm" wrap="nowrap">
                      <Avatar src={candidate.avatarUrl} size="sm" radius="xl">
                        {candidate.nickname.charAt(0)}
                      </Avatar>
                      <Text size="sm" truncate>
                        {candidate.nickname}
                      </Text>
                    </Group>
                  )}
                  getItemId={(candidate) => candidate.id}
                  minimumQueryMessage={labels.typeAtLeast2Characters}
                  noResultsMessage={labels.noUsersFound}
                  size="sm"
                />
              </div>
              <div className={styles.roleControl} data-participant-role-select>
                <span className={styles.roleWidthSizer} aria-hidden="true">
                  <span>{labels.roleLabel}</span>
                  {roleOptions.map((option) => (
                    <span key={option.value}>{option.label}</span>
                  ))}
                </span>
                <Select
                  label={labels.roleLabel}
                  value={normalizedSelectedRole}
                  onChange={(value) => value && onSelectedRoleChange(value as 'author' | 'collaborator')}
                  data={roleOptions}
                  allowDeselect={false}
                  disabled={roleOptions.length === 1}
                  size="sm"
                  classNames={{ root: styles.roleSelectRoot, input: styles.roleSelectInput }}
                />
              </div>
            </div>
          </Stack>
        ) : null}

        {loading ? (
          <Group justify="center" py="md">
            <Loader size="sm" />
          </Group>
        ) : participants.length === 0 ? (
          <Text size="sm" c="dimmed">
            {labels.empty}
          </Text>
        ) : (
          <ScrollArea.Autosize mah={360}>
            <Stack gap="xs">
              {participants.map((participant) => {
                const lastAuthor = participant.role === 'author' && authorCount <= 1;
                const canRemove =
                  participant.role === 'author' ? canRemoveAuthor && !lastAuthor : canManageCollaborators;
                const targetRole = participant.role === 'author' ? 'collaborator' : 'author';
                const canChangeRoleByPermission =
                  participant.role === 'author'
                    ? canRemoveAuthor && canManageCollaborators && !lastAuthor
                    : canAddAuthor;
                const canChangeRole = participant.hasEffectiveAuthority && canChangeRoleByPermission;
                const changeRoleAction =
                  participant.role === 'author' ? labels.changeToCollaborator : labels.changeToAuthor;
                const changeRoleReason = canChangeRole
                  ? changeRoleAction
                  : !participant.hasEffectiveAuthority
                    ? labels.inactiveCannotChangeRole
                    : lastAuthor
                      ? labels.lastAuthor
                      : labels.cannotChangeRole;
                const removeAction = participant.role === 'author' ? labels.removeAuthor : labels.removeCollaborator;
                const removeReason =
                  participant.role === 'author'
                    ? lastAuthor
                      ? labels.lastAuthor
                      : canRemoveAuthor
                        ? removeAction
                        : labels.adminOnlyRemoveAuthor
                    : canManageCollaborators
                      ? removeAction
                      : labels.cannotRemoveCollaborator;
                return (
                  <div
                    key={`${participant.role}:${participant.memberId}`}
                    data-participant-id={participant.memberId}
                    className={styles.participantRow}
                  >
                    <Group gap="sm" wrap="nowrap" className={styles.participantIdentity}>
                      <Avatar src={participant.avatarUrl} size="sm" radius="xl">
                        {participant.nickname.charAt(0)}
                      </Avatar>
                      <Group gap={4} wrap="nowrap" className={styles.participantText}>
                        <Text size="sm" truncate>
                          {participant.nickname}
                        </Text>
                        {!participant.hasEffectiveAuthority ? (
                          <Tooltip label={labels.inactiveAuthority}>
                            <span
                              className={styles.inactiveStatus}
                              role="img"
                              aria-label={labels.inactiveAuthority}
                              data-participant-inactive-status
                            >
                              <IconUserOff size={14} aria-hidden="true" />
                            </span>
                          </Tooltip>
                        ) : null}
                      </Group>
                    </Group>
                    <div className={styles.participantActions} data-participant-actions>
                      <Tooltip label={participant.role === 'author' ? labels.author : labels.collaborator}>
                        <span className={styles.roleBadgeContainer} data-participant-role-badge>
                          <LabelBadge
                            tone={participant.role === 'author' ? 'accent' : 'neutral'}
                            size="sm"
                            className={styles.roleBadge}
                          >
                            {participant.role === 'author' ? labels.author : labels.collaborator}
                          </LabelBadge>
                        </span>
                      </Tooltip>
                      <Tooltip label={changeRoleReason}>
                        <span className={styles.actionButton}>
                          <IconButton
                            emphasis="low"
                            size="sm"
                            aria-label={changeRoleAction}
                            disabled={!canChangeRole || mutating}
                            onClick={() => onChangeRole(participant.memberId, targetRole)}
                          >
                            <IconArrowsExchange size={14} />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip label={removeReason}>
                        <span className={styles.actionButton}>
                          <IconButton
                            tone="danger"
                            emphasis="low"
                            size="sm"
                            aria-label={removeAction}
                            disabled={!canRemove || mutating}
                            onClick={() => onRemove(participant.memberId, participant.role)}
                          >
                            <IconX size={14} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Stack>
    </ContentModal>
  );
}
