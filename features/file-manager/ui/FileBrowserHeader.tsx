'use client';
import type { FileBrowserViewOptions } from './file-browser-view-settings';

import type { ChangeEvent } from 'react';
import { IconFolder, IconFolderPlus, IconTrash, IconUpload } from '@tabler/icons-react';
import { LayoutInline, LayoutInset } from '@/components/core/Layout';
import { SelectionToolbar, SelectionPath } from '@/components/core/SelectionSurface';
import { IconButton } from '@/components/core/IconButton';
import { TextInput } from '@/components/core/Input';
import { FileBrowserTooltip } from './FileBrowserTooltip';
import { FileBrowserSortFilterControls } from './FileBrowserSortFilterControls';
import { FileBrowserViewToggle } from './FileBrowserViewToggle';
import { fileBrowserContentInset } from './file-browser-layout';

export interface FileBrowserHeaderPathItem {
  id?: string;
  name: string;
}

export interface FileBrowserHeaderLabels {
  description: string;
  root: string;
  back: string;
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
  /** Accessible name of the exclusive grid/list choice. */
  viewMode: string;
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
  viewOptions?: FileBrowserViewOptions;
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
  viewOptions,
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
  const managementDisabled = !canManage || batchActionsDisabled || mutationLoading;

  return (
    <LayoutInset inline={fileBrowserContentInset} block="xxs" data-file-browser-header-inset>
      <SelectionToolbar
        divider="none"
        data-file-browser-header
        description={labels.description}
        location={<SelectionPath items={path} label={labels.root} parentLabel={labels.back} onOpen={onOpenPath} pageTitle />}
        search={
          <TextInput
            aria-label={labels.search}
            placeholder={labels.search}
            value={query}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.currentTarget.value)}
          />
        }
        filters={
          <FileBrowserSortFilterControls
            labels={labels}
            mimeTypePrefix={mimeTypePrefix}
            sort={sort}
            onMimeTypePrefixChange={onMimeTypePrefixChange}
            onSortChange={onSortChange}
          />
        }
        actions={
          <LayoutInline gap="sm" wrap="nowrap" role="group" aria-label={labels.actions}>
            <LayoutInline gap="xxs" wrap="nowrap">
              <FileBrowserTooltip label={labels.newFolder}>
                <IconButton
                  label={labels.newFolder}
                  tone="neutral"
                  emphasis="low"
                  onClick={onCreateFolder}
                  disabled={!canManage || mutationLoading}
                >
                  <IconFolderPlus aria-hidden />
                </IconButton>
              </FileBrowserTooltip>
              <FileBrowserTooltip label={labels.upload}>
                <IconButton label={labels.upload} tone="accent" emphasis="low" onClick={onUploadRequested}>
                  <IconUpload aria-hidden />
                </IconButton>
              </FileBrowserTooltip>
            </LayoutInline>
            <LayoutInline gap="xxs" wrap="nowrap">
              <FileBrowserTooltip label={labels.move}>
                <IconButton
                  label={labels.move}
                  tone="accent"
                  emphasis="low"
                  disabled={managementDisabled}
                  onClick={onMoveSelectedFiles}
                >
                  <IconFolder aria-hidden />
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
                  <IconTrash aria-hidden />
                </IconButton>
              </FileBrowserTooltip>
            </LayoutInline>
            {!searching ? (
              <>
                <FileBrowserViewToggle
                  value={viewMode}
                  viewOptions={viewOptions}
                  label={labels.viewMode}
                  gridLabel={labels.gridView}
                  listLabel={labels.listView}
                  onChange={onViewModeChange}
                />
              </>
            ) : null}
          </LayoutInline>
        }
      />
    </LayoutInset>
  );
}
