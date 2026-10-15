'use client';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useState } from 'react';
import { IconGripVertical, IconPlus } from '@tabler/icons-react';

import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import type { SocialPlatform } from '@/components/core/Social';
import { Tooltip } from '@/components/core/Tooltip';
import { SocialLinkInputView, type SocialLinkInputViewLabels, type SocialPlatformOption } from './SocialLinkInputView';
import { SectionCard } from '@/components/core/Section';
import { ReorderRow } from '@/components/core/Sortable';

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
    <DsLayoutStack gap="xxs">
      <DsLayoutInline justify="between">
        <DsText size="sm" weight="medium">
          {label ?? labels.fieldLabel}
        </DsText>
        {addButtonMode === 'icon' ? (
          <Tooltip label={labels.addLink}>
            <IconButton
              id={idPrefix ? `${idPrefix}-add` : undefined}
              size="compact"
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
      </DsLayoutInline>
      {items.map((link, index) => (
        <SectionCard
          key={link.key || index}
          padding="none"
          border="none"
          appearance="plain"
          state={draggedIndex === index ? 'dragging' : 'default'}
        >
          <ReorderRow
            data-dragging={draggedIndex === index || undefined}
            onDragOver={(event) => {
              event.preventDefault();
              if (draggedIndex !== null && draggedIndex !== index) {
                onMoveLink(draggedIndex, index);
                setDraggedIndex(index);
              }
            }}

            handle={
              <IconButton
                interaction="drag-handle"
                disabled={disabled}
                draggable={!disabled}
                aria-label={labels.reorderLink}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  setDraggedIndex(index);
                }}
                onDragEnd={() => setDraggedIndex(null)}
                onKeyDown={(event) => {
                  const next = event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1 : index;
                  if (!disabled && next !== index && next >= 0 && next < items.length) {
                    event.preventDefault();
                    onMoveLink(index, next);
                  }
                }}
              >
                <IconGripVertical aria-hidden />
              </IconButton>
            }
          >
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
          </ReorderRow>
        </SectionCard>
      ))}
    </DsLayoutStack>
  );
}
