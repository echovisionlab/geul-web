'use client';

import type { ChangeEvent } from 'react';
import { IconFolder, IconFolderPlus, IconTrash, IconUpload } from '@tabler/icons-react';
import { Box, Group, Text } from '@mantine/core';
import { IconButton } from '@/components/core/IconButton';
import { TextInput } from '@/components/core/Input';
import { TextButton } from '@/components/core/TextButton';
import classes from './FileBrowserHeader.module.css';
import { FileBrowserTooltip } from './FileBrowserTooltip';
import { FileBrowserSortFilterControls } from './FileBrowserSortFilterControls';
import { FileBrowserViewToggle } from './FileBrowserViewToggle';

export interface FileBrowserHeaderPathItem {
  id?: string;
  name: string;
}

export interface FileBrowserHeaderLabels {
  description: string;
  root: string;
  search: string;
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
  actions: string;
  move: string;
  delete: string;
  gridView: string;
  listView: string;
  newFolder: string;
  upload: string;
}

export interface FileBrowserHeaderProps {
  labels: FileBrowserHeaderLabels;
  path: FileBrowserHeaderPathItem[];
  query: string;
  mimeTypePrefix: string;
  sort: string;
  viewMode: 'grid' | 'list';
  searching?: boolean;
  canManage: boolean;
  batchActionsDisabled: boolean;
  mutationLoading?: boolean;
  onOpenPath: (index: number) => void;
  onQueryChange: (value: string) => void;
  onMimeTypePrefixChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onMoveSelectedFiles: () => void;
  onDeleteSelectedFiles: () => void;
  onCreateFolder: () => void;
  onUploadRequested: () => void;
}

export function FileBrowserHeader({
  labels,
  path,
  query,
  mimeTypePrefix,
  sort,
  viewMode,
  searching,
  canManage,
  batchActionsDisabled,
  mutationLoading,
  onOpenPath,
  onQueryChange,
  onMimeTypePrefixChange,
  onSortChange,
  onViewModeChange,
  onMoveSelectedFiles,
  onDeleteSelectedFiles,
  onCreateFolder,
  onUploadRequested,
}: FileBrowserHeaderProps) {
  const currentPathIndex = Math.max(path.length - 1, 0);
  const managementDisabled = !canManage || batchActionsDisabled || mutationLoading;

  return (
    <Box className={classes.header} data-file-browser-header>
      <Box className={classes.location} aria-label={labels.root}>
        <Text className={classes.description}>{labels.description}</Text>
        <Group gap={4} wrap="nowrap" className={classes.path}>
          {path.map((item, index) => (
            <Group key={`${item.id ?? 'root'}-${index}`} gap={4} wrap="nowrap" miw={0}>
              {index > 0 ? (
                <Text className={classes.separator} aria-hidden>
                  /
                </Text>
              ) : null}
              {index < currentPathIndex ? (
                <TextButton appearance="default" className={classes.pathButton} onClick={() => onOpenPath(index)}>
                  {item.name}
                </TextButton>
              ) : (
                <Text className={classes.currentPath} title={item.name}>
                  {item.name}
                </Text>
              )}
            </Group>
          ))}
        </Group>
      </Box>

      <TextInput
        className={classes.search}
        aria-label={labels.search}
        placeholder={labels.search}
        value={query}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.currentTarget.value)}
      />

      <FileBrowserSortFilterControls
        className={classes.filters}
        labels={labels}
        mimeTypePrefix={mimeTypePrefix}
        sort={sort}
        onMimeTypePrefixChange={onMimeTypePrefixChange}
        onSortChange={onSortChange}
      />

      <Group gap={4} wrap="nowrap" className={classes.actions} aria-label={labels.actions}>
        <Group gap={2} wrap="nowrap" className={classes.actionGroup}>
          <FileBrowserTooltip label={labels.newFolder}>
            <IconButton
              label={labels.newFolder}
              tone="neutral"
              emphasis="low"
              onClick={onCreateFolder}
              disabled={!canManage || mutationLoading}
            >
              <IconFolderPlus size={18} />
            </IconButton>
          </FileBrowserTooltip>
          <FileBrowserTooltip label={labels.upload}>
            <IconButton label={labels.upload} tone="accent" emphasis="low" onClick={onUploadRequested}>
              <IconUpload size={18} />
            </IconButton>
          </FileBrowserTooltip>
        </Group>
        <Box className={classes.actionSeparator} aria-hidden />
        <Group gap={2} wrap="nowrap" className={classes.actionGroup}>
          <FileBrowserTooltip label={labels.move}>
            <IconButton
              label={labels.move}
              tone="accent"
              emphasis="low"
              disabled={managementDisabled}
              onClick={onMoveSelectedFiles}
            >
              <IconFolder size={18} />
            </IconButton>
          </FileBrowserTooltip>
          <FileBrowserTooltip label={labels.delete}>
            <IconButton
              label={labels.delete}
              emphasis="low"
              tone="danger"
              disabled={managementDisabled}
              onClick={onDeleteSelectedFiles}
            >
              <IconTrash size={18} />
            </IconButton>
          </FileBrowserTooltip>
        </Group>
        {!searching ? (
          <>
            <Box className={classes.actionSeparator} aria-hidden />
            <FileBrowserViewToggle
              value={viewMode}
              gridLabel={labels.gridView}
              listLabel={labels.listView}
              onChange={onViewModeChange}
            />
          </>
        ) : null}
      </Group>
    </Box>
  );
}
