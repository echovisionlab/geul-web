'use client';

import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import {
  IconCheck,
  IconFile,
  IconFileMusic,
  IconFileText,
  IconFileTypePdf,
  IconFolder,
  IconPhoto,
  IconVideo,
} from '@tabler/icons-react';
import { Box, Center, Image, Paper, Text } from '@mantine/core';
import classes from './FileBrowserGridView.module.css';

export interface FileBrowserGridItemView {
  id: string;
  kind: 'folder' | 'file';
  name: string;
  mimeType?: string;
  thumbnailUrl?: string;
  inlineUrl?: string;
  disabled?: boolean;
}

export interface FileBrowserGridViewProps {
  items: readonly FileBrowserGridItemView[];
  selectedItemIds: readonly string[];
  density?: 'compact' | 'workspace';
  multiSelect?: boolean;
  renderActions?: (item: FileBrowserGridItemView) => ReactNode;
  onItemClick: (event: MouseEvent<HTMLElement>, item: FileBrowserGridItemView, index: number) => void;
  onItemDoubleClick: (event: MouseEvent<HTMLElement>, item: FileBrowserGridItemView, index: number) => void;
  onItemContextMenu: (event: MouseEvent<HTMLElement>, item: FileBrowserGridItemView, index: number) => void;
  onItemKeyDown: (event: KeyboardEvent<HTMLElement>, item: FileBrowserGridItemView, index: number) => void;
}

function FileBrowserTypeIcon({ item, size }: { item: FileBrowserGridItemView; size: number }) {
  if (item.kind === 'folder') {
    return <IconFolder size={size} stroke={1.15} aria-hidden />;
  }
  if (item.mimeType?.startsWith('image/')) {
    return <IconPhoto size={size} stroke={1.25} aria-hidden />;
  }
  if (item.mimeType?.startsWith('audio/')) {
    return <IconFileMusic size={size} stroke={1.25} aria-hidden />;
  }
  if (item.mimeType?.startsWith('video/')) {
    return <IconVideo size={size} stroke={1.25} aria-hidden />;
  }
  if (item.mimeType === 'application/pdf') {
    return <IconFileTypePdf size={size} stroke={1.25} aria-hidden />;
  }
  if (item.mimeType?.startsWith('text/') || item.mimeType?.includes('document')) {
    return <IconFileText size={size} stroke={1.25} aria-hidden />;
  }
  return <IconFile size={size} stroke={1.25} aria-hidden />;
}

function ItemThumbnail({ item, density }: { item: FileBrowserGridItemView; density: 'compact' | 'workspace' }) {
  const imageSource = item.thumbnailUrl ?? (item.mimeType?.startsWith('image/') ? item.inlineUrl : undefined);
  const iconSize = density === 'workspace' ? 36 : 28;

  return imageSource ? (
    <Image className={classes.thumbnailImage} src={imageSource} alt="" fit="cover" h="100%" w="100%" />
  ) : (
    <Center className={item.kind === 'folder' ? classes.folderPreview : classes.filePreview}>
      <FileBrowserTypeIcon item={item} size={iconSize} />
    </Center>
  );
}

/** Pure File Browser grid surface. Selection policy and activation remain in its owning controller. */
export function FileBrowserGridView({
  items,
  selectedItemIds,
  density = 'compact',
  multiSelect = true,
  renderActions,
  onItemClick,
  onItemDoubleClick,
  onItemContextMenu,
  onItemKeyDown,
}: FileBrowserGridViewProps) {
  return (
    <Box
      className={classes.grid}
      data-file-viewer-grid
      data-density={density}
      role="listbox"
      aria-multiselectable={multiSelect}
    >
      {items.map((item, index) => {
        const selected = selectedItemIds.includes(item.id);
        return (
          <Paper
            key={item.id}
            withBorder={false}
            radius={0}
            className={classes.item}
            data-file-viewer-item={item.id}
            data-kind={item.kind}
            data-selected={selected || undefined}
            data-disabled={item.disabled || undefined}
            data-density={density}
            role="option"
            aria-selected={selected}
            aria-disabled={item.disabled || undefined}
            tabIndex={0}
            onClick={(event) => onItemClick(event, item, index)}
            onDoubleClick={(event) => onItemDoubleClick(event, item, index)}
            onContextMenu={(event) => onItemContextMenu(event, item, index)}
            onKeyDown={(event) => onItemKeyDown(event, item, index)}
          >
            <Box className={classes.previewShell}>
              <ItemThumbnail item={item} density={density} />
              {selected ? (
                <Center className={classes.selectionMark} aria-hidden>
                  <IconCheck size={14} stroke={3} />
                </Center>
              ) : null}
              {renderActions ? <Box className={classes.actionControl}>{renderActions(item)}</Box> : null}
            </Box>
            <Text
              className={classes.name}
              fw={500}
              size={density === 'workspace' ? 'sm' : 'xs'}
              lineClamp={2}
              title={item.name}
            >
              {item.name}
            </Text>
          </Paper>
        );
      })}
    </Box>
  );
}
