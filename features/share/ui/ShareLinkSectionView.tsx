'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';

import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
  LayoutGrid,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { IconExternalLink, IconPlus, IconTrash } from '@tabler/icons-react';
import { CopyButton } from '@/components/core/CopyButton';
import { DateTimePicker, PasswordInput, Select, TextInput } from '@/components/core/Input';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';

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
  copied: string;
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
  loadingSurface: ReactNode;
  errorContent?: ReactNode;
  deletingLinkIds?: readonly string[];
  isCreating: boolean;
  deletingLinkId: string | null;
  disabled?: boolean;
  onToggleForm: () => void;
  onCloseForm: () => void;
  onLabelChange: (value: string) => void;
  onPresetChange: (value: string) => void;
  onCustomDateChange: (timestamp: number | null) => void;
  onPasswordChange: (value: string) => void;
  onCreate: () => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
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
  loadingSurface,
  errorContent,
  deletingLinkIds,
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
  onDelete,
  onToggleShowAll,
}: ShareLinkSectionViewProps) {
  const formId = useId();
  const listId = useId();
  const newLinkRef = useRef<HTMLButtonElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const wasOpened = useRef(formOpened);
  useEffect(() => {
    if (hydrated && formOpened !== wasOpened.current) {
      (formOpened ? labelRef.current : newLinkRef.current)?.focus();
    }
    wasOpened.current = formOpened;
  }, [formOpened, hydrated]);
  return (
    <SectionCard padding={{ base: 'none', sm: 'md' }}>
      <DsLayoutStack gap="md">
        <SectionHeader
          descriptionPlacement="below-row"
          title={
            <DsLayoutInline gap="xs">
              <span>{labels.title}</span>
              {totalLinkCount > 0 ? <LabelBadge size="sm">{totalLinkCount}</LabelBadge> : null}
            </DsLayoutInline>
          }
          description={description}
          actions={
            <Tooltip label={labels.newLink}>
              <IconButton
                ref={newLinkRef}
                aria-expanded={hydrated && formOpened}
                aria-controls={hydrated && formOpened ? formId : undefined}
                emphasis="medium"
                size="compact"
                aria-label={labels.newLink}
                onClick={onToggleForm}
                disabled={disabled}
              >
                <IconPlus aria-hidden />
              </IconButton>
            </Tooltip>
          }
        />

        {hydrated && formOpened ? (
          <SectionCard appearance="plain" padding="none" withBorder={false}>
            <DsLayoutStack gap="xs" id={formId} role="group" aria-label={labels.newLink} aria-busy={isCreating}>
              <LayoutGrid columns={{ base: 1, sm: 2 }} gap="xs">
                <TextInput
                  ref={labelRef}
                  label={labels.labelOptional}
                  placeholder={labels.labelPlaceholder}
                  value={label}
                  onChange={(event) => onLabelChange(event.currentTarget.value)}
                  size="xs"
                  density="compact"
                  disabled={disabled}
                />
                <PasswordInput
                  label={labels.passwordOptional}
                  placeholder={labels.passwordPlaceholder}
                  value={password}
                  onChange={(event) => onPasswordChange(event.currentTarget.value)}
                  autoComplete="new-password"
                  size="xs"
                  density="compact"
                  disabled={disabled}
                />
              </LayoutGrid>
              <LayoutGrid columns={{ base: 1, sm: 2 }} gap="xs" align="end">
                <Select
                  label={labels.expiration}
                  description={labels.maximumExpiration}
                  size="xs"
                  density="compact"
                  value={preset}
                  onChange={(value) => value && onPresetChange(value)}
                  data={expirationOptions}
                  allowDeselect={false}
                  disabled={disabled}
                />
                {preset === 'custom' ? (
                  <DateTimePicker
                    label={labels.expiresAt}
                    value={customDateTimestamp ? new Date(customDateTimestamp) : null}
                    onChange={(value) => onCustomDateChange(value ? new Date(value).getTime() : null)}
                    placeholder={labels.selectDateAndTime}
                    size="xs"
                    density="compact"
                    minDate={new Date()}
                    maxDate={new Date(maxDateTimestamp)}
                    disabled={disabled}
                  />
                ) : null}
              </LayoutGrid>
              <DsLayoutInline gap="xs" justify="end">
                <Button tone="neutral" emphasis="low" size="compact" onClick={onCloseForm}>
                  {labels.cancel}
                </Button>
                <Button
                  size="compact"
                  emphasis="medium"
                  onClick={onCreate}
                  loading={isCreating}
                  disabled={disabled || (preset === 'custom' && customDateTimestamp === null)}
                >
                  {labels.create}
                </Button>
              </DsLayoutInline>
            </DsLayoutStack>
          </SectionCard>
        ) : null}

        {errorContent}
        {isLoading ? (
          loadingSurface
        ) : errorContent && totalLinkCount === 0 ? null : totalLinkCount === 0 ? (
          <DsLayoutInset block="md">
            <DsText size="xs" tone="secondary" align="center">
              {labels.noLinks}
            </DsText>
          </DsLayoutInset>
        ) : (
          <DsLayoutStack gap="xs" id={listId}>
            {links.map((link) => (
              <ShareLinkItemView
                key={link.id}
                link={link}
                labels={labels}
                disabled={disabled}
                isDeleting={deletingLinkIds ? deletingLinkIds.includes(link.id) : deletingLinkId === link.id}
                onDelete={onDelete}
              />
            ))}
            {hasMore ? (
              <Button
                tone="neutral"
                emphasis="low"
                size="xs"
                onClick={onToggleShowAll}
                aria-expanded={showAll}
                aria-controls={listId}
              >
                {showAll ? labels.showLess : labels.showMore}
              </Button>
            ) : null}
          </DsLayoutStack>
        )}
      </DsLayoutStack>
    </SectionCard>
  );
}

