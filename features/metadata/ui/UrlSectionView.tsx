'use client';

import { IconCheck, IconCopy, IconExternalLink } from '@tabler/icons-react';
import { Group, Loader, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconButton } from '@/components/core/IconButton';
import { TextInput, type TextInputProps } from '@/components/core/Input';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { Tooltip } from '@/components/core/Tooltip';
import styles from './UrlSectionView.module.css';

export interface UrlSectionViewLabels {
  title: string;
  description: string;
  id: string;
  slug: string;
  slugPlaceholder: string;
  publicUrl: string;
  copyId: string;
  copyUrl: string;
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
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onCopyId: () => void;
  onCopyUrl: (url: string) => void;
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
  disabled,
  onChange,
  onBlur,
  onCopyId,
  onCopyUrl,
  inputProps,
}: UrlSectionViewProps) {
  return (
    <SectionCard>
      <Stack gap="md">
        <SectionHeader title={labels.title} description={labels.description} />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              {labels.id}
            </Text>
            <TextInput
              id={idPrefix ? `${idPrefix}-id` : undefined}
              value={entityId}
              readOnly
              size="sm"
              classNames={{ input: styles.monospaceInput }}
              rightSection={
                <IconButton emphasis="low" size="sm" onClick={onCopyId} aria-label={labels.copyId}>
                  <IconCopy size={14} />
                </IconButton>
              }
            />
          </Stack>
          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              {labels.slug}
            </Text>
            <TextInput
              id={idPrefix ? `${idPrefix}-slug` : undefined}
              placeholder={labels.slugPlaceholder}
              value={slug}
              onChange={(event) => onChange(event.currentTarget.value)}
              onBlur={onBlur}
              size="sm"
              disabled={disabled}
              error={error}
              rightSection={
                saving ? (
                  <Loader size={14} />
                ) : slug && !error ? (
                  <IconCheck size={16} color="var(--mantine-color-green-6)" />
                ) : null
              }
              {...inputProps}
            />
          </Stack>
        </SimpleGrid>
        <Stack gap={4}>
          <Text size="xs" c="dimmed">
            {labels.publicUrl}
          </Text>
          <Stack gap="xs">
            {publicUrlBySlug ? (
              <UrlRow
                url={publicUrlBySlug}
                copyLabel={labels.copyUrl}
                openLabel={labels.openInNewTab}
                onCopy={onCopyUrl}
              />
            ) : null}
            <UrlRow
              url={publicUrlById}
              muted
              copyLabel={labels.copyUrl}
              openLabel={labels.openInNewTab}
              onCopy={onCopyUrl}
            />
          </Stack>
        </Stack>
      </Stack>
    </SectionCard>
  );
}

interface UrlRowProps {
  url: string;
  muted?: boolean;
  copyLabel: string;
  openLabel: string;
  onCopy: (url: string) => void;
}

function UrlRow({ url, muted, copyLabel, openLabel, onCopy }: UrlRowProps) {
  return (
    <Group gap="xs">
      <Text size="sm" ff="monospace" c={muted ? 'dimmed' : undefined} style={{ flex: 1 }} truncate>
        {url}
      </Text>
      <Tooltip label={copyLabel}>
        <IconButton emphasis="low" size="sm" onClick={() => onCopy(url)} aria-label={copyLabel}>
          <IconCopy size={14} />
        </IconButton>
      </Tooltip>
      <Tooltip label={openLabel}>
        <IconButton
          emphasis="low"
          size="sm"
          component="a"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={openLabel}
        >
          <IconExternalLink size={14} />
        </IconButton>
      </Tooltip>
    </Group>
  );
}
