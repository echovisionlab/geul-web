'use client';

import { LayoutGrid } from '@/components/core/Layout';
import { Select } from '@/components/core/Input';

export interface FileBrowserSortFilterLabels {
  type: string;
  allTypes: string;
  images: string;
  audio: string;
  video: string;
  documents: string;
  sortLabel: string;
  sortName: string;
  sortNewest: string;
  sortOldest: string;
  sortSize: string;
  sortSmallest: string;
}

export interface FileBrowserSortFilterControlsProps {
  labels: FileBrowserSortFilterLabels;
  mimeTypePrefix: string;
  sort: string;
  onMimeTypePrefixChange: (value: string) => void;
  onSortChange: (value: string) => void;
}

/** Pure File Browser controls shared by the manager and editor library picker. */
export function FileBrowserSortFilterControls({
  labels,
  mimeTypePrefix,
  sort,
  onMimeTypePrefixChange,
  onSortChange,
}: FileBrowserSortFilterControlsProps) {
  return (
    <LayoutGrid columns={2} gap="xs">
      <Select
        aria-label={labels.sortLabel}
        value={sort}
        onChange={(value) => onSortChange(value ?? 'name:asc')}
        data={[
          { value: 'name:asc', label: `${labels.sortName} ↑` },
          { value: 'name:desc', label: `${labels.sortName} ↓` },
          { value: 'created:desc', label: labels.sortNewest },
          { value: 'created:asc', label: labels.sortOldest },
          { value: 'size:desc', label: labels.sortSize },
          { value: 'size:asc', label: labels.sortSmallest },
        ]}
      />
      <Select
        aria-label={labels.type}
        value={mimeTypePrefix}
        onChange={(value) => onMimeTypePrefixChange(value ?? '')}
        data={[
          { value: '', label: labels.allTypes },
          { value: 'image/', label: labels.images },
          { value: 'audio/', label: labels.audio },
          { value: 'video/', label: labels.video },
          { value: 'application/', label: labels.documents },
        ]}
      />
    </LayoutGrid>
  );
}
