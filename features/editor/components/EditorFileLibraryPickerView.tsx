'use client';
import { Text as DsText } from '@/components/core/Typography';
import type { FileBrowserViewOptions } from '@/features/file-manager/ui/file-browser-view-settings';

import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { IconDownload, IconEye, IconFolderOpen } from '@tabler/icons-react';
import {
  SelectionEmptyState,
  SelectionToolbar,
  SelectionPath,
  SelectionStatus,
  SelectionViewport,
  SelectionMarquee,
  type SelectionGridColumns,
} from '@/components/core/SelectionSurface';
import { NearEndLoader, Spinner as Loader, type NearEndLoaderLabels } from '@/components/core/Display';
import { Button } from '@/components/core/Button';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { SearchInput } from '@/components/core/Input';
import { TextButton } from '@/components/core/TextButton';
import { ContentModal } from '@/components/core/Modal';
import { FileBrowserGridView, type FileBrowserGridItemView } from '@/features/file-manager/ui/FileBrowserGridView';
import { FileBrowserListView } from '@/features/file-manager/ui/FileBrowserListView';
import { FileBrowserSortFilterControls } from '@/features/file-manager/ui/FileBrowserSortFilterControls';
import { FileBrowserViewToggle } from '@/features/file-manager/ui/FileBrowserViewToggle';
import { fileBrowserContentInset } from '@/features/file-manager/ui/file-browser-layout';
import { FilePreview } from '@/features/media/FilePreview';
import { useFileManagerSelection } from '@/features/file-manager/useFileManagerSelection';
import {
  fileBrowserTypeLabel,
  fileBrowserListPresentation,
  fileBrowserSizeLabel as formatFileSize,
} from '@/features/file-manager/file-browser-presentation';
import type { FileManagerFileRow, FileManagerRow } from '@/lib/actions/file';
import { editorLibraryFileDisplayName } from '../lib/editor-library-file-selection';
import classes from './EditorFileLibraryPickerView.module.css';
import { EmptyState } from '@/components/core/EmptyState';

export interface FileLibraryPathItem {
  id?: string;
  name: string;
}

export interface EditorFileLibraryPickerViewLabels {
  search: string;
  searchScope: string;
  currentFolder: string;
  allFiles: string;
  name: string;
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
  size: string;
  location: string;
  folderType: string;
  empty: string;
  folderNotFound: string;
  selectFile: string;
  loading: string;
  back: string;
  add: string;
  loadMore: string;
  pagination: NearEndLoaderLabels;
  selectAllRows: string;
  open: string;
  preview: string;
  download: string;
  gridView: string;
  listView: string;
  viewMode: string;
  closePreview: string;
  selectionUnavailableDescription: string;
  itemCount: (count: number) => string;
  searchResultCount: (count: number) => string;
  selectedCount: (count: number) => string;
}

export interface EditorFileLibraryPickerViewProps {
  labels: EditorFileLibraryPickerViewLabels;
  rows: FileManagerRow[];
  path: FileLibraryPathItem[];
  query: string;
  searchScope: 'folder' | 'all';
  mimeTypePrefix: string;
  sort: string;
  searching: boolean;
  total: number;
  viewMode?: 'grid' | 'list';
  viewOptions?: FileBrowserViewOptions;
  gridColumns?: SelectionGridColumns;
  selectedFiles?: readonly FileManagerFileRow[];
  allowMultiple?: boolean;
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  nextPageKey?: string;
  loadMoreError?: string | null;
  error?: string | null;
  folderNotFound?: boolean;
  isRowDisabled: (row: FileManagerRow) => boolean;
  onQueryChange: (value: string) => void;
  onSearchScopeChange: (scope: 'folder' | 'all') => void;
  onMimeTypePrefixChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onOpenPath: (index: number) => void;
  onActivateRow: (row: FileManagerRow) => void;
  onSelectedFilesChange: (files: FileManagerFileRow[]) => void;
  onConfirmFiles: (files: FileManagerFileRow[]) => void;
  onReturnToParent: () => void;
  onLoadMore: () => Promise<void>;
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  row: FileManagerRow;
}

function rowDisplayName(row: FileManagerRow): string {
  return row.kind === 'folder' ? row.name : editorLibraryFileDisplayName(row);
}

function rowLocation(row: FileManagerRow, rootLabel: string): string {
  const path = row.folderPath ?? [];
  const containingPath = row.kind === 'folder' ? path.slice(0, -1) : path;
  return [rootLabel, ...containingPath.map((segment) => segment.name)].join(' / ');
}

