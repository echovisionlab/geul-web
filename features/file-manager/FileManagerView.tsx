'use client';

import { type MouseEvent, type ReactNode } from 'react';
import {
  IconDots,
  IconDownload,
  IconEye,
  IconFolder,
  IconFolderOpen,
  IconFolderPlus,
  IconLink,
  IconLinkOff,
  IconPencil,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { FileDerivativeType, FileUsageDomain } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { Box, Center, Group, Image, Loader, Paper, Stack, Text } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { DateTime } from '@/features/date-time/DateTime';
import { DataTableView, type DataTableViewColumn } from '@/components/core/DataTable';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { IconButton } from '@/components/core/IconButton';
import { ContentModal } from '@/components/core/Modal';
import { Progress } from '@/components/core/Progress';
import { TextButton } from '@/components/core/TextButton';
import { FilePreview, FileTypeIcon } from '@/features/media/FilePreview';
import classes from './FileManagerView.module.css';
import type { FileManagerFileView, FileManagerItemView, FileManagerUsageItemView } from './model';
import { FileBrowserGridView } from './ui/FileBrowserGridView';
import { FileBrowserHeader } from './ui/FileBrowserHeader';
import { FileBrowserStatusBar } from './ui/FileBrowserStatusBar';
import { FileBrowserTooltip } from './ui/FileBrowserTooltip';
import { useFileManagerSelection } from './useFileManagerSelection';

type FileManagerFileRow = FileManagerFileView;
type FileManagerRow = FileManagerItemView;
type FileManagerUsageView = FileManagerUsageItemView;

export type FileManagerViewMode = 'grid' | 'list';

export interface FileManagerPathItem {
  id?: string;
  name: string;
}

export interface FileManagerViewLabels {
  title: string;
  description: string;
  root: string;
  search: string;
  allTypes: string;
  images: string;
  audio: string;
  video: string;
  documents: string;
  folderType: string;
  sortName: string;
  sortNewest: string;
  sortOldest: string;
  sortSize: string;
  sortSmallest: string;
  sortLabel: string;
  upload: string;
  newFolder: string;
  open: string;
  preview: string;
  move: string;
  moveHere: string;
  chooseDestination: string;
  delete: string;
  rename: string;
  download: string;
  close: string;
  cancel: string;
  gridView: string;
  listView: string;
  loadMore: string;
  name: string;
  type: string;
  size: string;
  location: string;
  uploadedBy: string;
  uploadedAt: string;
  usages: string;
  usageStatus: string;
  inUse: string;
  notInUse: string;
  usageDomains: Partial<Record<FileUsageDomain, string>>;
  usageSlots: Record<string, string>;
  generatedOutputs: string;
  generatedOutputTypes: Partial<Record<FileDerivativeType, string>>;
  processingStatuses: Partial<Record<MediaProcessingStatus, string>>;
  adminOnly: string;
  actions: string;
  empty: string;
  folderNotFound: string;
  returnToRoot: string;
  unknownMember: string;
  deletedMember: string;
  selectAll: string;
  selectItem: (name: string) => string;
  sortBy: (name: string) => string;
  selectedCount: (count: number) => string;
  itemCount: (count: number) => string;
  searchResultCount: (count: number) => string;
  uploadProgress: (percentage: number) => string;
}

export interface FileManagerViewProps {
  labels: FileManagerViewLabels;
  role: 'author' | 'admin';
  items: FileManagerRow[];
  path: FileManagerPathItem[];
  total: number;
  loading?: boolean;
  searching?: boolean;
  hasMoreItems?: boolean;
  itemsLoadingMore?: boolean;
  query: string;
  mimeTypePrefix: string;
  sort: string;
  viewMode: FileManagerViewMode;
  selectedItemIds: string[];
  detailFile?: FileManagerFileRow | null;
  detailUsages?: FileManagerUsageView[];
  detailLoading?: boolean;
  hasMoreDetailUsages?: boolean;
  uploadPercentage?: number | null;
  error?: string | null;
  folderNotFound?: boolean;
  movePendingLabel?: string | null;
  mutationLoading?: boolean;
  onQueryChange: (value: string) => void;
  onMimeTypePrefixChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onViewModeChange: (mode: FileManagerViewMode) => void;
  onSelectedItemIdsChange: (ids: string[]) => void;
  onOpenPath: (index: number) => void;
  onReturnToRoot: () => void;
  onOpenFolder: (folder: Extract<FileManagerRow, { kind: 'folder' }>) => void;
  onOpenFile: (file: FileManagerFileRow) => void;
  onCloseFile: () => void;
  onUploadRequested: () => void;
  onCreateFolder: () => void;
  onRenameFolder: (folder: Extract<FileManagerRow, { kind: 'folder' }>) => void;
  onMoveFolder: (folder: Extract<FileManagerRow, { kind: 'folder' }>) => void;
  onDeleteFolder: (folder: Extract<FileManagerRow, { kind: 'folder' }>) => void;
  onRenameFile: (file: FileManagerFileRow) => void;
  onMoveSelectedFiles: () => void;
  onDeleteSelectedFiles: () => void;
  onConfirmMoveHere: () => void;
  onCancelMove: () => void;
  onLoadMoreDetailUsages: () => void;
  onLoadMoreItems: () => void;
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function itemLocation(item: FileManagerRow, rootLabel: string): string {
  const path = item.folderPath ?? [];
  const containingPath = item.kind === 'folder' ? path.slice(0, -1) : path;
  return [rootLabel, ...containingPath.map((segment) => segment.name)].join(' / ');
}

function fileDisplayName(file: FileManagerFileRow) {
  return `${file.fileName}.${file.extension}`;
}

function itemDisplayName(item: FileManagerRow) {
  return item.kind === 'folder' ? item.name : fileDisplayName(item);
}

function itemMemberName(item: FileManagerRow, labels: FileManagerViewLabels) {
  const member = item.kind === 'file' ? item.uploadedByMember : item.createdByMember;
  return member ? (member.deleted ? labels.deletedMember : member.nickname) : labels.unknownMember;
}

function usageDomainLabel(usage: FileManagerUsageView, labels: FileManagerViewLabels) {
  return labels.usageDomains[usage.domain] ?? labels.usages;
}

function usageDisplayLabel(usage: FileManagerUsageView, labels: FileManagerViewLabels) {
  const domain = usageDomainLabel(usage, labels);
  if (usage.domain === FileUsageDomain.SITE_SETTINGS) {
    return `${domain} · ${labels.usageSlots[usage.slot] ?? usage.title?.trim() ?? usage.slot}`;
  }
  const target = usage.title?.trim() || usage.entityId;
  const exactLocator = usage.blockId ?? (usage.domain === FileUsageDomain.TRACK ? usage.entityId : undefined);
  const location = [usage.blockType, usage.slot !== 'editor' ? usage.slot : undefined, exactLocator]
    .filter(Boolean)
    .join(' · ');
  return `${domain} · ${target}${location ? ` · ${location}` : ''}`;
}

function AdminOnlyMenuItem({
  labels,
  children,
  icon,
  tone,
}: {
  labels: FileManagerViewLabels;
  children: ReactNode;
  icon: ReactNode;
  tone?: 'danger';
}) {
  return (
    <FileBrowserTooltip label={labels.adminOnly}>
      <DropdownMenu.Item disabled icon={icon} tone={tone}>
        {children}
      </DropdownMenu.Item>
    </FileBrowserTooltip>
  );
}

function stopItemActivation(event: MouseEvent<HTMLElement>) {
  event.stopPropagation();
}

function ItemThumbnail({ item }: { item: FileManagerRow }) {
  const content =
    item.kind === 'folder' ? (
      <Center className={classes.folderPreview}>
        <IconFolder size={24} stroke={1.15} aria-hidden />
      </Center>
    ) : item.thumbnailUrl || (item.inlineUrl && item.mimeType.startsWith('image/')) ? (
      <Image
        className={classes.thumbnailImage}
        src={item.thumbnailUrl ?? item.inlineUrl}
        alt=""
        fit="cover"
        h="100%"
        w="100%"
      />
    ) : (
      <Center className={classes.filePreview}>
        <FileTypeIcon file={item} size={20} />
      </Center>
    );

  return <Box className={classes.listThumbnail}>{content}</Box>;
}

function ItemActions({ item, props }: { item: FileManagerRow; props: FileManagerViewProps }) {
  const { labels } = props;
  const file = item.kind === 'file' ? item : null;
  return (
    <DropdownMenu placement="bottom-end">
      <DropdownMenu.Target>
        <FileBrowserTooltip label={labels.actions}>
          <IconButton
            emphasis="low"
            size="xs"
            aria-label={`${itemDisplayName(item)} · ${labels.actions}`}
            onMouseDown={stopItemActivation}
            onClick={stopItemActivation}
          >
            <IconDots size={14} />
          </IconButton>
        </FileBrowserTooltip>
      </DropdownMenu.Target>
      <DropdownMenu.Dropdown onMouseDown={stopItemActivation} onClick={stopItemActivation}>
        {file?.downloadUrl ? (
          <DropdownMenu.Item component="a" href={file.downloadUrl} icon={<IconDownload size={16} />}>
            {labels.download}
          </DropdownMenu.Item>
        ) : null}
        {props.role === 'admin' ? (
          <>
            <DropdownMenu.Item
              icon={<IconPencil size={16} />}
              onClick={() => (item.kind === 'folder' ? props.onRenameFolder(item) : props.onRenameFile(item))}
            >
              {labels.rename}
            </DropdownMenu.Item>
            {item.kind === 'folder' ? (
              <>
                <DropdownMenu.Item icon={<IconFolder size={16} />} onClick={() => props.onMoveFolder(item)}>
                  {labels.move}
                </DropdownMenu.Item>
                <DropdownMenu.Divider />
                <DropdownMenu.Item
                  tone="danger"
                  icon={<IconTrash size={16} />}
                  onClick={() => props.onDeleteFolder(item)}
                >
                  {labels.delete}
                </DropdownMenu.Item>
              </>
            ) : null}
          </>
        ) : (
          <>
            <AdminOnlyMenuItem labels={labels} icon={<IconPencil size={16} />}>
              {labels.rename}
            </AdminOnlyMenuItem>
            {item.kind === 'folder' ? (
              <>
                <AdminOnlyMenuItem labels={labels} icon={<IconFolder size={16} />}>
                  {labels.move}
                </AdminOnlyMenuItem>
                <DropdownMenu.Divider />
                <AdminOnlyMenuItem labels={labels} tone="danger" icon={<IconTrash size={16} />}>
                  {labels.delete}
                </AdminOnlyMenuItem>
              </>
            ) : null}
          </>
        )}
      </DropdownMenu.Dropdown>
    </DropdownMenu>
  );
}

export function FileManagerView(props: FileManagerViewProps) {
  const { labels } = props;
  const currentLocation = props.path.map((item) => item.name).join(' / ');
  const selection = useFileManagerSelection({
    items: props.items,
    selectedItemIds: props.selectedItemIds,
    onSelectedItemIdsChange: props.onSelectedItemIdsChange,
    onOpenFolder: props.onOpenFolder,
    onOpenFile: props.onOpenFile,
  });
  const { contextMenu, contextItem, selectedItems, onlyFilesSelected, marqueeRect } = selection;
  const gridItems = props.items.map((item) => ({
    id: item.id,
    kind: item.kind,
    name: itemDisplayName(item),
    mimeType: item.kind === 'file' ? item.mimeType : undefined,
    thumbnailUrl: item.kind === 'file' ? item.thumbnailUrl : undefined,
    inlineUrl: item.kind === 'file' ? item.inlineUrl : undefined,
  }));
  const itemById = new Map(props.items.map((item) => [item.id, item]));

  const [currentSortField, currentSortDirection] = props.sort.split(':') as [string, 'asc' | 'desc'];
  const sortColumn = (field: 'name' | 'created' | 'size', label: string, defaultDirection: 'asc' | 'desc') => ({
    ariaLabel: labels.sortBy(label),
    direction: currentSortField === field ? currentSortDirection : undefined,
    onToggle: () => {
      const direction =
        currentSortField === field ? (currentSortDirection === 'asc' ? 'desc' : 'asc') : defaultDirection;
      props.onSortChange(`${field}:${direction}`);
    },
  });
  const listColumns: DataTableViewColumn<FileManagerRow>[] = [
    {
      key: 'icon',
      header: '',
      width: 40,
      minWidth: 40,
      renderCell: (item) => <ItemThumbnail item={item} />,
    },
    {
      key: 'name',
      header: labels.name,
      minWidth: 180,
      sort: sortColumn('name', labels.name, 'asc'),
      renderCell: (item) => (
        <Text fw={500} size="sm" truncate title={itemDisplayName(item)}>
          {itemDisplayName(item)}
        </Text>
      ),
    },
    ...(props.searching
      ? [
          {
            key: 'location',
            header: labels.location,
            minWidth: 220,
            renderCell: (item: FileManagerRow) => (
              <Text size="xs" c="dimmed" truncate>
                {itemLocation(item, labels.root)}
              </Text>
            ),
          },
        ]
      : []),
    {
      key: 'type',
      header: labels.type,
      minWidth: 130,
      renderCell: (item) => (
        <Text size="xs" c="dimmed" truncate>
          {item.kind === 'folder' ? labels.folderType : item.mimeType}
        </Text>
      ),
    },
    {
      key: 'size',
      header: labels.size,
      width: 90,
      minWidth: 90,
      sort: sortColumn('size', labels.size, 'desc'),
      renderCell: (item) => (
        <Text size="xs" c="dimmed" ta="right" truncate>
          {item.kind === 'folder' ? '—' : formatFileSize(item.fileSize)}
        </Text>
      ),
    },
    {
      key: 'created',
      header: labels.uploadedAt,
      width: 110,
      minWidth: 110,
      sort: sortColumn('created', labels.uploadedAt, 'desc'),
      renderCell: (item) => (
        <Text size="xs" c="dimmed" truncate>
          <DateTime value={item.createdAt} fallback="—" />
        </Text>
      ),
    },
    {
      key: 'member',
      header: labels.uploadedBy,
      minWidth: 120,
      renderCell: (item) => (
        <Text size="xs" c="dimmed" truncate>
          {itemMemberName(item, labels)}
        </Text>
      ),
    },
    {
      key: 'usages',
      header: labels.usageStatus,
      width: 64,
      minWidth: 64,
      renderCell: (item) => {
        if (item.kind === 'folder') {
          return (
            <Text size="xs" c="dimmed">
              —
            </Text>
          );
        }
        const inUse = item.usageCount > 0;
        const status = inUse ? labels.inUse : labels.notInUse;
        return (
          <FileBrowserTooltip label={status}>
            <Box
              component="span"
              c={inUse ? 'blue' : 'dimmed'}
              role="img"
              aria-label={status}
              className={classes.usageStatus}
            >
              {inUse ? <IconLink size={16} /> : <IconLinkOff size={16} />}
            </Box>
          </FileBrowserTooltip>
        );
      },
    },
  ];

  return (
    <Stack gap="lg" data-file-manager-view data-view={props.viewMode}>
      <FileBrowserHeader
        labels={labels}
        path={props.path}
        query={props.query}
        mimeTypePrefix={props.mimeTypePrefix}
        sort={props.sort}
        viewMode={props.viewMode}
        searching={props.searching}
        canManage={props.role === 'admin'}
        batchActionsDisabled={!onlyFilesSelected}
        mutationLoading={props.mutationLoading}
        onOpenPath={props.onOpenPath}
        onQueryChange={props.onQueryChange}
        onMimeTypePrefixChange={props.onMimeTypePrefixChange}
        onSortChange={props.onSortChange}
        onViewModeChange={props.onViewModeChange}
        onMoveSelectedFiles={props.onMoveSelectedFiles}
        onDeleteSelectedFiles={props.onDeleteSelectedFiles}
        onCreateFolder={props.onCreateFolder}
        onUploadRequested={props.onUploadRequested}
      />

      {props.uploadPercentage != null ? (
        <Stack gap={4}>
          <Text size="sm">{labels.uploadProgress(props.uploadPercentage)}</Text>
          <Progress value={props.uploadPercentage} />
        </Stack>
      ) : null}
      {props.error ? <Text c="red">{props.error}</Text> : null}

      {props.movePendingLabel ? (
        <Paper withBorder radius={0} p="sm" data-file-move-mode>
          <Group justify="space-between" align="center">
            <Stack gap={2}>
              <Text fw={600}>{props.movePendingLabel}</Text>
              <Text size="sm" c="dimmed">
                {labels.chooseDestination} · {currentLocation}
              </Text>
            </Stack>
            <Group>
              <Button tone="neutral" emphasis="low" onClick={props.onCancelMove} disabled={props.mutationLoading}>
                {labels.cancel}
              </Button>
              <Button onClick={props.onConfirmMoveHere} loading={props.mutationLoading}>
                {labels.moveHere}
              </Button>
            </Group>
          </Group>
        </Paper>
      ) : null}

      {props.loading ? (
        <Center mih={320}>
          <Loader aria-label={labels.title} />
        </Center>
      ) : props.folderNotFound ? (
        <Paper withBorder radius={0} mih={260} p="xl" data-file-folder-not-found>
          <Center h="100%" mih={210}>
            <Stack align="center" gap="sm">
              <IconFolder size={48} stroke={1.1} aria-hidden />
              <Text c="dimmed">{labels.folderNotFound}</Text>
              <Button tone="neutral" emphasis="low" onClick={props.onReturnToRoot}>
                {labels.returnToRoot}
              </Button>
            </Stack>
          </Center>
        </Paper>
      ) : props.items.length === 0 ? (
        <Paper withBorder radius={0} mih={260} p="xl">
          <Center h="100%" mih={210}>
            <Stack align="center" gap="sm">
              <IconFolder size={56} stroke={1.1} aria-hidden />
              <Text c="dimmed">{labels.empty}</Text>
            </Stack>
          </Center>
        </Paper>
      ) : (
        <Box
          ref={selection.surfaceRef}
          className={classes.viewerSurface}
          data-file-viewer-surface
          onClick={selection.clearSurfaceSelection}
          onContextMenu={selection.openSurfaceContextMenu}
          onPointerDown={selection.startMarquee}
          onPointerMove={selection.updateMarquee}
          onPointerUp={selection.finishMarquee}
          onPointerCancel={selection.finishMarquee}
        >
          {props.viewMode === 'grid' ? (
            <FileBrowserGridView
              items={gridItems}
              selectedItemIds={props.selectedItemIds}
              renderActions={(gridItem) => {
                const item = itemById.get(gridItem.id);
                return item ? <ItemActions item={item} props={props} /> : null;
              }}
              onItemClick={(event, gridItem, index) => {
                const item = itemById.get(gridItem.id);
                if (item) {
                  selection.selectItem(event, item, index);
                }
              }}
              onItemDoubleClick={(_event, gridItem) => {
                const item = itemById.get(gridItem.id);
                if (item) {
                  selection.activateItem(item);
                }
              }}
              onItemContextMenu={(event, gridItem, index) => {
                const item = itemById.get(gridItem.id);
                if (item) {
                  selection.openItemContextMenu(event, item, index);
                }
              }}
              onItemKeyDown={(event, gridItem, index) => {
                const item = itemById.get(gridItem.id);
                if (item) {
                  selection.handleItemKeyDown(event, item, index);
                }
              }}
            />
          ) : (
            <Box className={classes.listView} data-file-viewer-list>
              <DataTableView
                rows={props.items}
                columns={listColumns}
                getRowKey={(item) => item.id}
                emptyMessage={labels.empty}
                highlightOnHover
                selection={{
                  selectedRowKeys: props.selectedItemIds,
                  onSelectedRowKeysChange: selection.changeTableSelection,
                  getRowLabel: (item) => labels.selectItem(itemDisplayName(item)),
                  selectAllRowsLabel: labels.selectAll,
                }}
                rowInteraction={{
                  isSelected: (item) => props.selectedItemIds.includes(item.id),
                  onClick: (event, item, index) => selection.selectItem(event, item, index),
                  onDoubleClick: (_event, item) => selection.activateItem(item),
                  onContextMenu: (event, item, index) => selection.openItemContextMenu(event, item, index),
                  onKeyDown: (event, item, index) => selection.handleItemKeyDown(event, item, index),
                }}
              />
            </Box>
          )}
          {marqueeRect ? (
            <Box
              className={classes.marquee}
              style={{
                left: marqueeRect.left,
                top: marqueeRect.top,
                width: marqueeRect.width,
                height: marqueeRect.height,
              }}
              aria-hidden
            />
          ) : null}
        </Box>
      )}

      {props.hasMoreItems ? (
        <Button
          tone="neutral"
          emphasis="low"
          loading={props.itemsLoadingMore}
          onClick={props.onLoadMoreItems}
          style={{ alignSelf: 'center' }}
        >
          {labels.loadMore}
        </Button>
      ) : null}

      <FileBrowserStatusBar
        status={
          props.searching
            ? labels.searchResultCount(props.total)
            : selectedItems.length > 0
              ? labels.selectedCount(selectedItems.length)
              : labels.itemCount(props.total)
        }
      />

      {contextMenu ? (
        <DropdownMenu
          opened
          onChange={(opened) => {
            if (!opened) {
              selection.setContextMenu(null);
            }
          }}
          placement="bottom-start"
        >
          <DropdownMenu.Target>
            <Box className={classes.contextTarget} style={{ left: contextMenu.x, top: contextMenu.y }} aria-hidden />
          </DropdownMenu.Target>
          <DropdownMenu.Dropdown>
            {contextItem ? (
              <>
                <DropdownMenu.Item
                  icon={contextItem.kind === 'folder' ? <IconFolderOpen size={16} /> : <IconEye size={16} />}
                  onClick={selection.openContextItem}
                >
                  {contextItem.kind === 'folder' ? labels.open : labels.preview}
                </DropdownMenu.Item>
                {contextItem.kind === 'file' && contextItem.downloadUrl ? (
                  <DropdownMenu.Item
                    component="a"
                    href={contextItem.downloadUrl}
                    icon={<IconDownload size={16} />}
                    onClick={() => selection.setContextMenu(null)}
                  >
                    {labels.download}
                  </DropdownMenu.Item>
                ) : null}
                {props.role === 'admin' && selectedItems.length === 1 ? (
                  <DropdownMenu.Item
                    icon={<IconPencil size={16} />}
                    onClick={() => {
                      contextItem.kind === 'folder'
                        ? props.onRenameFolder(contextItem)
                        : props.onRenameFile(contextItem);
                      selection.setContextMenu(null);
                    }}
                  >
                    {labels.rename}
                  </DropdownMenu.Item>
                ) : props.role === 'author' && selectedItems.length === 1 ? (
                  <AdminOnlyMenuItem labels={labels} icon={<IconPencil size={16} />}>
                    {labels.rename}
                  </AdminOnlyMenuItem>
                ) : null}
                {props.role === 'admin' && onlyFilesSelected ? (
                  <>
                    <DropdownMenu.Item
                      icon={<IconFolder size={16} />}
                      onClick={() => {
                        props.onMoveSelectedFiles();
                        selection.setContextMenu(null);
                      }}
                    >
                      {labels.move}
                    </DropdownMenu.Item>
                    <DropdownMenu.Divider />
                    <DropdownMenu.Item
                      tone="danger"
                      icon={<IconTrash size={16} />}
                      onClick={() => {
                        props.onDeleteSelectedFiles();
                        selection.setContextMenu(null);
                      }}
                    >
                      {labels.delete}
                    </DropdownMenu.Item>
                  </>
                ) : props.role === 'admin' && contextItem.kind === 'folder' && selectedItems.length === 1 ? (
                  <>
                    <DropdownMenu.Item
                      icon={<IconFolder size={16} />}
                      onClick={() => {
                        props.onMoveFolder(contextItem);
                        selection.setContextMenu(null);
                      }}
                    >
                      {labels.move}
                    </DropdownMenu.Item>
                    <DropdownMenu.Divider />
                    <DropdownMenu.Item
                      tone="danger"
                      icon={<IconTrash size={16} />}
                      onClick={() => {
                        props.onDeleteFolder(contextItem);
                        selection.setContextMenu(null);
                      }}
                    >
                      {labels.delete}
                    </DropdownMenu.Item>
                  </>
                ) : props.role === 'author' && (onlyFilesSelected || selectedItems.length === 1) ? (
                  <>
                    <AdminOnlyMenuItem labels={labels} icon={<IconFolder size={16} />}>
                      {labels.move}
                    </AdminOnlyMenuItem>
                    <DropdownMenu.Divider />
                    <AdminOnlyMenuItem labels={labels} tone="danger" icon={<IconTrash size={16} />}>
                      {labels.delete}
                    </AdminOnlyMenuItem>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <DropdownMenu.Item
                  icon={<IconUpload size={16} />}
                  onClick={() => {
                    props.onUploadRequested();
                    selection.setContextMenu(null);
                  }}
                >
                  {labels.upload}
                </DropdownMenu.Item>
                {props.role === 'admin' ? (
                  <DropdownMenu.Item
                    icon={<IconFolderPlus size={16} />}
                    onClick={() => {
                      props.onCreateFolder();
                      selection.setContextMenu(null);
                    }}
                  >
                    {labels.newFolder}
                  </DropdownMenu.Item>
                ) : (
                  <AdminOnlyMenuItem labels={labels} icon={<IconFolderPlus size={16} />}>
                    {labels.newFolder}
                  </AdminOnlyMenuItem>
                )}
              </>
            )}
          </DropdownMenu.Dropdown>
        </DropdownMenu>
      ) : null}

      <ContentModal
        opened={Boolean(props.detailFile)}
        onClose={props.onCloseFile}
        title={props.detailFile ? fileDisplayName(props.detailFile) : labels.name}
        closeLabel={labels.close}
        size="large"
        centered
      >
        {props.detailFile ? (
          <Stack gap="lg">
            <Box mih={160} style={{ display: 'grid', placeItems: 'center' }}>
              <FilePreview file={props.detailFile} />
            </Box>
            <Stack gap="xs">
              <Text>
                <strong>{labels.type}:</strong> {props.detailFile.mimeType}
              </Text>
              <Text>
                <strong>{labels.size}:</strong> {formatFileSize(props.detailFile.fileSize)}
              </Text>
              <Text>
                <strong>{labels.uploadedBy}:</strong> {itemMemberName(props.detailFile, labels)}
              </Text>
              <Text>
                <strong>{labels.uploadedAt}:</strong> <DateTime value={props.detailFile.createdAt} fallback="—" />
              </Text>
            </Stack>
            {props.detailUsages && props.detailUsages.length > 0 ? (
              <Stack gap="xs">
                <Text fw={600}>{labels.usages}</Text>
                {props.detailUsages.map((usage, index) => (
                  <Box key={`${usage.domain}-${usage.entityId}-${usage.slot}-${usage.blockId ?? ''}-${index}`}>
                    {usage.link ? (
                      <TextButton href={usage.link} appearance="accent" size="sm">
                        {usageDisplayLabel(usage, labels)}
                      </TextButton>
                    ) : (
                      <Text size="sm">{usageDisplayLabel(usage, labels)}</Text>
                    )}
                  </Box>
                ))}
                {props.hasMoreDetailUsages ? (
                  <Button
                    tone="neutral"
                    emphasis="low"
                    onClick={props.onLoadMoreDetailUsages}
                    loading={props.detailLoading}
                  >
                    {labels.loadMore}
                  </Button>
                ) : null}
              </Stack>
            ) : props.detailLoading ? (
              <Center py="md">
                <Loader size="sm" aria-label={labels.usages} />
              </Center>
            ) : (
              <Stack gap={4}>
                <Text fw={600}>{labels.usages}</Text>
                <Text size="sm" c="dimmed">
                  {props.detailFile.usageCount > 0 ? labels.inUse : labels.notInUse}
                </Text>
              </Stack>
            )}
            {props.detailFile.generatedOutputs && props.detailFile.generatedOutputs.length > 0 ? (
              <Stack gap="xs">
                <Text fw={600}>{labels.generatedOutputs}</Text>
                {props.detailFile.generatedOutputs.map((output) => {
                  const label = labels.generatedOutputTypes[output.type] ?? String(output.type);
                  const status = labels.processingStatuses[output.status] ?? String(output.status);
                  return output.url ? (
                    <TextButton key={output.id} href={output.url} appearance="accent" size="sm">
                      {label} · {status}
                    </TextButton>
                  ) : (
                    <Text key={output.id} size="sm">
                      {label} · {status}
                    </Text>
                  );
                })}
              </Stack>
            ) : null}
            {props.detailFile.downloadUrl ? (
              <Button component="a" href={props.detailFile.downloadUrl} leftSection={<IconDownload size={18} />}>
                {labels.download}
              </Button>
            ) : null}
          </Stack>
        ) : null}
      </ContentModal>
    </Stack>
  );
}
