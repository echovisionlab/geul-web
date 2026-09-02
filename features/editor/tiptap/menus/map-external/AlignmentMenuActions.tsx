'use client';

import { Group } from '@mantine/core';
import { IconAlignCenter, IconAlignLeft, IconAlignRight } from '@tabler/icons-react';
import { EDITOR_TOOLBAR_ALIGNMENT_CYCLE_SHORTCUTS } from '@/features/editor/toolbars/EditorToolbarTooltip';
import { SelectionMenuAction } from './SelectionMenuPrimitives';

export type ContextualBlockAlignment = 'left' | 'center' | 'right';

export interface ContextualBlockAlignmentLabels {
  alignment: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
}

export interface AlignmentMenuActionsProps {
  value: ContextualBlockAlignment;
  labels: ContextualBlockAlignmentLabels;
  onChange?: (alignment: ContextualBlockAlignment) => void;
  disabled?: boolean;
  testIdPrefix: string;
}

const alignments = [
  { value: 'left', Icon: IconAlignLeft, labelKey: 'alignLeft' },
  { value: 'center', Icon: IconAlignCenter, labelKey: 'alignCenter' },
  { value: 'right', Icon: IconAlignRight, labelKey: 'alignRight' },
] as const;

export function AlignmentMenuActions({
  value,
  labels,
  onChange,
  disabled = false,
  testIdPrefix,
}: AlignmentMenuActionsProps) {
  return (
    <Group gap={2} wrap="nowrap" role="group" aria-label={labels.alignment}>
      {alignments.map(({ value: alignment, Icon, labelKey }) => (
        <SelectionMenuAction
          key={alignment}
          label={labels[labelKey]}
          shortcut={EDITOR_TOOLBAR_ALIGNMENT_CYCLE_SHORTCUTS}
          pressed={value === alignment}
          disabled={disabled}
          onClick={onChange ? () => onChange(alignment) : undefined}
          testId={`${testIdPrefix}-${alignment}`}
        >
          <Icon size={16} aria-hidden />
        </SelectionMenuAction>
      ))}
    </Group>
  );
}
