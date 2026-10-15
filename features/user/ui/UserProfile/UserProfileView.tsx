'use client';
import { ConfirmationDialog } from '@/features/confirmation/ui/ConfirmationDialog';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Heading as DsHeading, Text as DsText } from '@/components/core/Typography';
import type { ReactNode } from 'react';
import { IconArrowLeft, IconBan, IconCheck, IconTrash } from '@tabler/icons-react';

import { Avatar } from '@/components/core/Display';
import { StatusBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { Select, TextInput } from '@/components/core/Input';
import { FormModal } from '@/components/core/Modal';
import type { PreparedSocialIcon, SocialPlatform } from '@/components/core/Social';
// Catalog-free renderer: glyphs are prepared on the server with Core prepareSocialIcon.
import { SocialIconGlyph } from '@/components/core/Social/SocialIconGlyph';
import { Tooltip } from '@/components/core/Tooltip';

export interface UserProfileSocialLink {
  key: string;
  href: string;
  label: string;
  platform: SocialPlatform;
  glyph: PreparedSocialIcon;
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
    <DsLayoutStack gap="xl" data-user-profile>
      <DsLayoutInline gap="sm">
        <Tooltip label={labels.back}>
          <IconButton aria-label={labels.back} onClick={events.onBack}>
            <IconArrowLeft size={20} aria-hidden />
          </IconButton>
        </Tooltip>
        <DsHeading level={1} scale={2}>
          {labels.title}
        </DsHeading>
      </DsLayoutInline>

      <DsLayoutInline
        justify="between"
        align="stretch"
        wrap="nowrap"
        direction={{ base: 'column', xs: 'row' }}
        gap="xl"
      >
        <DsLayoutInline flexible fill="inline" align="start" wrap="nowrap" gap="md">
          <Avatar src={profile.avatarUrl} alt={profile.name} size="profile" shape="circle">
            {profile.initials}
          </Avatar>

          <DsLayoutStack flexible gap="xxs">
            <DsText wrap="anywhere" size="xl" weight="strong">
              {profile.name}
            </DsText>

            {profile.roleLabel || profile.banned ? (
              <DsLayoutInline gap="xs">
                {profile.roleLabel ? (
                  <DsText size="xs" tone="secondary">
                    {profile.roleLabel}
                  </DsText>
                ) : null}
                {profile.banned ? (
                  <StatusBadge tone="danger" appearance="solid">
                    {labels.banned}
                  </StatusBadge>
                ) : null}
              </DsLayoutInline>
            ) : null}

            {profile.joinedLabel ? (
              <DsText size="xs" tone="secondary">
                {profile.joinedLabel}
              </DsText>
            ) : null}

            {profile.bio ? (
              <div style={{ maxWidth: 640 }}>
                <DsText wrap="anywhere" size="sm" tone="secondary">
                  {profile.bio}
                </DsText>
              </div>
            ) : null}

            {profile.socialLinks.length > 0 ? (
              <DsLayoutInline gap="xs" role="list" aria-label={labels.socialLinks}>
                {profile.socialLinks.map((link) => (
                  <Tooltip key={link.key} label={link.label}>
                    <span role="listitem">
                      <IconButton href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label}>
                        <SocialIconGlyph icon={link.glyph} size="lg" colorMode="hoverBrand" />
                      </IconButton>
                    </span>
                  </Tooltip>
                ))}
              </DsLayoutInline>
            ) : null}
          </DsLayoutStack>
        </DsLayoutInline>

        {profile.showAdminActions ? (
          <DsLayoutInline justify={{ base: 'start', xs: 'end' }} gap="xs" data-user-profile-admin-actions>
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
          </DsLayoutInline>
        ) : null}
      </DsLayoutInline>

      {profile.banReason ? (
        <DsText wrap="anywhere" size="sm" tone="danger" data-user-profile-ban-reason>
          {profile.banReason}
        </DsText>
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
        {labels.banDialog.description ? <DsText>{labels.banDialog.description}</DsText> : null}
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
        {labels.roleDialog.description ? <DsText>{labels.roleDialog.description}</DsText> : null}
        <Select
          label={labels.roleDialog.role}
          data={dialogs.role.options}
          value={dialogs.role.value}
          onChange={events.onRoleChange}
          disabled={dialogs.role.pending}
        />
        <DialogError message={dialogs.role.error} />
      </FormModal>

      <ConfirmationDialog
        intent="delete"
        opened={dialogs.delete.opened}
        onClose={events.onCloseDelete}
        onConfirm={events.onConfirmDelete}
        title={labels.deleteDialog.title}
        confirmLabel={labels.deleteDialog.confirm}
        cancelLabel={labels.deleteDialog.cancel}
        closeLabel={labels.deleteDialog.close}
        loading={dialogs.delete.pending}
        message={
          <DsLayoutStack gap="xs">
            {labels.deleteDialog.description ? <DsText>{labels.deleteDialog.description}</DsText> : null}
            <DsText tone="danger" size="sm">
              {labels.deleteDialog.warning}
            </DsText>
            <DialogError message={dialogs.delete.error} />
          </DsLayoutStack>
        }
      />
    </DsLayoutStack>
  );
}

function DialogError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <DsText wrap="anywhere" role="alert" tone="danger" size="sm">
      {message}
    </DsText>
  );
}
