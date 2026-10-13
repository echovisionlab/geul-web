'use client';
import { SupportingText, Text as DsText } from '@/components/core/Typography';

import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';

import { useInputCombobox, SearchComboboxView, Select } from '@/components/core/Input';

import { useId, useMemo, type ReactNode } from 'react';
import { IconArrowsExchange, IconUserPlus, IconX } from '@tabler/icons-react';

import { Avatar, Spinner as Loader, ScrollArea } from '@/components/core/Display';
import { IconButton } from '@/components/core/IconButton';

import { ContentModal } from '@/components/core/Modal';
import { Tooltip } from '@/components/core/Tooltip';
import { ParticipantRow } from '@/features/participants/ParticipantRow';

export type LabelParticipantRoleName = 'owner' | 'manager';

export interface LabelParticipantViewModel {
  memberId: string;
  nickname: string;
  avatarUrl?: string;
  role: LabelParticipantRoleName;
  hasEffectiveAuthority: boolean;
}

export interface LabelParticipantCandidate {
  id: string;
  nickname: string;
  avatarUrl: string | null;
}

export interface LabelParticipantsDialogViewProps {
  opened: boolean;
  onClose: () => void;
  participants: LabelParticipantViewModel[];
  candidates: LabelParticipantCandidate[];
  searchQuery: string;
  selectedRole: LabelParticipantRoleName;
  canManageParticipants: boolean;
  canRemoveOwner: boolean;
  queryFailure?: ReactNode;
  loading?: boolean;
  searching?: boolean;
  mutating?: boolean;
  onSearchQueryChange: (value: string) => void;
  onSelectedRoleChange: (role: LabelParticipantRoleName) => void;
  onAdd: (memberId: string, role: LabelParticipantRoleName) => void;
  onRemove: (memberId: string) => void;
  onChangeRole: (memberId: string, role: LabelParticipantRoleName) => void;
  labels: {
    title: string;
    close: string;
    addParticipant: string;
    member: string;
    role: string;
    owner: string;
    manager: string;
    inactive: string;
    makeOwner: string;
    makeManager: string;
    remove: string;
    empty: string;
    lastOwner: string;
    searchPlaceholder: string;
    typeAtLeast2Characters: string;
    noUsersFound: string;
  };
}

export function LabelParticipantsDialogView({
  opened,
  onClose,
  participants,
  candidates,
  searchQuery,
  selectedRole,
  canManageParticipants,
  canRemoveOwner,
  queryFailure,
  loading = false,
  searching = false,
  mutating = false,
  onSearchQueryChange,
  onSelectedRoleChange,
  onAdd,
  onRemove,
  onChangeRole,
  labels,
}: LabelParticipantsDialogViewProps) {
  const combobox = useInputCombobox();
  const dialogId = useId();
  const ownerCount = participants.filter((participant) => participant.role === 'owner').length;
  const roleOptions = useMemo(
    () => [
      { value: 'owner', label: labels.owner },
      { value: 'manager', label: labels.manager },
    ],
    [labels.manager, labels.owner],
  );

  return (
    <ContentModal opened={opened} onClose={onClose} title={labels.title} closeLabel={labels.close} size="standard">
      <DsLayoutStack gap="md">
        {queryFailure}
        {canManageParticipants ? (
          <DsLayoutStack gap="xs">
            <DsText size="sm" weight="medium">
              {labels.addParticipant}
            </DsText>
            <DsLayoutInline gap="xs" align="end" wrap="nowrap" direction={{ base: 'column', xs: 'row' }}>
              <DsLayoutStack gap="none" flexible fill="inline" data-participant-search-control>
                <SearchComboboxView
                  combobox={combobox}
                  search={searchQuery}
                  onSearchChange={onSearchQueryChange}
                  label={labels.member}
                  placeholder={labels.searchPlaceholder}
                  leftSection={<IconUserPlus size={16} />}
                  items={candidates}
                  isLoading={searching}
                  debouncedSearch={searchQuery}
                  onSelect={(memberId) => {
                    onAdd(memberId, selectedRole);
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
                  noResultsMessage={labels.noUsersFound}
                  size="sm"
                />
              </DsLayoutStack>
              <Select
                width="content"
                data-participant-role-select
                label={labels.role}
                value={selectedRole}
                onChange={(value) => value && onSelectedRoleChange(value as LabelParticipantRoleName)}
                data={roleOptions}
                allowDeselect={false}
                size="sm"
              />
            </DsLayoutInline>
          </DsLayoutStack>
        ) : null}

        {loading ? (
          <DsLayoutInset block="md">
            <DsLayoutInline justify="center">
              <Loader size="sm" />
            </DsLayoutInline>
          </DsLayoutInset>
        ) : participants.length === 0 ? (
          <SupportingText tone="secondary">{labels.empty}</SupportingText>
        ) : (
          <ScrollArea.Autosize size="large">
            <DsLayoutStack gap="xs">
              {participants.map((participant) => {
                const isOwner = participant.role === 'owner';
                const isLastOwner = isOwner && ownerCount <= 1;
                const canChangeRole =
                  participant.hasEffectiveAuthority &&
                  canManageParticipants &&
                  (!isOwner || (canRemoveOwner && !isLastOwner));
                const canRemove = canManageParticipants && (!isOwner || (canRemoveOwner && !isLastOwner));
                const targetRole: LabelParticipantRoleName = isOwner ? 'manager' : 'owner';
                const changeLabel = isOwner ? labels.makeManager : labels.makeOwner;
                const disabledReason = isLastOwner ? labels.lastOwner : changeLabel;
                return (
                  <ParticipantRow
                    key={participant.memberId}
                    memberId={participant.memberId}
                    identityId={`${dialogId}-${participant.memberId}`}
                    nickname={participant.nickname}
                    avatarUrl={participant.avatarUrl}
                    roleLabel={isOwner ? labels.owner : labels.manager}
                    principal={isOwner}
                    inactiveLabel={participant.hasEffectiveAuthority ? undefined : labels.inactive}
                    actions={
                      <>
                        {isLastOwner ? (
                          <span hidden id={`${dialogId}-${participant.memberId}-last-owner`}>
                            {labels.lastOwner}
                          </span>
                        ) : null}
                        <Tooltip label={canChangeRole ? changeLabel : disabledReason}>
                          <span>
                            <IconButton
                              emphasis="low"
                              size="sm"
                              aria-label={changeLabel}
                              aria-describedby={`${dialogId}-${participant.memberId}${isLastOwner ? ` ${dialogId}-${participant.memberId}-last-owner` : ''}`}
                              disabled={!canChangeRole || mutating}
                              onClick={() => onChangeRole(participant.memberId, targetRole)}
                            >
                              <IconArrowsExchange size={14} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip label={canRemove ? labels.remove : disabledReason}>
                          <span>
                            <IconButton
                              tone="danger"
                              emphasis="low"
                              size="sm"
                              aria-label={labels.remove}
                              aria-describedby={`${dialogId}-${participant.memberId}${isLastOwner ? ` ${dialogId}-${participant.memberId}-last-owner` : ''}`}
                              disabled={!canRemove || mutating}
                              onClick={() => onRemove(participant.memberId)}
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
