'use client';

import { IconTrash } from '@tabler/icons-react';
import { Group } from '@mantine/core';
import { IconButton } from '@/components/core/IconButton';
import { Select, TextInput } from '@/components/core/Input';
import { SocialIcon, type SocialPlatform } from '@/components/core/Social';

export interface SocialPlatformOption {
  value: SocialPlatform;
  label: string;
}

export interface SocialLinkInputViewLabels {
  platformPlaceholder: string;
  valuePlaceholder: string;
  remove: string;
}

export interface SocialLinkInputViewProps {
  platform: string;
  value: string;
  platformOptions: SocialPlatformOption[];
  selectedPlatform: SocialPlatform | null;
  selectedValuePlaceholder: string | null;
  labels: SocialLinkInputViewLabels;
  platformId?: string;
  valueId?: string;
  removeButtonId?: string;
  onPlatformChange: (platform: string) => void;
  onValueChange: (value: string) => void;
  onValueBlur: () => void;
  onRemove?: () => void;
  showRemove?: boolean;
  disabled?: boolean;
  error?: string;
  platformWidth?: number;
}

export function SocialLinkInputView({
  platform,
  value,
  platformOptions,
  selectedPlatform,
  selectedValuePlaceholder,
  labels,
  platformId,
  valueId,
  removeButtonId,
  onPlatformChange,
  onValueChange,
  onValueBlur,
  onRemove,
  showRemove = true,
  disabled = false,
  error,
  platformWidth = 160,
}: SocialLinkInputViewProps) {
  return (
    <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
      <Select
        id={platformId}
        placeholder={labels.platformPlaceholder}
        data={platformOptions}
        value={platform || null}
        onChange={(nextPlatform) => onPlatformChange(nextPlatform || '')}
        style={{ width: platformWidth }}
        searchable
        disabled={disabled}
        leftSection={selectedPlatform ? <SocialIcon platform={selectedPlatform} size={16} /> : undefined}
        leftSectionPointerEvents="none"
      />
      <TextInput
        id={valueId}
        placeholder={selectedValuePlaceholder ?? labels.valuePlaceholder}
        value={value}
        onChange={(event) => onValueChange(event.currentTarget.value)}
        onBlur={onValueBlur}
        style={{ flex: 1 }}
        disabled={disabled}
        error={error}
      />
      {showRemove && onRemove ? (
        <IconButton
          id={removeButtonId}
          tone="danger"
          emphasis="low"
          aria-label={labels.remove}
          onClick={onRemove}
          disabled={disabled}
        >
          <IconTrash size={16} />
        </IconButton>
      ) : null}
    </Group>
  );
}
