'use client';

import { IconCopy, IconExternalLink, IconLink, IconPlus, IconTrash } from '@tabler/icons-react';
import { Group, Loader, Stack, Text } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { PasswordInput, Select, TextInput } from '@/components/core/Input';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { Tooltip } from '@/components/core/Tooltip';

export type ShareLinkBadgeTone = 'neutral' | 'accent' | 'positive' | 'warning' | 'danger';

export interface ShareLinkBadgeViewModel {
  label: string;
  tone: ShareLinkBadgeTone;
}

export interface ShareLinkItemViewModel {
  id: string;
  label: string | null;
  displayUrl: string;
  openUrl: string | null;
  expired: boolean;
  badges: ShareLinkBadgeViewModel[];
}

export interface ShareLinkSectionViewLabels {
  title: string;
  newLink: string;
  labelOptional: string;
  labelPlaceholder: string;
  expiration: string;
  expiresAt: string;
  selectDateAndTime: string;
  passwordOptional: string;
  passwordPlaceholder: string;
  passwordProtected: string;
  noPassword: string;
  maximumExpiration: string;
  cancel: string;
  create: string;
  noLinks: string;
  showLess: string;
  showMore: string;
  copy: string;
  openInNewTab: string;
  delete: string;
  copyAria: string;
  openAria: string;
  deleteAria: string;
}

export interface ShareLinkSectionViewProps {
  labels: ShareLinkSectionViewLabels;
  description?: string;
  links: ShareLinkItemViewModel[];
  totalLinkCount: number;
  expirationOptions: { value: string; label: string }[];
  formOpened: boolean;
  hydrated: boolean;
  label: string;
  preset: string;
  customDateTimestamp: number | null;
  maxDateTimestamp: number;
  password: string;
  hasMore: boolean;
  showAll: boolean;
  isLoading: boolean;
  isCreating: boolean;
  deletingLinkId: string | null;
  disabled?: boolean;
  onToggleForm: () => void;
  onCloseForm: () => void;
  onLabelChange: (value: string) => void;
  onPresetChange: (value: string) => void;
  onCustomDateChange: (timestamp: number | null) => void;
  onPasswordChange: (value: string) => void;
  onCreate: () => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleShowAll: () => void;
}

export function ShareLinkSectionView({
  labels,
  description,
  links,
  totalLinkCount,
  expirationOptions,
  formOpened,
  hydrated,
  label,
  preset,
  customDateTimestamp,
  maxDateTimestamp,
  password,
  hasMore,
  showAll,
  isLoading,
  isCreating,
  deletingLinkId,
  disabled,
  onToggleForm,
  onCloseForm,
  onLabelChange,
  onPresetChange,
  onCustomDateChange,
  onPasswordChange,
  onCreate,
  onCopy,
  onDelete,
  onToggleShowAll,
}: ShareLinkSectionViewProps) {
  return (
    <SectionCard>
      <Stack gap="md">
        <SectionHeader
          title={
            <Group gap="xs">
              <IconLink size={18} />
              <Text fw={500}>{labels.title}</Text>
              {totalLinkCount > 0 ? <LabelBadge size="sm">{totalLinkCount}</LabelBadge> : null}
            </Group>
          }
          description={description}
          actions={
            <Button
              emphasis="medium"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={onToggleForm}
              disabled={disabled}
            >
              {labels.newLink}
            </Button>
          }
        />

        {hydrated && formOpened ? (
          <SectionCard p="sm" bg="var(--mantine-color-gray-light)">
            <Stack gap="sm">
              <TextInput
                label={labels.labelOptional}
                placeholder={labels.labelPlaceholder}
                value={label}
                onChange={(event) => onLabelChange(event.currentTarget.value)}
                size="sm"
                disabled={disabled}
              />
              <Group gap="sm" align="flex-end" grow>
                <Select
                  label={labels.expiration}
                  size="sm"
                  value={preset}
                  onChange={(value) => value && onPresetChange(value)}
                  data={expirationOptions}
                  allowDeselect={false}
                  style={{ flex: 1 }}
                  disabled={disabled}
                />
                {preset === 'custom' ? (
                  <DateTimePicker
                    label={labels.expiresAt}
                    value={customDateTimestamp ? new Date(customDateTimestamp) : null}
                    onChange={(value) => onCustomDateChange(value ? new Date(value).getTime() : null)}
                    placeholder={labels.selectDateAndTime}
                    size="sm"
                    minDate={new Date()}
                    maxDate={new Date(maxDateTimestamp)}
                    style={{ flex: 1 }}
                    valueFormat="YYYY-MM-DD HH:mm"
                    disabled={disabled}
                  />
                ) : null}
              </Group>
              <PasswordInput
                label={labels.passwordOptional}
                placeholder={labels.passwordPlaceholder}
                value={password}
                onChange={(event) => onPasswordChange(event.currentTarget.value)}
                autoComplete="new-password"
                size="sm"
                disabled={disabled}
              />
              <Text size="xs" c="dimmed">
                {labels.maximumExpiration}
              </Text>
              <Group gap="xs" justify="flex-end">
                <Button tone="neutral" emphasis="low" size="xs" onClick={onCloseForm}>
                  {labels.cancel}
                </Button>
                <Button
                  size="xs"
                  onClick={onCreate}
                  loading={isCreating}
                  disabled={disabled || (preset === 'custom' && customDateTimestamp === null)}
                >
                  {labels.create}
                </Button>
              </Group>
            </Stack>
          </SectionCard>
        ) : null}

        {isLoading ? (
          <Group justify="center" py="md">
            <Loader size="sm" />
          </Group>
        ) : totalLinkCount === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="md">
            {labels.noLinks}
          </Text>
        ) : (
          <Stack gap="xs">
            {links.map((link) => (
              <ShareLinkItemView
                key={link.id}
                link={link}
                labels={labels}
                disabled={disabled}
                isDeleting={deletingLinkId === link.id}
                onCopy={onCopy}
                onDelete={onDelete}
              />
            ))}
            {hasMore ? (
              <Button tone="neutral" emphasis="low" size="xs" onClick={onToggleShowAll}>
                {showAll ? labels.showLess : labels.showMore}
              </Button>
            ) : null}
          </Stack>
        )}
      </Stack>
    </SectionCard>
  );
}

