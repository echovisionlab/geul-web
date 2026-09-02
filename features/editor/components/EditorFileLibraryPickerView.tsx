'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { IconDownload, IconEye, IconFolder, IconFolderOpen, IconSearch } from '@tabler/icons-react';
import { Box, Center, Group, Loader, Stack, Text } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { DataTableView, type DataTableViewColumn } from '@/components/core/DataTable';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { SegmentedControl, TextInput } from '@/components/core/Input';
import { ContentModal } from '@/components/core/Modal';
import { TextButton } from '@/components/core/TextButton';
import { FileBrowserGridView, type FileBrowserGridItemView } from '@/features/file-manager/ui/FileBrowserGridView';
import { FileBrowserSortFilterControls } from '@/features/file-manager/ui/FileBrowserSortFilterControls';
import { FileBrowserViewToggle } from '@/features/file-manager/ui/FileBrowserViewToggle';
import { FilePreview } from '@/features/media/FilePreview';
import type { FileManagerFileRow, FileManagerRow } from '@/lib/actions/file';
import { formatFileSize } from '@/lib/utils/upload';
import { editorLibraryFileDisplayName } from '../lib/editor-library-file-selection';
import classes from './EditorFileLibraryPickerView.module.css';

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
  selectAllRows: string;
  open: string;
  preview: string;
  download: string;
  gridView: string;
  listView: string;
  closePreview: string;
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
  selectedFiles?: readonly FileManagerFileRow[];
  allowMultiple?: boolean;
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
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
  onLoadMore: () => void;
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
    [labels.type, row.mimeType],
    [labels.size, formatFileSize(row.fileSize)],
    [labels.location, rowLocation(row, rootLabel)],
  ];

  return (
    <Stack gap="md">
      <Box className={classes.preview}>
        <FilePreview file={row} />
      </Box>
      <Stack component="dl" gap="xs" m={0}>
        {details.map(([label, value]) => (
          <Group component="div" key={label} justify="space-between" align="flex-start" gap="md" wrap="nowrap">
            <Text component="dt" size="xs" c="dimmed">
              {label}
            </Text>
            <Text component="dd" size="xs" m={0} className={classes.detailValue} lineClamp={2}>
              {value}
            </Text>
          </Group>
        ))}
      </Stack>
    </Stack>
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
  const selectedFileIds = useMemo(() => new Set(selectedFiles.map((file) => file.id)), [selectedFiles]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [previewFile, setPreviewFile] = useState<FileManagerFileRow | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const itemById = useMemo(() => new Map(props.rows.map((row) => [row.id, row])), [props.rows]);
  const currentFolderLabel = props.path.at(-1)?.name ?? labels.currentFolder;

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !props.hasMore || props.loadingMore || props.error || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          props.onLoadMore();
        }
      },
      { rootMargin: '240px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [props.error, props.hasMore, props.loadingMore, props.onLoadMore]);

  const columns = useMemo<DataTableViewColumn<FileManagerRow>[]>(
    () => [
      {
        key: 'name',
        header: labels.name,
        minWidth: 220,
        renderCell: (row) => (
          <Group gap="xs" align="flex-start" wrap="nowrap">
            {row.kind === 'folder' ? <IconFolder size={18} aria-hidden /> : null}
            <Stack gap={0} miw={0}>
              <Text size="sm" truncate>
                {rowDisplayName(row)}
              </Text>
              {props.searching ? (
                <Text size="xs" c="dimmed" truncate>
                  {rowLocation(row, props.path[0]?.name ?? '')}
                </Text>
              ) : null}
            </Stack>
          </Group>
        ),
      },
      {
        key: 'type',
        header: labels.type,
        width: 130,
        renderCell: (row) => (
          <Text size="sm" c="dimmed" truncate>
            {row.kind === 'folder' ? labels.folderType : row.mimeType}
          </Text>
        ),
      },
      {
        key: 'size',
        header: labels.size,
        width: 80,
        renderCell: (row) => (
          <Text size="sm" c="dimmed">
            {row.kind === 'folder' ? '—' : formatFileSize(row.fileSize)}
          </Text>
        ),
      },
    ],
    [labels, props.path, props.searching],
  );

  const gridItems = useMemo<FileBrowserGridItemView[]>(
    () =>
      props.rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        name: rowDisplayName(row),
        mimeType: row.kind === 'file' ? row.mimeType : undefined,
        thumbnailUrl: row.kind === 'file' ? row.thumbnailUrl : undefined,
        inlineUrl: row.kind === 'file' ? row.inlineUrl : undefined,
        disabled: props.isRowDisabled(row),
      })),
    [props],
  );

  const selectGridItem = (event: MouseEvent<HTMLElement>, item: FileBrowserGridItemView) => {
    event.stopPropagation();
    const row = itemById.get(item.id);
    if (!row) {
      return;
    }
    if (row.kind === 'file' && !props.isRowDisabled(row)) {
      props.onActivateRow(row);
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
    } else {
      props.onConfirmFiles([row]);
    }
  };

  const openContextMenu = (event: MouseEvent<HTMLElement>, row: FileManagerRow) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ ...contextCoordinates(event), row });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>, row: FileManagerRow) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (row.kind === 'folder') {
        props.onActivateRow(row);
      } else if (props.isRowDisabled(row)) {
        setPreviewFile(row);
      } else {
        props.onConfirmFiles([row]);
      }
      return;
    }
    if (event.key === ' ') {
      event.preventDefault();
      if (row.kind === 'file' && !props.isRowDisabled(row)) {
        props.onActivateRow(row);
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
    <Box className={classes.root} data-editor-file-library-picker data-view={viewMode}>
      <Box className={classes.workspace}>
        <Box className={classes.toolbar}>
          <Group gap={4} wrap="nowrap" className={classes.path}>
            {props.path.map((item, index) => (
              <Group key={`${item.id ?? 'root'}-${index}`} gap={4} wrap="nowrap" miw={0}>
                {index > 0 ? (
                  <Text size="sm" c="dimmed" aria-hidden>
                    /
                  </Text>
                ) : null}
                {index < props.path.length - 1 ? (
                  <TextButton appearance="default" onClick={() => props.onOpenPath(index)}>
                    {item.name}
                  </TextButton>
                ) : (
                  <Text size="sm" fw={600} truncate>
                    {item.name}
                  </Text>
                )}
              </Group>
            ))}
          </Group>
          <Box className={classes.viewToggle}>
            <FileBrowserViewToggle
              value={viewMode}
              gridLabel={labels.gridView}
              listLabel={labels.listView}
              onChange={props.onViewModeChange}
            />
          </Box>
          <FileBrowserSortFilterControls
            className={classes.sortFilter}
            labels={labels}
            mimeTypePrefix={props.mimeTypePrefix}
            sort={props.sort}
            onMimeTypePrefixChange={props.onMimeTypePrefixChange}
            onSortChange={props.onSortChange}
          />
          <TextInput
            className={classes.search}
            value={props.query}
            onChange={(event) => props.onQueryChange(event.currentTarget.value)}
            placeholder={labels.search}
            aria-label={labels.search}
            leftSection={<IconSearch size={16} aria-hidden />}
          />
        </Box>

        {props.query.trim() ? (
          <Group className={classes.scopeBar} gap="xs" wrap="nowrap">
            <Text size="xs" c="dimmed" fw={600}>
              {labels.searchScope}:
            </Text>
            <SegmentedControl
              className={classes.scopeControl}
              size="xs"
              value={props.searchScope}
              aria-label={labels.searchScope}
              data={[
                { value: 'all', label: labels.allFiles },
                { value: 'folder', label: `‘${currentFolderLabel}’` },
              ]}
              onChange={(value) => props.onSearchScopeChange(value as 'folder' | 'all')}
            />
          </Group>
        ) : null}

        <Box className={classes.results}>
          {props.error ? (
            <Text size="sm" c="red" p="md">
              {props.error}
            </Text>
          ) : null}
          {props.folderNotFound ? (
            <Center className={classes.centerState}>
              <Stack gap="xs" align="center">
                <Text size="sm" c="dimmed">
                  {labels.folderNotFound}
                </Text>
                <Button size="xs" tone="neutral" emphasis="medium" onClick={props.onReturnToParent}>
                  {labels.back}
                </Button>
              </Stack>
            </Center>
          ) : props.loading ? (
            <Center className={classes.centerState}>
              <Loader size="sm" aria-label={labels.loading} />
            </Center>
          ) : props.rows.length === 0 ? (
            <Center className={classes.centerState}>
              <Text size="sm" c="dimmed">
                {labels.empty}
              </Text>
            </Center>
          ) : viewMode === 'grid' ? (
            <Box className={classes.gridSurface}>
              <FileBrowserGridView
                items={gridItems}
                selectedItemIds={selectedFiles.map((file) => file.id)}
                density="workspace"
                multiSelect={props.allowMultiple}
                onItemClick={selectGridItem}
                onItemDoubleClick={(_event, item) => activateGridItem(item)}
                onItemContextMenu={(event, item) => {
                  const row = itemById.get(item.id);
                  if (row) {
                    openContextMenu(event, row);
                  }
                }}
                onItemKeyDown={(event, item) => {
                  const row = itemById.get(item.id);
                  if (row) {
                    handleKeyDown(event, row);
                  }
                }}
              />
              {props.hasMore ? <Box ref={loadMoreRef} className={classes.loadMoreSentinel} aria-hidden /> : null}
            </Box>
          ) : (
            <Box className={classes.listSurface}>
              <DataTableView
                columns={columns}
                rows={props.rows}
                getRowKey={(row) => `${row.kind}:${row.id}`}
                emptyMessage={labels.empty}
                desktopMinWidth={500}
                highlightOnHover
                selection={
                  props.allowMultiple
                    ? {
                        selectedRowKeys: selectedFiles.map((file) => `file:${file.id}`),
                        onSelectedRowKeysChange: (rowKeys) => {
                          const selectedByKey = new Map(
                            [
                              ...selectedFiles,
                              ...props.rows.filter((row): row is FileManagerFileRow => row.kind === 'file'),
                            ].map((file) => [`file:${file.id}`, file]),
                          );
                          props.onSelectedFilesChange(
                            rowKeys.flatMap((rowKey) => {
                              const file = selectedByKey.get(rowKey);
                              return file && !props.isRowDisabled(file) ? [file] : [];
                            }),
                          );
                        },
                        selectAllRowsLabel: labels.selectAllRows,
                        getRowLabel: (row) => rowDisplayName(row),
                        isRowSelectable: (row) => row.kind === 'file' && !props.isRowDisabled(row),
                      }
                    : undefined
                }
                rowInteraction={{
                  isSelected: (row) => row.kind === 'file' && selectedFileIds.has(row.id),
                  isDimmed: props.isRowDisabled,
                  preventTextSelection: true,
                  onClick: (_event, row) => {
                    if (row.kind === 'file' && !props.isRowDisabled(row)) {
                      props.onActivateRow(row);
                    }
                  },
                  onDoubleClick: (_event, row) => {
                    if (row.kind === 'file') {
                      if (props.isRowDisabled(row)) {
                        setPreviewFile(row);
                      } else {
                        props.onConfirmFiles([row]);
                      }
                    } else {
                      props.onActivateRow(row);
                    }
                  },
                  onContextMenu: (event, row) => openContextMenu(event, row),
                  onKeyDown: (event, row) => handleKeyDown(event, row),
                }}
              />
              {props.hasMore ? <Box ref={loadMoreRef} className={classes.loadMoreSentinel} aria-hidden /> : null}
            </Box>
          )}

          {props.hasMore ? (
            <Button
              className={classes.loadMoreFallback}
              size="xs"
              tone="neutral"
              emphasis="low"
              loading={props.loadingMore}
              onClick={props.onLoadMore}
            >
              {labels.loadMore}
            </Button>
          ) : null}
        </Box>
      </Box>

      <Group className={classes.footer} justify="space-between" wrap="nowrap">
        <Text size="xs" c="dimmed" truncate>
          {selectedFiles.length > 0
            ? labels.selectedCount(selectedFiles.length)
            : props.searching
              ? labels.searchResultCount(props.total)
              : labels.itemCount(props.rows.length)}
        </Text>
        <Button
          size="sm"
          disabled={selectedFiles.length === 0}
          onClick={() => props.onConfirmFiles([...selectedFiles])}
        >
          {labels.add}
        </Button>
      </Group>

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
          <DropdownMenu.Target>
            <Box className={classes.contextTarget} style={{ left: contextMenu.x, top: contextMenu.y }} aria-hidden />
          </DropdownMenu.Target>
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
                    component="a"
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
    </Box>
  );
}
