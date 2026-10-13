'use client';

import { LayoutInline as DsLayoutInline } from '@/components/core/Layout';

import { IconAlignCenter, IconAlignLeft, IconAlignRight } from '@tabler/icons-react';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { IconButton } from '@/components/core/IconButton';
import { EDITOR_TOOLBAR_ALIGNMENT_CYCLE_SHORTCUTS, EditorToolbarDropdownTarget } from './EditorToolbarTooltip';
import { EditorToolbarAction } from './EditorToolbarAction';

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
  presentation?: 'buttons' | 'menu';
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
  presentation = 'buttons',
}: BlockAlignButtonsProps) {
  if (presentation === 'menu') {
    const CurrentIcon = alignments.find((item) => item.value === value)?.Icon ?? IconAlignLeft;
    return (
      <DropdownMenu portal={false} placement="bottom-start" size="compact">
        <EditorToolbarDropdownTarget label={groupLabel} focusHint={false}>
          {(targetRef) => (
            <IconButton
              ref={targetRef}
              label={groupLabel}
              disabled={disabled}
              data-selection-toolbar-action=""
              onMouseDown={(event) => event.preventDefault()}
            >
              <CurrentIcon size={16} />
            </IconButton>
          )}
        </EditorToolbarDropdownTarget>
        <DropdownMenu.Dropdown>
          {alignments.map(({ value: alignment, Icon }) => (
            <DropdownMenu.Item
              key={alignment}
              selected={value === alignment}
              disabled={disabled}
              icon={<Icon size={16} />}
              onClick={() => onChange(alignment)}
            >
              {labels[alignment]}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Dropdown>
      </DropdownMenu>
    );
  }
  return (
    <DsLayoutInline gap="xxs" wrap="nowrap" role="group" aria-label={groupLabel}>
      {alignments.map(({ value: alignment, Icon }) => {
        const label = labels[alignment];
        return (
          <EditorToolbarAction
            key={alignment}
            label={label}
            shortcut={EDITOR_TOOLBAR_ALIGNMENT_CYCLE_SHORTCUTS}
            focusHint
            pressed={value === alignment}
            disabled={disabled}
            testId={`tiptap-toolbar-align-${alignment}`}
            data-test={`alignBlock${alignment.slice(0, 1).toUpperCase()}${alignment.slice(1)}`}
            onClick={() => onChange(alignment)}
          >
            <Icon size={16} />
          </EditorToolbarAction>
        );
      })}
    </DsLayoutInline>
  );
}
