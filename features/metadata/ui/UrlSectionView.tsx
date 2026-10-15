'use client';

import { componentBindings } from '@/components/core/bindings';
import {
  LayoutStack as DsLayoutStack,
  LayoutGrid as DsLayoutGrid,
  LayoutInline as DsLayoutInline,
} from '@/components/core/Layout';
import { IconCheck, IconExternalLink } from '@tabler/icons-react';

import { CopyButton } from '@/components/core/CopyButton';
import { Spinner as Loader, StatusIcon } from '@/components/core/Display';
import { IconButton } from '@/components/core/IconButton';
import { TextInput, type TextInputProps } from '@/components/core/Input';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { Tooltip } from '@/components/core/Tooltip';

export interface UrlSectionViewLabels {
  title: string;
  description: string;
  id: string;
  slug: string;
  slugPlaceholder: string;
  publicUrl: string;
  copyId: string;
  copyUrl: string;
  copied: string;
  openInNewTab: string;
}

export interface UrlSectionViewProps {
  entityId: string;
  slug: string;
  publicUrlById: string;
  publicUrlBySlug: string | null;
  labels: UrlSectionViewLabels;
  idPrefix?: string;
  error?: string;
  saving?: boolean;
  isAvailable?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  inputProps?: Partial<TextInputProps>;
}

export function UrlSectionView({
  entityId,
  slug,
  publicUrlById,
  publicUrlBySlug,
  labels,
  idPrefix,
  error,
  saving,
  isAvailable,
  disabled,
  onChange,
  onBlur,
  inputProps,
}: UrlSectionViewProps) {
  return (
    <SectionCard padding={{ base: 'none', sm: 'md' }}>
      <DsLayoutStack gap="md">
        <SectionHeader title={labels.title} description={labels.description} />
        <DsLayoutGrid columns={{ base: 1, sm: 2 }}>
          <TextInput
            label={labels.id}
            textRole="code"
            id={idPrefix ? `${idPrefix}-id` : undefined}
            value={entityId}
            readOnly
            size="sm"
            rightSection={<CopyButton size="sm" value={entityId} label={labels.copyId} copiedLabel={labels.copied} />}
          />
          <TextInput
            {...componentBindings(inputProps ?? {})}
            label={labels.slug}
            textRole="code"
            id={idPrefix ? `${idPrefix}-slug` : undefined}
            placeholder={inputProps?.placeholder ?? labels.slugPlaceholder}
            value={slug}
            onChange={(event) => onChange(event.currentTarget.value)}
            onBlur={onBlur}
            size="sm"
            disabled={disabled}
            error={error}
            rightSection={
              saving ? (
                <Loader size="xs" data-testid="slug-availability-spinner" />
              ) : slug && !error && isAvailable === true ? (
                <StatusIcon icon={IconCheck} tone="positive" />
              ) : null
            }
          />
        </DsLayoutGrid>
        <DsLayoutStack gap="xxs">
          {publicUrlBySlug ? (
            <UrlRow
              url={publicUrlBySlug}
              label={labels.publicUrl}
              copyLabel={labels.copyUrl}
              copiedLabel={labels.copied}
              openLabel={labels.openInNewTab}
            />
          ) : null}
          <UrlRow
            url={publicUrlById}
            label={publicUrlBySlug ? undefined : labels.publicUrl}
            aria-label={`${labels.publicUrl} (${labels.id})`}
            copyLabel={labels.copyUrl}
            copiedLabel={labels.copied}
            openLabel={labels.openInNewTab}
          />
        </DsLayoutStack>
      </DsLayoutStack>
    </SectionCard>
  );
}

interface UrlRowProps {
  url: string;
  label?: string;
  'aria-label'?: string;
  copyLabel: string;
  copiedLabel: string;
  openLabel: string;
}

function UrlRow({ url, label, 'aria-label': ariaLabel, copyLabel, copiedLabel, openLabel }: UrlRowProps) {
  return (
    <TextInput
      label={label}
      aria-label={ariaLabel}
      value={url}
      readOnly
      size="sm"
      textRole="code"
      appearance="bare"
      rightSection={
        <DsLayoutInline gap="xxs">
          <CopyButton size="sm" value={url} label={copyLabel} copiedLabel={copiedLabel} />
          <Tooltip label={openLabel}>
            <IconButton
              emphasis="low"
              size="sm"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={openLabel}
            >
              <IconExternalLink />
            </IconButton>
          </Tooltip>
        </DsLayoutInline>
      }
    />
  );
}
