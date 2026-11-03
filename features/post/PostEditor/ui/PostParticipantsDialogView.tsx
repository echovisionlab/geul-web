'use client';
import { SupportingText, Text as DsText } from '@/components/core/Typography';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';

import { useInputCombobox, SearchComboboxView, Select } from '@/components/core/Input';

import { useId, useMemo, type ReactNode } from 'react';
import { IconArrowsExchange, IconUserPlus, IconX } from '@tabler/icons-react';

import { Avatar, ScrollArea } from '@/components/core/Display';
import { IconButton } from '@/components/core/IconButton';

import { ContentModal } from '@/components/core/Modal';
import { Tooltip } from '@/components/core/Tooltip';
import { ParticipantRow } from '@/features/participants/ParticipantRow';

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
  queryFailure?: ReactNode;
  loading?: boolean;
  loadingSurface: ReactNode;
  pendingAction?: { memberId: string; action: 'remove' | 'change-role' };
  failed?: boolean;
  searching?: boolean;
  searchError?: string;
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
  queryFailure,
  loading = false,
  loadingSurface,
  pendingAction,
  failed = false,
  searching = false,
  searchError,
  mutating = false,
  onSearchQueryChange,
  onSelectedRoleChange,
  onAdd,
  onRemove,
  onChangeRole,
  labels,
}: PostParticipantsDialogViewProps) {
  const combobox = useInputCombobox();
  const dialogId = useId();
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
      <DsLayoutStack gap="md">
        {queryFailure}
        {roleOptions.length > 0 ? (
          <DsLayoutStack gap="xs">
            <DsText size="sm" weight="medium">
              {labels.addSectionLabel}
            </DsText>
            <DsLayoutInline gap="xs" align="end" wrap="nowrap" direction={{ base: 'column', xs: 'row' }}>
              <DsLayoutStack gap="none" flexible fill="inline" data-participant-search-control>
                <SearchComboboxView
                  combobox={combobox}
                  search={searchQuery}
                  onSearchChange={onSearchQueryChange}
                  label={labels.memberLabel}
                  placeholder={labels.searchPlaceholder}
                  leftSection={<IconUserPlus size={16} />}
                  items={candidates}
                  isLoading={searching || mutating}
                  disabled={loading || failed || mutating}
                  debouncedSearch={searchQuery}
                  onSelect={(memberId) => {
                    if (normalizedSelectedRole && !mutating && !loading && !failed) {
                      onAdd(memberId, normalizedSelectedRole);
                    }
                    combobox.closeDropdown();
                  }}
                  renderItem={(candidate) => (
                    <DsLayoutInline gap="sm" wrap="nowrap">
                      <Avatar src={candidate.avatarUrl} size="sm" shape="circle" name={candidate.nickname} />
                      <DsText size="sm" truncate>
                        {candidate.nickname}
                      </DsText>
                    </DsLayoutInline>
                  )}
                  getItemId={(candidate) => candidate.id}
                  getItemText={(candidate) => candidate.nickname}
                  minimumQueryMessage={labels.typeAtLeast2Characters}
                  error={searchError}
                  emptyMessage={searchError}
                  noResultsMessage={labels.noUsersFound}
                  size="sm"
                />
              </DsLayoutStack>
              <Select
                width="content"
                data-participant-role-select
                label={labels.roleLabel}
                value={normalizedSelectedRole}
                onChange={(value) => value && onSelectedRoleChange(value as 'author' | 'collaborator')}
                data={roleOptions}
                allowDeselect={false}
                disabled={roleOptions.length === 1 || mutating || loading || failed}
                size="sm"
              />
            </DsLayoutInline>
          </DsLayoutStack>
        ) : null}

        {loading ? (
          loadingSurface
        ) : failed ? null : participants.length === 0 ? (
          <SupportingText tone="secondary">{labels.empty}</SupportingText>
        ) : (
          <ScrollArea.Autosize size="large">
            <DsLayoutStack gap="xs">
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
                  <ParticipantRow
                    key={`${participant.role}:${participant.memberId}`}
                    memberId={participant.memberId}
                    identityId={`${dialogId}-${participant.memberId}-${participant.role}`}
                    nickname={participant.nickname}
                    avatarUrl={participant.avatarUrl}
                    roleLabel={participant.role === 'author' ? labels.author : labels.collaborator}
                    principal={participant.role === 'author'}
                    inactiveLabel={participant.hasEffectiveAuthority ? undefined : labels.inactiveAuthority}
                    actions={
                      <>
                        {!canChangeRole ? (
                          <span hidden id={`${dialogId}-${participant.memberId}-${participant.role}-change-reason`}>
                            {changeRoleReason}
                          </span>
                        ) : null}
                        {!canRemove ? (
                          <span hidden id={`${dialogId}-${participant.memberId}-${participant.role}-remove-reason`}>
                            {removeReason}
                          </span>
                        ) : null}
                        <Tooltip label={changeRoleReason}>
                          <span>
                            <IconButton
                              emphasis="low"
                              size="sm"
                              aria-label={changeRoleAction}
                              aria-describedby={`${dialogId}-${participant.memberId}-${participant.role}${!canChangeRole ? ` ${dialogId}-${participant.memberId}-${participant.role}-change-reason` : ''}`}
                              disabled={!canChangeRole || mutating}
                              loading={
                                pendingAction?.memberId === participant.memberId &&
                                pendingAction.action === 'change-role'
                              }
                              onClick={() => onChangeRole(participant.memberId, targetRole)}
                            >
                              <IconArrowsExchange size={14} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip label={removeReason}>
                          <span>
                            <IconButton
                              tone="danger"
                              emphasis="low"
                              size="sm"
                              aria-label={removeAction}
                              aria-describedby={`${dialogId}-${participant.memberId}-${participant.role}${!canRemove ? ` ${dialogId}-${participant.memberId}-${participant.role}-remove-reason` : ''}`}
                              disabled={!canRemove || mutating}
                              loading={
                                pendingAction?.memberId === participant.memberId && pendingAction.action === 'remove'
                              }
                              onClick={() => onRemove(participant.memberId, participant.role)}
                            >
                              <IconX size={14} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </>
                    }
                  />
                );
              })}
            </DsLayoutStack>
          </ScrollArea.Autosize>
        )}
      </DsLayoutStack>
    </ContentModal>
  );
}
