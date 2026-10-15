'use client';

import { LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { IconLayoutGrid, IconList } from '@tabler/icons-react';
import { SegmentedControl } from '@/components/core/Input';
import { FileBrowserViewSettingsControl } from './FileBrowserViewSettings';
import type { FileBrowserViewOptions } from './file-browser-view-settings';

export interface FileBrowserViewToggleProps {
  value: 'grid' | 'list';
  viewOptions?: FileBrowserViewOptions;
  /** Accessible name of the exclusive view choice. */
  label: string;
  gridLabel: string;
  listLabel: string;
  onChange: (value: 'grid' | 'list') => void;
}

/** Pure File Browser view-mode choice shared by the manager and editor picker; Core SegmentedControl owns it. */
export function FileBrowserViewToggle({
  value,
  label,
  gridLabel,
  listLabel,
  onChange,
  viewOptions,
}: FileBrowserViewToggleProps) {
  return (
    <DsLayoutInline gap="xxs" wrap="nowrap" data-file-browser-view-toggle>
      <SegmentedControl
        aria-label={label}
        size="xs"
        value={value}
        onChange={(next) => onChange(next === 'list' ? 'list' : 'grid')}
        data={[
          { value: 'grid', icon: <IconLayoutGrid aria-hidden />, accessibleLabel: gridLabel },
          { value: 'list', icon: <IconList aria-hidden />, accessibleLabel: listLabel },
        ]}
      />
      {viewOptions ? (
        <FileBrowserViewSettingsControl
          options={{ ...viewOptions, value: { ...viewOptions.value, viewMode: value } }}
          grid={value === 'grid'}
        />
      ) : null}
    </DsLayoutInline>
  );
}
