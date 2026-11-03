'use client';
import { SupportingText, Text as DsText } from '@/components/core/Typography';
import type { FileBrowserViewOptions } from './ui/file-browser-view-settings';

import { MetadataPair } from '@/components/core/PublicMetadata';
import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';
import { useId, type MouseEvent } from 'react';
import {
  IconDots,
  IconDownload,
  IconEye,
  IconFolder,
  IconFolderOpen,
  IconFolderPlus,
  IconPencil,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { FileDerivativeType, FileUsageDomain } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { SectionCard } from '@/components/core/Section';
import { SelectionEmptyState, SelectionViewport, SelectionMarquee } from '@/components/core/SelectionSurface';
import { NearEndLoader, type NearEndLoaderLabels } from '@/components/core/Display';
import { Button } from '@/components/core/Button';
import { DateTime } from '@/features/date-time/DateTime';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { IconButton } from '@/components/core/IconButton';
import { ContentModal, DialogActions } from '@/components/core/Modal';
import { Progress } from '@/components/core/Progress';
import { TextButton } from '@/components/core/TextButton';
import { FilePreview } from '@/features/media/FilePreview';
import { PageLoader } from '@/features/site/PageLoader';
import classes from './FileManagerView.module.css';
import type { FileManagerFileView, FileManagerItemView, FileManagerUsageItemView } from './model';
import { FileBrowserGridView } from './ui/FileBrowserGridView';
import {
  fileBrowserListPresentation,
  fileBrowserSizeLabel as formatFileSize,
  fileUsageLabel,
} from './file-browser-presentation';
import { fileBrowserContentInset } from './ui/file-browser-layout';
import { FileBrowserListView } from './ui/FileBrowserListView';
import { FileBrowserHeader } from './ui/FileBrowserHeader';
import { FileBrowserStatusBar } from './ui/FileBrowserStatusBar';
import { FileBrowserTooltip } from './ui/FileBrowserTooltip';
import { useFileManagerSelection } from './useFileManagerSelection';
import { EmptyState } from '@/components/core/EmptyState';

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
  back: string;
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
  viewMode: string;
  loadMore: string;
  pagination: NearEndLoaderLabels;
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
  itemsNextPageKey?: string;
  itemsLoadingMore?: boolean;
  itemsLoadMoreError?: string | null;
  query: string;
  mimeTypePrefix: string;
  sort: string;
  viewMode: FileManagerViewMode;
  viewOptions?: FileBrowserViewOptions;
  selectedItemIds: string[];
  detailFile?: FileManagerFileRow | null;
  detailUsages?: FileManagerUsageView[];
  detailLoading?: boolean;
  detailUsageError?: string | null;
  deletionInspecting?: boolean;
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
  onDeleteSelectedFiles: () => void | Promise<void>;
  onConfirmMoveHere: () => void;
  onCancelMove: () => void;
  onLoadMoreDetailUsages: () => void;
  onLoadMoreItems: () => Promise<void>;
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

function stopItemActivation(event: MouseEvent<HTMLElement>) {
  event.stopPropagation();
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
          <DropdownMenu.Item href={file.downloadUrl} icon={<IconDownload size={16} />}>
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
            <DropdownMenu.Item disabled title={labels.adminOnly} icon={<IconPencil size={16} />}>
              {labels.rename}
            </DropdownMenu.Item>
            {item.kind === 'folder' ? (
              <>
                <DropdownMenu.Item disabled title={labels.adminOnly} icon={<IconFolder size={16} />}>
                  {labels.move}
                </DropdownMenu.Item>
                <DropdownMenu.Divider />
                <DropdownMenu.Item disabled title={labels.adminOnly} tone="danger" icon={<IconTrash size={16} />}>
                  {labels.delete}
                </DropdownMenu.Item>
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
  const moveDescriptionId = useId();
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

  return (
    <DsLayoutStack
      gap="sm"
      data-file-manager-view
      data-view={props.viewMode}
      role="region"
      aria-label={labels.title}
      aria-busy={props.loading || props.itemsLoadingMore || props.mutationLoading || false}
    >
      <FileBrowserHeader
        labels={labels}
        path={props.path}
        query={props.query}
        mimeTypePrefix={props.mimeTypePrefix}
        sort={props.sort}
        viewMode={props.viewMode}
        viewOptions={props.viewOptions}
        searching={props.searching}
        canManage={props.role === 'admin'}
        batchActionsDisabled={!onlyFilesSelected}
        mutationLoading={props.mutationLoading}
        deletionInspecting={props.deletionInspecting}
        uploadPending={props.uploadPercentage != null}
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
        <DsLayoutStack gap="xxs">
          <SupportingText tone="primary">{labels.uploadProgress(props.uploadPercentage)}</SupportingText>
          <Progress value={props.uploadPercentage} aria-label={labels.upload} />
        </DsLayoutStack>
      ) : null}
      {props.error ? (
        <DsText size="sm" tone="danger" role="alert">
          {props.error}
        </DsText>
      ) : null}

      {props.movePendingLabel ? (
        <SectionCard
          padding="sm"
          data-file-move-mode
          role="group"
          aria-label={labels.move}
          aria-describedby={moveDescriptionId}
        >
          <DsLayoutInline justify="between" align="center">
            <DsLayoutStack gap="xxs">
              <DsText weight="strong">{props.movePendingLabel}</DsText>
              <SupportingText id={moveDescriptionId} tone="secondary" role="status" aria-atomic="true">
                {labels.chooseDestination} · {currentLocation}
              </SupportingText>
            </DsLayoutStack>
            <DsLayoutInline>
              <Button tone="neutral" emphasis="low" onClick={props.onCancelMove} disabled={props.mutationLoading}>
                {labels.cancel}
              </Button>
              <Button onClick={props.onConfirmMoveHere} loading={props.mutationLoading}>
                {labels.moveHere}
              </Button>
            </DsLayoutInline>
          </DsLayoutInline>
        </SectionCard>
      ) : null}

      {props.loading ? (
        <div style={{ position: 'relative', minHeight: 320 }}>
          <PageLoader extent="tall" />
        </div>
      ) : props.folderNotFound ? (
        <SectionCard padding="xl" data-file-folder-not-found>
          <SelectionEmptyState>
            <EmptyState
              inset="none"
              icon={IconFolder}
              title={labels.folderNotFound}
              action={
                <Button tone="neutral" emphasis="low" onClick={props.onReturnToRoot}>
                  {labels.returnToRoot}
                </Button>
              }
            />
          </SelectionEmptyState>
        </SectionCard>
      ) : props.error && props.items.length === 0 ? null : props.items.length === 0 ? (
        <SectionCard padding="xl">
          <SelectionEmptyState>
            <EmptyState inset="none" icon={IconFolder} title={labels.empty} />
          </SelectionEmptyState>
        </SectionCard>
      ) : (
        <SelectionViewport
          inset="none"
          ref={selection.surfaceRef}
          data-file-viewer-surface
          onClick={selection.clearSurfaceSelection}
          onContextMenu={selection.openSurfaceContextMenu}
          onPointerDown={selection.startMarquee}
          onPointerMove={selection.updateMarquee}
          onPointerUp={selection.finishMarquee}
          onPointerCancel={selection.finishMarquee}
        >
          <DsLayoutInset
            inline={fileBrowserContentInset}
            block={props.viewMode === 'grid' ? 'xs' : 'none'}
            data-file-browser-content-inset
          >
            {props.viewMode === 'grid' ? (
              <FileBrowserGridView
                label={props.labels.title}
                columns={props.viewOptions?.value.columns}
                iconSize={props.viewOptions?.value.iconSize}
                spacing={props.viewOptions?.value.spacing}
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
              <div className={classes.listView} data-file-viewer-list>
                <FileBrowserListView
                  accessibleLabel={`${labels.title} · ${labels.listView}`}
                  labels={labels}
                  getPresentation={(item) =>
                    fileBrowserListPresentation(
                      item,
                      itemDisplayName(item),
                      labels.folderType,
                      props.searching ? itemLocation(item, labels.root) : undefined,
                    )
                  }
                  showLocation={props.searching}
                  nameSort={sortColumn('name', labels.name, 'asc')}
                  sizeSort={sortColumn('size', labels.size, 'desc')}
                  rows={props.items}
                  getRowKey={(item) => item.id}
                  emptyMessage={labels.empty}
                  highlightOnHover
                  selection={{
                    selectedRowKeys: props.selectedItemIds,
                    onSelectedRowKeysChange: (ids) => selection.changeTableSelection(ids, false),
                    onRowSelectionClick: (event, item, index) => {
                      if (event.shiftKey) {
                        selection.selectItem(event, item, index);
                      } else {
                        selection.anchorItem(item);
                      }
                    },
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
              </div>
            )}
          </DsLayoutInset>
          {marqueeRect ? <SelectionMarquee rect={marqueeRect} /> : null}
        </SelectionViewport>
      )}

      {props.searching && !props.loading ? (
        <DsLayoutInset inline={fileBrowserContentInset} block="none">
          <NearEndLoader
            pageKey={props.hasMoreItems ? (props.itemsNextPageKey ?? null) : null}
            resetKey={JSON.stringify([props.query.trim(), props.mimeTypePrefix, props.sort, props.path])}
            loading={props.itemsLoadingMore}
            error={props.itemsLoadMoreError}
            labels={labels.pagination}
            onLoad={props.onLoadMoreItems}
          />
        </DsLayoutInset>
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
          <DropdownMenu.Anchor x={contextMenu.x} y={contextMenu.y} />
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
                  <DropdownMenu.Item disabled title={labels.adminOnly} icon={<IconPencil size={16} />}>
                    {labels.rename}
                  </DropdownMenu.Item>
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
                    <DropdownMenu.Item disabled title={labels.adminOnly} icon={<IconFolder size={16} />}>
                      {labels.move}
                    </DropdownMenu.Item>
                    <DropdownMenu.Divider />
                    <DropdownMenu.Item disabled title={labels.adminOnly} tone="danger" icon={<IconTrash size={16} />}>
                      {labels.delete}
                    </DropdownMenu.Item>
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
                  <DropdownMenu.Item disabled title={labels.adminOnly} icon={<IconFolderPlus size={16} />}>
                    {labels.newFolder}
                  </DropdownMenu.Item>
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
          <DsLayoutStack gap="lg">
            <SelectionEmptyState>
              <FilePreview file={props.detailFile} />
            </SelectionEmptyState>
            <DsLayoutStack gap="xs">
              <MetadataPair label={`${labels.type}:`}>{props.detailFile.mimeType}</MetadataPair>
              <MetadataPair label={`${labels.size}:`}>{formatFileSize(props.detailFile.fileSize)}</MetadataPair>
              <MetadataPair label={`${labels.uploadedBy}:`}>{itemMemberName(props.detailFile, labels)}</MetadataPair>
              <MetadataPair label={`${labels.uploadedAt}:`}>
                <DateTime value={props.detailFile.createdAt} fallback="—" />
              </MetadataPair>
            </DsLayoutStack>
            {(props.detailUsages && props.detailUsages.length > 0) || props.hasMoreDetailUsages ? (
              <DsLayoutStack gap="xs">
                <DsText weight="strong">{labels.usages}</DsText>
                {props.detailUsages?.map((usage, index) => (
                  <div key={`${usage.domain}-${usage.entityId}-${usage.slot}-${usage.blockId ?? ''}-${index}`}>
                    {usage.link ? (
                      <TextButton href={usage.link} appearance="accent" size="sm">
                        {fileUsageLabel(usage, labels)}
                      </TextButton>
                    ) : (
                      <DsText size="sm">{fileUsageLabel(usage, labels)}</DsText>
                    )}
                  </div>
                ))}
                {props.hasMoreDetailUsages ? (
                  <DsLayoutInline justify="center" gap="none">
                    <Button
                      tone="neutral"
                      emphasis="low"
                      onClick={props.onLoadMoreDetailUsages}
                      loading={props.detailLoading}
                    >
                      {labels.loadMore}
                    </Button>
                  </DsLayoutInline>
                ) : null}
              </DsLayoutStack>
            ) : props.detailLoading ? (
              <PageLoader extent="compact" placement="flow" size="sm" />
            ) : props.detailUsageError ? (
              <DsText role="alert" size="sm" tone="danger">
                {props.detailUsageError}
              </DsText>
            ) : (
              <MetadataPair label={labels.usages} layout="stacked">
                <SupportingText tone="secondary">
                  {props.detailFile.usageCount > 0 ? labels.inUse : labels.notInUse}
                </SupportingText>
              </MetadataPair>
            )}
            {props.detailFile.generatedOutputs && props.detailFile.generatedOutputs.length > 0 ? (
              <DsLayoutStack gap="xs">
                <DsText weight="strong">{labels.generatedOutputs}</DsText>
                {props.detailFile.generatedOutputs.map((output) => {
                  const label = labels.generatedOutputTypes[output.type] ?? String(output.type);
                  const status = labels.processingStatuses[output.status] ?? String(output.status);
                  return output.url ? (
                    <TextButton key={output.id} href={output.url} appearance="accent" size="sm">
                      {label} · {status}
                    </TextButton>
                  ) : (
                    <DsText key={output.id} size="sm">
                      {label} · {status}
                    </DsText>
                  );
                })}
              </DsLayoutStack>
            ) : null}
            {props.detailFile.downloadUrl ? (
              <DialogActions>
                <Button href={props.detailFile.downloadUrl} leftSection={<IconDownload size={18} />}>
                  {labels.download}
                </Button>
              </DialogActions>
            ) : null}
          </DsLayoutStack>
        ) : null}
      </ContentModal>
    </DsLayoutStack>
  );
}
