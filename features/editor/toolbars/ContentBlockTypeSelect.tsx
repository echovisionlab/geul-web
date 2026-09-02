'use client';

import type { ReactNode } from 'react';
import { IconTypography } from '@tabler/icons-react';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { IconButton } from '@/components/core/IconButton';
import { EditorToolbarDropdownTarget } from './EditorToolbarTooltip';

export interface ContentBlockTypeOption {
  value: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface ContentBlockTypeSelectProps {
  label: string;
  value: string;
  options: readonly ContentBlockTypeOption[];
  /** Command port. The editor integration applies the chosen node type. */
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * A presentational block-type menu. It deliberately has no editor dependency so it
 * can be hosted by a contextual BubbleMenu or another editor surface.
 */
export function ContentBlockTypeSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: ContentBlockTypeSelectProps) {
  return (
    <DropdownMenu portal={false} placement="bottom-start">
      <EditorToolbarDropdownTarget label={label}>
        {(targetRef) => (
          <IconButton
            ref={targetRef}
            label={label}
            tone="neutral"
            emphasis="low"
            size="sm"
            data-selection-toolbar-action=""
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
          >
            <IconTypography size={16} />
          </IconButton>
        )}
      </EditorToolbarDropdownTarget>
      <DropdownMenu.Dropdown>
        {options.map((option) => (
          <DropdownMenu.Item
            key={option.value}
            icon={option.icon}
            selected={option.value === value}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Dropdown>
    </DropdownMenu>
  );
}
