'use client';

import { IconLayoutGrid, IconList } from '@tabler/icons-react';
import { Group } from '@mantine/core';
import { IconButton } from '@/components/core/IconButton';
import { FileBrowserTooltip } from './FileBrowserTooltip';

export interface FileBrowserViewToggleProps {
  value: 'grid' | 'list';
  gridLabel: string;
  listLabel: string;
  onChange: (value: 'grid' | 'list') => void;
}

/** Pure File Browser view-mode control shared by the manager and editor picker. */
export function FileBrowserViewToggle({ value, gridLabel, listLabel, onChange }: FileBrowserViewToggleProps) {
  return (
    <Group gap={2} wrap="nowrap" data-file-browser-view-toggle>
      <FileBrowserTooltip label={gridLabel}>
        <IconButton
          label={gridLabel}
          tone={value === 'grid' ? 'accent' : 'neutral'}
          emphasis="low"
          aria-pressed={value === 'grid'}
          onClick={() => onChange('grid')}
        >
          <IconLayoutGrid size={18} />
        </IconButton>
      </FileBrowserTooltip>
      <FileBrowserTooltip label={listLabel}>
        <IconButton
          label={listLabel}
          tone={value === 'list' ? 'accent' : 'neutral'}
          emphasis="low"
          aria-pressed={value === 'list'}
          onClick={() => onChange('list')}
        >
          <IconList size={18} />
        </IconButton>
      </FileBrowserTooltip>
    </Group>
  );
}
