'use client';

import { useMemo } from 'react';
import { IconArrowsExchange, IconUserOff, IconUserPlus, IconX } from '@tabler/icons-react';
import { Avatar, Group, Loader, ScrollArea, Stack, Text, useCombobox } from '@mantine/core';
import { LabelBadge } from '@/components/core/Badge';
import { IconButton } from '@/components/core/IconButton';
import { SearchComboboxView, Select } from '@/components/core/Input';
import { ContentModal } from '@/components/core/Modal';
import { Tooltip } from '@/components/core/Tooltip';
import styles from './LabelParticipantsDialogView.module.css';

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
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
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
      <Stack gap="md">
        {canManageParticipants ? (
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              {labels.addParticipant}
            </Text>
            <div className={styles.addControls}>
              <div className={styles.searchControl} data-participant-search-control>
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
                  <span>{labels.role}</span>
                  <span>{labels.owner}</span>
                  <span>{labels.manager}</span>
                </span>
                <Select
                  label={labels.role}
                  value={selectedRole}
                  onChange={(value) => value && onSelectedRoleChange(value as LabelParticipantRoleName)}
                  data={roleOptions}
                  allowDeselect={false}
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
                  <div
                    key={participant.memberId}
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
                          <Tooltip label={labels.inactive}>
                            <span className={styles.inactiveStatus} role="img" aria-label={labels.inactive}>
                              <IconUserOff size={14} aria-hidden="true" />
                            </span>
                          </Tooltip>
                        ) : null}
                      </Group>
                    </Group>
                    <div className={styles.participantActions} data-participant-actions>
                      <span className={styles.roleBadgeContainer} data-participant-role-badge>
                        <LabelBadge tone={isOwner ? 'accent' : 'neutral'} size="sm" className={styles.roleBadge}>
                          {isOwner ? labels.owner : labels.manager}
                        </LabelBadge>
                      </span>
                      <Tooltip label={canChangeRole ? changeLabel : disabledReason}>
                        <span className={styles.actionButton}>
                          <IconButton
                            emphasis="low"
                            size="sm"
                            aria-label={changeLabel}
                            disabled={!canChangeRole || mutating}
                            onClick={() => onChangeRole(participant.memberId, targetRole)}
                          >
                            <IconArrowsExchange size={14} />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip label={canRemove ? labels.remove : disabledReason}>
                        <span className={styles.actionButton}>
                          <IconButton
                            tone="danger"
                            emphasis="low"
                            size="sm"
                            aria-label={labels.remove}
                            disabled={!canRemove || mutating}
                            onClick={() => onRemove(participant.memberId)}
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
