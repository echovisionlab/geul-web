'use client';

import { Group } from '@mantine/core';
import { IconAlignCenter, IconAlignLeft, IconAlignRight } from '@tabler/icons-react';
import { IconButton } from '@/components/core/IconButton';
import { EDITOR_TOOLBAR_ALIGNMENT_CYCLE_SHORTCUTS, EditorToolbarTooltip } from './EditorToolbarTooltip';

export type BlockAlignment = 'left' | 'center' | 'right';

export interface BlockAlignmentLabels {
  left: string;
  center: string;
  right: string;
}

export interface BlockAlignButtonsProps {
  /** Current selection state, resolved by the editor integration. */
  value: BlockAlignment | null;
  labels: BlockAlignmentLabels;
  /** Command port. It owns the editor selection and mutation. */
  onChange: (alignment: BlockAlignment) => void;
  /** Localized label for the one alignment action group. Defaults for standalone compatibility. */
  groupLabel?: string;
  disabled?: boolean;
}

const alignments = [
  { value: 'left', Icon: IconAlignLeft },
  { value: 'center', Icon: IconAlignCenter },
  { value: 'right', Icon: IconAlignRight },
] as const;

/**
 * Engine-neutral alignment controls. The editor integration supplies selection state
 * and the command instead of this view reaching into a particular editor runtime.
 */
export function BlockAlignButtons({
  value,
  labels,
  onChange,
  groupLabel = labels.left,
  disabled = false,
}: BlockAlignButtonsProps) {
  return (
    <Group gap={2} wrap="nowrap" role="group" aria-label={groupLabel}>
      {alignments.map(({ value: alignment, Icon }) => {
        const label = labels[alignment];
        return (
          <EditorToolbarTooltip key={alignment} label={label} shortcut={EDITOR_TOOLBAR_ALIGNMENT_CYCLE_SHORTCUTS}>
            <IconButton
              label={label}
              tone={value === alignment ? 'accent' : 'neutral'}
              emphasis={value === alignment ? 'medium' : 'low'}
              size="sm"
              data-selection-toolbar-action=""
              data-testid={`tiptap-toolbar-align-${alignment}`}
              data-test={`alignBlock${alignment.slice(0, 1).toUpperCase()}${alignment.slice(1)}`}
              aria-pressed={value === alignment}
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onChange(alignment)}
            >
              <Icon size={16} />
            </IconButton>
          </EditorToolbarTooltip>
        );
      })}
    </Group>
  );
}
