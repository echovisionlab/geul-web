'use client';

import type { ReactNode } from 'react';
import { IconArrowLeft, IconBan, IconCheck, IconTrash } from '@tabler/icons-react';
import { Avatar, Group, Stack, Text, Title } from '@mantine/core';
import { StatusBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { Select, TextInput } from '@/components/core/Input';
import { ConfirmModal, FormModal } from '@/components/core/Modal';
import { SocialIcon, type SocialPlatform } from '@/components/core/Social';
import { Tooltip } from '@/components/core/Tooltip';
import classes from './UserProfileView.module.css';

export interface UserProfileSocialLink {
  key: string;
  href: string;
  label: string;
  platform: SocialPlatform;
}

export interface UserProfileDisplay {
  name: string;
  initials: string;
  avatarUrl: string | null;
  roleLabel: string | null;
  joinedLabel: string | null;
  bio: string | null;
  socialLinks: UserProfileSocialLink[];
  banned: boolean;
  banReason: string | null;
  showAdminActions: boolean;
}

export interface UserProfileDialogLabels {
  title: string;
  description?: ReactNode;
  confirm: string;
  cancel: string;
  close: string;
}

export interface UserProfileLabels {
  title: string;
  back: string;
  socialLinks: string;
  banned: string;
  changeRole: string;
  ban: string;
  unban: string;
  delete: string;
  banDialog: UserProfileDialogLabels & {
    reason: string;
    reasonPlaceholder: string;
  };
  roleDialog: UserProfileDialogLabels & {
    role: string;
  };
  deleteDialog: UserProfileDialogLabels & {
    warning: string;
  };
}

export interface UserProfileDialogState {
  opened: boolean;
  pending: boolean;
  error: string | null;
}

export interface UserProfileDialogs {
  ban: UserProfileDialogState & {
    reason: string;
  };
  role: UserProfileDialogState & {
    value: string | null;
    options: Array<{ value: string; label: string }>;
  };
  delete: UserProfileDialogState;
}

export interface UserProfileEvents {
  onBack: () => void;
  onOpenBan: () => void;
  onCloseBan: () => void;
  onBanReasonChange: (value: string) => void;
  onConfirmBan: () => void;
  onUnban: () => void;
  onOpenRole: () => void;
  onCloseRole: () => void;
  onRoleChange: (value: string | null) => void;
  onConfirmRole: () => void;
  onOpenDelete: () => void;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
}

export interface UserProfileViewProps {
  profile: UserProfileDisplay;
  labels: UserProfileLabels;
  dialogs: UserProfileDialogs;
  events: UserProfileEvents;
  unbanPending?: boolean;
}

/** Pure public profile UI. Service state, formatted values, and commands arrive through props. */
export function UserProfileView({ profile, labels, dialogs, events, unbanPending = false }: UserProfileViewProps) {
  return (
    <Stack gap="xl" data-user-profile>
      <Group gap="sm">
        <Tooltip label={labels.back}>
          <IconButton aria-label={labels.back} onClick={events.onBack}>
            <IconArrowLeft size={20} aria-hidden />
          </IconButton>
        </Tooltip>
        <Title order={2}>{labels.title}</Title>
      </Group>

      <Group justify="space-between" align="flex-start" wrap="wrap" gap="xl">
        <Group align="flex-start" wrap="nowrap" gap="md" className={classes.identity}>
          <Avatar src={profile.avatarUrl} alt={profile.name} size={80} radius="50%">
            {profile.initials}
          </Avatar>

          <Stack gap={6} className={classes.profileCopy}>
            <Text size="xl" fw={600} className={classes.longText}>
              {profile.name}
            </Text>

            {profile.roleLabel || profile.banned ? (
              <Group gap="xs">
                {profile.roleLabel ? (
                  <Text size="xs" c="dimmed">
                    {profile.roleLabel}
                  </Text>
                ) : null}
                {profile.banned ? (
                  <StatusBadge tone="danger" appearance="solid">
                    {labels.banned}
                  </StatusBadge>
                ) : null}
              </Group>
            ) : null}

            {profile.joinedLabel ? (
              <Text size="xs" c="dimmed">
                {profile.joinedLabel}
              </Text>
            ) : null}

            {profile.bio ? (
              <Text size="sm" c="dimmed" maw={640} className={classes.longText}>
                {profile.bio}
              </Text>
            ) : null}

            {profile.socialLinks.length > 0 ? (
              <Group gap="xs" role="list" aria-label={labels.socialLinks}>
                {profile.socialLinks.map((link) => (
                  <Tooltip key={link.key} label={link.label}>
                    <span role="listitem">
                      <IconButton
                        component="a"
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={link.label}
                        className={classes.socialLink}
                      >
                        <SocialIcon platform={link.platform} size={18} colorMode="hoverBrand" />
                      </IconButton>
                    </span>
                  </Tooltip>
                ))}
              </Group>
            ) : null}
          </Stack>
        </Group>

        {profile.showAdminActions ? (
          <Group gap="xs" className={classes.adminActions} data-user-profile-admin-actions>
            <Button type="button" emphasis="medium" size="xs" onClick={events.onOpenRole}>
              {labels.changeRole}
            </Button>
            {profile.banned ? (
              <Button
                type="button"
                tone="positive"
                emphasis="medium"
                size="xs"
                leftSection={<IconCheck size={14} aria-hidden />}
                onClick={events.onUnban}
                loading={unbanPending}
              >
                {labels.unban}
              </Button>
            ) : (
              <Button
                type="button"
                tone="warning"
                emphasis="medium"
                size="xs"
                leftSection={<IconBan size={14} aria-hidden />}
                onClick={events.onOpenBan}
              >
                {labels.ban}
              </Button>
            )}
            <Button
              type="button"
              tone="danger"
              emphasis="medium"
              size="xs"
              leftSection={<IconTrash size={14} aria-hidden />}
              onClick={events.onOpenDelete}
            >
              {labels.delete}
            </Button>
          </Group>
        ) : null}
      </Group>

      {profile.banReason ? (
        <Text size="sm" c="red" className={classes.longText} data-user-profile-ban-reason>
          {profile.banReason}
        </Text>
      ) : null}

      <FormModal
        opened={dialogs.ban.opened}
        onClose={events.onCloseBan}
        onSubmit={events.onConfirmBan}
        title={labels.banDialog.title}
        submitLabel={labels.banDialog.confirm}
        cancelLabel={labels.banDialog.cancel}
        closeLabel={labels.banDialog.close}
        submitTone="danger"
        loading={dialogs.ban.pending}
      >
        {labels.banDialog.description ? <Text>{labels.banDialog.description}</Text> : null}
        <TextInput
          label={labels.banDialog.reason}
          placeholder={labels.banDialog.reasonPlaceholder}
          value={dialogs.ban.reason}
          onChange={(event) => events.onBanReasonChange(event.currentTarget.value)}
          disabled={dialogs.ban.pending}
        />
        <DialogError message={dialogs.ban.error} />
      </FormModal>

      <FormModal
        opened={dialogs.role.opened}
        onClose={events.onCloseRole}
        onSubmit={events.onConfirmRole}
        title={labels.roleDialog.title}
        submitLabel={labels.roleDialog.confirm}
        cancelLabel={labels.roleDialog.cancel}
        closeLabel={labels.roleDialog.close}
        loading={dialogs.role.pending}
        submitDisabled={!dialogs.role.value}
      >
        {labels.roleDialog.description ? <Text>{labels.roleDialog.description}</Text> : null}
        <Select
          label={labels.roleDialog.role}
          data={dialogs.role.options}
          value={dialogs.role.value}
          onChange={events.onRoleChange}
          disabled={dialogs.role.pending}
        />
        <DialogError message={dialogs.role.error} />
      </FormModal>

      <ConfirmModal
        opened={dialogs.delete.opened}
        onClose={events.onCloseDelete}
        onConfirm={events.onConfirmDelete}
        title={labels.deleteDialog.title}
        confirmLabel={labels.deleteDialog.confirm}
        cancelLabel={labels.deleteDialog.cancel}
        closeLabel={labels.deleteDialog.close}
        loading={dialogs.delete.pending}
        message={
          <Stack gap="xs">
            {labels.deleteDialog.description ? <Text>{labels.deleteDialog.description}</Text> : null}
            <Text c="red" size="sm">
              {labels.deleteDialog.warning}
            </Text>
            <DialogError message={dialogs.delete.error} />
          </Stack>
        }
      />
    </Stack>
  );
}

function DialogError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <Text role="alert" c="red" size="sm" className={classes.longText}>
      {message}
    </Text>
  );
}