function FilePreviewDetails({
  row,
  labels,
  rootLabel,
}: {
  row: FileManagerFileRow;
  labels: EditorFileLibraryPickerViewLabels;
  rootLabel: string;
}) {
  const details = [
    [labels.type, fileBrowserTypeLabel(row, labels.folderType)],
    [labels.size, formatFileSize(row.fileSize)],
    [labels.location, rowLocation(row, rootLabel)],
  ];

  return (
    <DsLayoutStack gap="md">
      <div className={classes.preview}>
        <FilePreview file={row} />
      </div>
      <DsLayoutStack as="dl" gap="xs">
        {details.map(([label, value]) => (
          <DsLayoutInline as="div" key={label} justify="between" align="start" gap="md" wrap="nowrap">
            <DsText as="dt" size="xs" tone="secondary">
              {label}
            </DsText>
            <DsText as="dd" size="xs" align="end" lines={2}>
              {value}
            </DsText>
          </DsLayoutInline>
        ))}
      </DsLayoutStack>
    </DsLayoutStack>
  );
}

function contextCoordinates(event: MouseEvent<HTMLElement>) {
  return { x: event.clientX, y: event.clientY };
}

/** Pure library picker view. Search, navigation, eligibility, requests, and selection policy arrive through props. */
export function EditorFileLibraryPickerView(props: EditorFileLibraryPickerViewProps) {
  const { labels } = props;
  const selectedFiles = props.selectedFiles ?? [];
  const viewMode = props.viewMode ?? 'grid';
  // Folders participate in browser selection, but never become file form values.
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const selectionScope = JSON.stringify([props.path, props.query, props.searchScope]);
  useEffect(() => setSelectedFolderIds([]), [selectionScope]);
  const selectedItemIds = [
    ...selectedFiles.map((file) => file.id),
    ...selectedFolderIds.filter((id) => props.rows.some((row) => row.kind === 'folder' && row.id === id)),
  ];
  const selectedItemIdSet = new Set(selectedItemIds);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [previewFile, setPreviewFile] = useState<FileManagerFileRow | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const itemById = useMemo(() => new Map(props.rows.map((row) => [row.id, row])), [props.rows]);
  const selection = useFileManagerSelection({
    items: props.rows,
    selectedItemIds,
    getItemKey: (row) => (viewMode === 'list' ? `${row.kind}:${row.id}` : row.id),
    isItemSelectable: (row) => !props.isRowDisabled(row),
    onSelectedItemIdsChange: (ids) => {
      const filesById = new Map([...selectedFiles, ...props.rows].map((row) => [row.id, row]));
      setSelectedFolderIds(ids.filter((id) => filesById.get(id)?.kind === 'folder'));
      props.onSelectedFilesChange(
        ids.flatMap((id) => {
          const row = filesById.get(id);
          return row?.kind === 'file' && !props.isRowDisabled(row) ? [row] : [];
        }),
      );
    },
    onOpenFolder: props.onActivateRow,
    onOpenFile: (row) => setPreviewFile(row),
  });
  const handleSelectionClick = (event: MouseEvent<HTMLElement>, row: FileManagerRow, index: number) => {
    if (event.shiftKey) {
      selection.selectItem(event, row, index);
    } else {
      selection.anchorItem(row);
    }
  };
  const selectionSurfaceProps = {
    onClick: selection.clearSurfaceSelection,
    ...(props.allowMultiple
      ? {
          onPointerDown: selection.startMarquee,
          onPointerMove: selection.updateMarquee,
          onPointerUp: selection.finishMarquee,
          onPointerCancel: selection.finishMarquee,
        }
      : {}),
  };
  const currentFolderLabel = props.path.at(-1)?.name ?? labels.currentFolder;

  const gridItems = useMemo<FileBrowserGridItemView[]>(
    () =>
      props.rows.map<FileBrowserGridItemView>((row) => {
        const item = {
          id: row.id,
          kind: row.kind,
          name: rowDisplayName(row),
          mimeType: row.kind === 'file' ? row.mimeType : undefined,
          thumbnailUrl: row.kind === 'file' ? row.thumbnailUrl : undefined,
          inlineUrl: row.kind === 'file' ? row.inlineUrl : undefined,
        };
        return props.isRowDisabled(row)
          ? {
              ...item,
              selectionUnavailable: true,
              selectionUnavailableDescription: labels.selectionUnavailableDescription,
            }
          : item;
      }),
    [props],
  );

  const selectGridItem = (event: MouseEvent<HTMLElement>, item: FileBrowserGridItemView, index: number) => {
    event.stopPropagation();
    const row = itemById.get(item.id);
    if (!row) {
      return;
    }
    if (row.kind === 'file' && !props.isRowDisabled(row)) {
      if (props.allowMultiple) {
        selection.selectItem(event, row, index);
      } else {
        props.onConfirmFiles([row]);
      }
    } else if (row.kind === 'folder') {
      selection.selectItem(
        props.allowMultiple ? event : { metaKey: false, ctrlKey: false, shiftKey: false },
        row,
        index,
      );
    }
  };

  const activateGridItem = (item: FileBrowserGridItemView) => {
    const row = itemById.get(item.id);
    if (!row) {
      return;
    }
    if (row.kind === 'folder') {
      props.onActivateRow(row);
    } else if (props.isRowDisabled(row)) {
      setPreviewFile(row);
    } else if (props.allowMultiple) {
      setPreviewFile(row);
    }
  };

  const openContextMenu = (event: MouseEvent<HTMLElement>, row: FileManagerRow) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ ...contextCoordinates(event), row });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>, row: FileManagerRow, index: number) => {
    if (
      event.target !== event.currentTarget &&
      (event.target as HTMLElement).closest('button, input, select, textarea, a, [role=button]')
    ) {
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (row.kind === 'folder') {
        props.onActivateRow(row);
      } else if (props.isRowDisabled(row)) {
        setPreviewFile(row);
      } else if (props.allowMultiple) {
        selection.selectItem(event, row, index);
      } else {
        props.onConfirmFiles([row]);
      }
      return;
    }
    if (event.key === ' ') {
      event.preventDefault();
      if (row.kind === 'folder') {
        selection.selectItem(
          props.allowMultiple ? event : { metaKey: false, ctrlKey: false, shiftKey: false },
          row,
          index,
        );
      } else if (!props.isRowDisabled(row)) {
        if (props.allowMultiple) {
          selection.selectItem({ ctrlKey: true, metaKey: false, shiftKey: event.shiftKey }, row, index);
        } else {
          props.onConfirmFiles([row]);
        }
      }
      return;
    }
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      setContextMenu({ x: bounds.left + 20, y: bounds.top + 20, row });
    }
  };

  return (
    <div className={classes.root} data-editor-file-library-picker data-view={viewMode}>
      <div className={classes.workspace}>
        <DsLayoutInset inline={fileBrowserContentInset} block="xxs">
          <SelectionToolbar
            divider="none"
            arrangement="actions-inline"
            location={<SelectionPath items={props.path} parentLabel={labels.back} onOpen={props.onOpenPath} />}
            actions={
              <FileBrowserViewToggle
                value={viewMode}
                viewOptions={props.viewOptions}
                label={labels.viewMode}
                gridLabel={labels.gridView}
                listLabel={labels.listView}
                onChange={props.onViewModeChange}
              />
            }
            filters={
              <FileBrowserSortFilterControls
                labels={labels}
                mimeTypePrefix={props.mimeTypePrefix}
                sort={props.sort}
                onMimeTypePrefixChange={props.onMimeTypePrefixChange}
                onSortChange={props.onSortChange}
              />
            }
            search={
              <SearchInput
                value={props.query}
                onChange={(event) => props.onQueryChange(event.currentTarget.value)}
                placeholder={labels.search}
                aria-label={labels.search}
              />
            }
          />
        </DsLayoutInset>

        {props.query.trim() ? (
          <DsLayoutInset inline={fileBrowserContentInset} block="none">
            <DsLayoutInline gap="xs" role="group" aria-label={labels.searchScope} data-file-search-context>
              <TextButton
                size="xs"
                selected={props.searchScope === 'all'}
                aria-pressed={props.searchScope === 'all'}
                aria-label={`${labels.searchScope} · ${labels.allFiles}`}
                data-file-search-scope="all"
                onClick={() => props.onSearchScopeChange('all')}
              >
                {labels.allFiles}
              </TextButton>
              <TextButton
                size="xs"
                selected={props.searchScope === 'folder'}
                aria-pressed={props.searchScope === 'folder'}
                aria-label={`${labels.searchScope} · ${labels.currentFolder} · ${currentFolderLabel}`}
                data-file-search-scope="folder"
                onClick={() => props.onSearchScopeChange('folder')}
              >
                {currentFolderLabel}
              </TextButton>
            </DsLayoutInline>
          </DsLayoutInset>
        ) : null}

        <div ref={resultsRef} className={classes.results} aria-busy={props.loading || props.loadingMore || false}>
          {props.error ? (
            <DsLayoutInset space="md">
              <DsText size="sm" tone="danger" role="alert">
                {props.error}
              </DsText>
            </DsLayoutInset>
          ) : null}
          {props.folderNotFound ? (
            <SelectionEmptyState>
              <EmptyState
                inset="none"
                title={labels.folderNotFound}
                action={
                  props.path.length > 1 ? (
                    <Button size="xs" tone="neutral" emphasis="medium" onClick={props.onReturnToParent}>
                      {labels.back}
                    </Button>
                  ) : undefined
                }
              />
            </SelectionEmptyState>
          ) : props.loading ? (
            <SelectionEmptyState>
              <Loader size="sm" aria-label={labels.loading} />
            </SelectionEmptyState>
          ) : props.rows.length === 0 ? (
            <SelectionEmptyState>
              <EmptyState inset="none" title={labels.empty} />
            </SelectionEmptyState>
          ) : viewMode === 'grid' ? (
            <div className={classes.gridSurface}>
              <SelectionViewport inset="none" ref={selection.surfaceRef} {...selectionSurfaceProps}>
                <DsLayoutInset inline={fileBrowserContentInset} block="xs">
                  <FileBrowserGridView
                    label={labels.selectFile}
                    items={gridItems}
                    selectedItemIds={selectedItemIds}
                    density="workspace"
                    columns={props.gridColumns ?? props.viewOptions?.value.columns}
                    iconSize={props.viewOptions?.value.iconSize}
                    spacing={props.viewOptions?.value.spacing}
                    multiSelect={props.allowMultiple ?? false}
                    onItemClick={selectGridItem}
                    onItemDoubleClick={(_event, item) => activateGridItem(item)}
                    onItemContextMenu={(event, item) => {
                      const row = itemById.get(item.id);
                      if (row) {
                        openContextMenu(event, row);
                      }
                    }}
                    onItemKeyDown={(event, item, index) => {
                      const row = itemById.get(item.id);
                      if (row) {
                        handleKeyDown(event, row, index);
                      }
                    }}
                  />
                </DsLayoutInset>
                {selection.marqueeRect ? <SelectionMarquee rect={selection.marqueeRect} /> : null}
              </SelectionViewport>
            </div>
          ) : (
            <div className={classes.listSurface}>
              <SelectionViewport inset="none" ref={selection.surfaceRef} {...selectionSurfaceProps}>
                <DsLayoutInset inline={fileBrowserContentInset} block="none">
                  <FileBrowserListView
                    accessibleLabel={labels.selectFile}
                    labels={labels}
                    getPresentation={(row) =>
                      fileBrowserListPresentation(
                        row,
                        rowDisplayName(row),
                        labels.folderType,
                        props.searching ? rowLocation(row, props.path[0]?.name ?? '') : undefined,
                      )
                    }
                    showLocation={props.searching}
                    rowDividers="between"
                    rows={props.rows}
                    getRowKey={(row) => `${row.kind}:${row.id}`}
                    emptyMessage={labels.empty}
                    highlightOnHover
                    selection={
                      props.allowMultiple
                        ? {
                            selectedRowKeys: selectedFiles.map((file) => `file:${file.id}`),
                            onSelectedRowKeysChange: (rowKeys) => {
                              selection.changeTableSelection(
                                rowKeys.map((key) => key.replace(/^file:/, '')),
                                false,
                              );
                            },
                            onRowSelectionClick: handleSelectionClick,
                            selectAllRowsLabel: labels.selectAllRows,
                            getRowLabel: (row) => rowDisplayName(row),
                            isRowSelectable: (row) => row.kind === 'file' && !props.isRowDisabled(row),
                          }
                        : undefined
                    }
                    rowInteraction={{
                      isSelected: (row) => selectedItemIdSet.has(row.id),
                      isDimmed: props.isRowDisabled,
                      getDescription: (row) =>
                        props.isRowDisabled(row) ? labels.selectionUnavailableDescription : undefined,
                      preventTextSelection: true,
                      onClick: (event, row, index) => {
                        if (row.kind === 'folder') {
                          selection.selectItem(
                            props.allowMultiple ? event : { metaKey: false, ctrlKey: false, shiftKey: false },
                            row,
                            index,
                          );
                        } else if (props.allowMultiple) {
                          selection.selectItem(event, row, index);
                        } else if (!props.isRowDisabled(row)) {
                          props.onConfirmFiles([row]);
                        }
                      },
                      onDoubleClick: (_event, row) => {
                        if (row.kind === 'file') {
                          if (props.isRowDisabled(row)) {
                            setPreviewFile(row);
                          } else if (props.allowMultiple) {
                            setPreviewFile(row);
                          }
                        } else {
                          props.onActivateRow(row);
                        }
                      },
                      onContextMenu: (event, row) => openContextMenu(event, row),
                      onKeyDown: (event, row, index) => handleKeyDown(event, row, index),
                    }}
                  />
                </DsLayoutInset>
                {selection.marqueeRect ? <SelectionMarquee rect={selection.marqueeRect} /> : null}
              </SelectionViewport>
            </div>
          )}

          {props.searching && !props.loading ? (
            <DsLayoutInset inline={fileBrowserContentInset} block="none">
              <NearEndLoader
                pageKey={props.hasMore ? (props.nextPageKey ?? null) : null}
                resetKey={JSON.stringify([
                  props.query.trim(),
                  props.searchScope,
                  props.path,
                  props.mimeTypePrefix,
                  props.sort,
                ])}
                rootRef={resultsRef}
                loading={props.loadingMore}
                error={props.loadMoreError}
                labels={labels.pagination}
                onLoad={props.onLoadMore}
              />
            </DsLayoutInset>
          ) : null}
        </div>
      </div>

      <SelectionStatus
        density="standard"
        divider="content"
        trailing={
          props.allowMultiple ? (
            <Button
              emphasis="strong"
              size="sm"
              disabled={selectedFiles.length === 0}
              onClick={() => props.onConfirmFiles([...selectedFiles])}
            >
              {labels.add}
            </Button>
          ) : undefined
        }
      >
        {selectedItemIds.length > 0
          ? labels.selectedCount(selectedItemIds.length)
          : props.searching
            ? labels.searchResultCount(props.total)
            : labels.itemCount(props.rows.length)}
      </SelectionStatus>

      {contextMenu ? (
        <DropdownMenu
          opened
          onChange={(opened) => {
            if (!opened) {
              setContextMenu(null);
            }
          }}
          placement="bottom-start"
        >
          <DropdownMenu.Anchor x={contextMenu.x} y={contextMenu.y} />
          <DropdownMenu.Dropdown>
            {contextMenu.row.kind === 'folder' ? (
              <DropdownMenu.Item
                icon={<IconFolderOpen size={16} />}
                onClick={() => {
                  props.onActivateRow(contextMenu.row);
                  setContextMenu(null);
                }}
              >
                {labels.open}
              </DropdownMenu.Item>
            ) : (
              <>
                <DropdownMenu.Item
                  icon={<IconEye size={16} />}
                  onClick={() => {
                    setPreviewFile(contextMenu.row as FileManagerFileRow);
                    setContextMenu(null);
                  }}
                >
                  {labels.preview}
                </DropdownMenu.Item>
                {contextMenu.row.downloadUrl ? (
                  <DropdownMenu.Item
                    href={contextMenu.row.downloadUrl}
                    icon={<IconDownload size={16} />}
                    onClick={() => setContextMenu(null)}
                  >
                    {labels.download}
                  </DropdownMenu.Item>
                ) : null}
                {!props.isRowDisabled(contextMenu.row) ? (
                  <DropdownMenu.Item
                    onClick={() => {
                      props.onConfirmFiles([contextMenu.row as FileManagerFileRow]);
                      setContextMenu(null);
                    }}
                  >
                    {labels.add}
                  </DropdownMenu.Item>
                ) : null}
              </>
            )}
          </DropdownMenu.Dropdown>
        </DropdownMenu>
      ) : null}

      <ContentModal
        opened={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        title={previewFile ? editorLibraryFileDisplayName(previewFile) : labels.preview}
        closeLabel={labels.closePreview}
        size="large"
        centered
      >
        {previewFile ? (
          <FilePreviewDetails row={previewFile} labels={labels} rootLabel={props.path[0]?.name ?? ''} />
        ) : null}
      </ContentModal>
    </div>
  );
}