interface ShareLinkItemViewProps {
  link: ShareLinkItemViewModel;
  labels: ShareLinkSectionViewLabels;
  disabled?: boolean;
  isDeleting: boolean;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
}

function ShareLinkItemView({ link, labels, disabled, isDeleting, onCopy, onDelete }: ShareLinkItemViewProps) {
  const canUseLink = Boolean(link.openUrl) && !link.expired;
  const openLinkProps = canUseLink
    ? { component: 'a' as const, href: link.openUrl ?? undefined, target: '_blank', rel: 'noopener noreferrer' }
    : { 'aria-disabled': true, tabIndex: -1 };

  return (
    <Group gap="xs" wrap="nowrap" style={{ opacity: link.expired ? 0.5 : 1 }}>
      <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
        <Group gap="xs">
          {link.label ? (
            <Text size="sm" fw={500}>
              {link.label}
            </Text>
          ) : null}
          {link.badges.map((badge, index) => (
            <LabelBadge key={`${badge.label}-${index}`} size="xs" tone={badge.tone}>
              {badge.label}
            </LabelBadge>
          ))}
        </Group>
        <Text size="xs" ff="monospace" c="dimmed" truncate>
          {link.displayUrl}
        </Text>
      </Stack>
      <Group gap={4} wrap="nowrap">
        <Tooltip label={labels.copy}>
          <span style={{ display: 'inline-flex' }}>
            <IconButton
              emphasis="low"
              size="sm"
              onClick={() => onCopy(link.id)}
              disabled={!canUseLink}
              aria-label={labels.copyAria}
              data-testid={`share-link-copy-${link.id}`}
            >
              <IconCopy size={14} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip label={labels.openInNewTab}>
          <span style={{ display: 'inline-flex' }}>
            <IconButton
              emphasis="low"
              size="sm"
              disabled={!canUseLink}
              aria-label={labels.openAria}
              data-testid={`share-link-open-${link.id}`}
              {...openLinkProps}
            >
              <IconExternalLink size={14} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip label={labels.delete}>
          <span style={{ display: 'inline-flex' }}>
            <IconButton
              tone="danger"
              emphasis="low"
              size="sm"
              onClick={() => onDelete(link.id)}
              loading={isDeleting}
              disabled={disabled}
              aria-label={labels.deleteAria}
              data-testid={`share-link-delete-${link.id}`}
            >
              <IconTrash size={14} />
            </IconButton>
          </span>
        </Tooltip>
      </Group>
    </Group>
  );
}
