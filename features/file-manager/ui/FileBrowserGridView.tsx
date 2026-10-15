'use client';

import { type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { IconFolder } from '@tabler/icons-react';
import { FileTypeIcon } from '@/components/core/Display/FileTypeIcon';
import {
  SelectionGrid,
  SelectionSurface,
  SelectionThumbnail,
  type SelectionGridColumns,
  type SelectionIconSize,
  type SelectionGridSpacing,
} from '@/components/core/SelectionSurface';

interface FileBrowserGridItemBase {
  id: string;
  kind: 'folder' | 'file';
  name: string;
  mimeType?: string;
  thumbnailUrl?: string;
  inlineUrl?: string;
}
export type FileBrowserGridItemView = FileBrowserGridItemBase &
  (
    | { disabled?: boolean; selectionUnavailable?: false; selectionUnavailableDescription?: never }
    | { disabled?: never; selectionUnavailable: true; selectionUnavailableDescription: string }
  );

export interface FileBrowserGridViewProps {
  label: string;
  items: readonly FileBrowserGridItemView[];
  selectedItemIds: readonly string[];
  density?: 'compact' | 'workspace';
  multiSelect?: boolean;
  columns?: SelectionGridColumns;
  iconSize?: SelectionIconSize;
  spacing?: SelectionGridSpacing;
  renderActions?: (item: FileBrowserGridItemView) => ReactNode;
  onItemClick: (event: MouseEvent<HTMLElement>, item: FileBrowserGridItemView, index: number) => void;
  onItemDoubleClick: (event: MouseEvent<HTMLElement>, item: FileBrowserGridItemView, index: number) => void;
  onItemContextMenu: (event: MouseEvent<HTMLElement>, item: FileBrowserGridItemView, index: number) => void;
  onItemKeyDown: (event: KeyboardEvent<HTMLElement>, item: FileBrowserGridItemView, index: number) => void;
}

function ItemThumbnail({ item, density }: { item: FileBrowserGridItemView; density: 'compact' | 'workspace' }) {
  const imageSource = item.thumbnailUrl ?? (item.mimeType?.startsWith('image/') ? item.inlineUrl : undefined);
  return (
    <SelectionThumbnail
      src={imageSource}
      fit="contain"
      size={density}
      tone={item.kind === 'folder' ? 'neutral' : 'muted'}
      icon={
        item.kind === 'folder' ? (
          <IconFolder aria-hidden />
        ) : (
          <FileTypeIcon file={{ mimeType: item.mimeType ?? '' }} size="inline" />
        )
      }
    />
  );
}

/** Pure File Browser grid surface. Selection policy and activation remain in its owning controller. */
export function FileBrowserGridView({
  label,
  items,
  selectedItemIds,
  density = 'compact',
  multiSelect = true,
  columns,
  iconSize = 'medium',
  spacing = 'standard',
  renderActions,
  onItemClick,
  onItemDoubleClick,
  onItemContextMenu,
  onItemKeyDown,
}: FileBrowserGridViewProps) {
  return (
    <SelectionGrid
      label={label}
      density={density}
      multiSelect={multiSelect}
      columns={columns}
      iconSize={iconSize}
      spacing={spacing}
      selectionStyle="grid"
      data-file-viewer-grid
    >
      {items.map((item, index) => (
        <SelectionSurface
          key={item.id}
          label={item.name}
          appearance="file"
          selectionStyle="grid"
          iconSize={iconSize}
          density={density}
          {...(item.selectionUnavailable
            ? {
                selected: false,
                selectionUnavailable: true,
                selectionUnavailableDescription: item.selectionUnavailableDescription,
              }
            : { selected: selectedItemIds.includes(item.id), unavailable: item.disabled })}
          tabIndex={
            index ===
            Math.max(
              0,
              items.findIndex((candidate) => selectedItemIds.includes(candidate.id)),
            )
              ? 0
              : -1
          }
          data-file-viewer-item={item.id}
          data-kind={item.kind}
          preview={<ItemThumbnail item={item} density={density} />}
          actions={renderActions?.(item)}
          onClick={(event) => onItemClick(event, item, index)}
          onDoubleClick={(event) => onItemDoubleClick(event, item, index)}
          onContextMenu={(event) => onItemContextMenu(event, item, index)}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) {
              return;
            }
            onItemKeyDown(event, item, index);
            if (event.defaultPrevented) {
              return;
            }
            const options = Array.from(
              event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="row"]') ?? [],
            );
            const current = options.indexOf(event.currentTarget);
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? options.length - 1
                  : ['ArrowRight', 'ArrowDown'].includes(event.key)
                    ? Math.min(options.length - 1, current + 1)
                    : ['ArrowLeft', 'ArrowUp'].includes(event.key)
                      ? Math.max(0, current - 1)
                      : -1;
            if (next >= 0) {
              event.preventDefault();
              options[next]?.focus();
            }
          }}
        />
      ))}
    </SelectionGrid>
  );
}