interface ShareLinkItemViewProps {
  link: ShareLinkItemViewModel;
  labels: ShareLinkSectionViewLabels;
  disabled?: boolean;
  isDeleting: boolean;
  onDelete: (id: string) => void | Promise<void>;
}

function ShareLinkItemView({ link, labels, disabled, isDeleting, onDelete }: ShareLinkItemViewProps) {
  const canUseLink = Boolean(link.openUrl) && !link.expired;
  const contextId = useId();

  return (
    <SectionCard padding="none" appearance="plain" withBorder={false} state={link.expired ? 'disabled' : 'default'}>
      <DsLayoutInline gap="xs" wrap="nowrap">
        <DsLayoutStack gap="xxs" flexible id={contextId}>
          <DsLayoutInline gap="xs">
            {link.label ? (
              <DsText size="sm" weight="medium">
                {link.label}
              </DsText>
            ) : null}
            {link.badges.map((badge, index) => (
              <LabelBadge key={`${badge.label}-${index}`} tone={badge.tone}>
                {badge.label}
              </LabelBadge>
            ))}
          </DsLayoutInline>
          <DsText size="xs" font="mono" tone="secondary" truncate>
            {link.displayUrl}
          </DsText>
        </DsLayoutStack>
        <DsLayoutInline gap="xxs" wrap="nowrap">
          <CopyButton
            size="sm"
            value={link.openUrl ?? ''}
            label={labels.copyAria}
            copiedLabel={labels.copied}
            disabled={!canUseLink}
            aria-describedby={contextId}
            data-testid={`share-link-copy-${link.id}`}
          />
          <Tooltip label={labels.openInNewTab}>
            <span style={{ display: 'inline-flex' }}>
              {canUseLink && link.openUrl ? (
                <IconButton
                  href={link.openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  emphasis="low"
                  size="sm"
                  aria-label={labels.openAria}
                  aria-describedby={contextId}
                  data-testid={`share-link-open-${link.id}`}
                >
                  <IconExternalLink size={14} />
                </IconButton>
              ) : (
                <IconButton
                  emphasis="low"
                  size="sm"
                  disabled
                  aria-label={labels.openAria}
                  aria-describedby={contextId}
                  data-testid={`share-link-open-${link.id}`}
                >
                  <IconExternalLink size={14} />
                </IconButton>
              )}
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
                aria-describedby={contextId}
                data-testid={`share-link-delete-${link.id}`}
              >
                <IconTrash size={14} />
              </IconButton>
            </span>
          </Tooltip>
        </DsLayoutInline>
      </DsLayoutInline>
    </SectionCard>
  );
}
