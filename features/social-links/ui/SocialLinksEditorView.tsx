'use client';

import { useState } from 'react';
import { IconGripVertical, IconPlus } from '@tabler/icons-react';
import { Group, Stack, Text } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import type { SocialPlatform } from '@/components/core/Social';
import { Tooltip } from '@/components/core/Tooltip';
import { SocialLinkInputView, type SocialLinkInputViewLabels, type SocialPlatformOption } from './SocialLinkInputView';
import classes from './SocialLinksEditor.module.css';

export interface SocialLinkEditorItemViewModel {
  key: string;
  platform: string;
  value: string;
  selectedPlatform: SocialPlatform | null;
  selectedValuePlaceholder: string | null;
}

export interface SocialLinksEditorViewLabels extends SocialLinkInputViewLabels {
  fieldLabel: string;
  addLink: string;
  reorderLink: string;
}

export interface SocialLinksEditorViewProps {
  items: SocialLinkEditorItemViewModel[];
  platformOptions: SocialPlatformOption[];
  labels: SocialLinksEditorViewLabels;
  canAddMore: boolean;
  onAddLink: () => void;
  onRemoveLink: (index: number) => void;
  onPlatformChange: (index: number, platform: string) => void;
  onValueChange: (index: number, value: string) => void;
  onValueBlur: (index: number) => void;
  onMoveLink: (fromIndex: number, toIndex: number) => void;
  idPrefix?: string;
  disabled?: boolean;
  label?: string;
  addButtonMode?: 'button' | 'icon';
}

export function SocialLinksEditorView({
  items,
  platformOptions,
  labels,
  canAddMore,
  onAddLink,
  onRemoveLink,
  onPlatformChange,
  onValueChange,
  onValueBlur,
  onMoveLink,
  idPrefix,
  disabled = false,
  label,
  addButtonMode = 'button',
}: SocialLinksEditorViewProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="sm" fw={500}>
          {label ?? labels.fieldLabel}
        </Text>
        {addButtonMode === 'icon' ? (
          <Tooltip label={labels.addLink}>
            <IconButton
              id={idPrefix ? `${idPrefix}-add` : undefined}
              size="sm"
              onClick={onAddLink}
              disabled={disabled || !canAddMore}
              aria-label={labels.addLink}
            >
              <IconPlus size={16} />
            </IconButton>
          </Tooltip>
        ) : (
          <Button
            id={idPrefix ? `${idPrefix}-add` : undefined}
            size="xs"
            emphasis="medium"
            leftSection={<IconPlus size={14} />}
            onClick={onAddLink}
            disabled={disabled || !canAddMore}
          >
            {labels.addLink}
          </Button>
        )}
      </Group>
      {items.map((link, index) => (
        <Group
          key={link.key || index}
          gap="xs"
          wrap="nowrap"
          className={classes.row}
          data-dragging={draggedIndex === index || undefined}
          onDragOver={(event) => {
            event.preventDefault();
            if (draggedIndex !== null && draggedIndex !== index) {
              onMoveLink(draggedIndex, index);
              setDraggedIndex(index);
            }
          }}
        >
          <div
            className={classes.dragHandle}
            draggable={!disabled}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={labels.reorderLink}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              setDraggedIndex(index);
            }}
            onDragEnd={() => setDraggedIndex(null)}
          >
            <IconGripVertical size={16} />
          </div>
          <SocialLinkInputView
            platformId={idPrefix ? `${idPrefix}-platform-${index}` : undefined}
            valueId={idPrefix ? `${idPrefix}-value-${index}` : undefined}
            removeButtonId={idPrefix ? `${idPrefix}-remove-${index}` : undefined}
            platform={link.platform}
            value={link.value}
            platformOptions={platformOptions}
            selectedPlatform={link.selectedPlatform}
            selectedValuePlaceholder={link.selectedValuePlaceholder}
            labels={labels}
            onPlatformChange={(platform) => onPlatformChange(index, platform)}
            onValueChange={(value) => onValueChange(index, value)}
            onValueBlur={() => onValueBlur(index)}
            onRemove={() => onRemoveLink(index)}
            disabled={disabled}
          />
        </Group>
      ))}
    </Stack>
  );
}
