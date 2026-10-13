'use client';
import { useFileBrowserViewSettings } from './useFileBrowserViewSettings';
import { fileBrowserViewSettingsLabels } from './ui/file-browser-view-settings';
import { useTranslations } from 'next-intl';
import { ConfirmationDialog } from '@/features/confirmation';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileUsageDomain, UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { notifications } from '@/components/core/Notification';
import { FormModal } from '@/components/core/Modal';
import { FilePicker, TextInput } from '@/components/core/Input';
import {
  createFileFolderAction,
  deleteFileFolderAction,
  deleteManagedFilesAction,
  getFileDeletionImpactAction,
  getManagedFileAction,
  listFileManagerItemsAction,
  listManagedFileUsagesAction,
  moveFileFolderAction,
  moveManagedFilesAction,
  renameFileFolderAction,
  renameManagedFileAction,
  searchFileManagerItemsAction,
  type FileDeletionImpactView,
  type FileManagerFileRow as FileManagerActionFileRow,
  type FileManagerRow as FileManagerActionRow,
  type FileManagerUsageView as FileManagerActionUsageView,
} from '@/lib/actions/file';
import { useFileUpload } from '@/lib/hooks/useFileUpload';
import { FileManagerView, type FileManagerPathItem } from './FileManagerView';
import { useFileManagerI18n } from './i18n';
import { parseFileBrowserSort } from './sort';
import type {
  FileManagerFileView,
  FileManagerFolderView,
  FileManagerItemView,
  FileManagerUsageItemView,
} from './model';

function toFileManagerItemView(item: FileManagerActionRow): FileManagerItemView {
  return { ...item };
}

function toFileManagerFileView(file: FileManagerActionFileRow): FileManagerFileView {
  return { ...file };
}

function toFileManagerUsageItemView(usage: FileManagerActionUsageView): FileManagerUsageItemView {
  return { ...usage };
}

type FormOperation =
  | { kind: 'create-folder'; value: string }
  | { kind: 'rename-folder'; folder: FileManagerFolderView; value: string }
  | { kind: 'rename-file'; file: FileManagerFileView; value: string };

type MoveOperation = { kind: 'folder'; folder: FileManagerFolderView } | { kind: 'files'; fileIds: string[] };

type DeleteOperation =
  | { kind: 'folder'; folder: FileManagerFolderView }
  | { kind: 'files'; fileIds: string[]; impacts: FileDeletionImpactView[] };

const deletionImpactPreviewSize = 5;

export function FileManager({ viewerRole }: { viewerRole: 'author' | 'admin' }) {
  const tViewSettings = useTranslations('fileManager.viewSettings');
  const { labels, errorMessage, message: t } = useFileManagerI18n();
  const listRequestRef = useRef(0);
  const moreRequestRef = useRef<string | null>(null);
  const detailRequestRef = useRef(0);
  const { upload } = useFileUpload();
  const [items, setItems] = useState<FileManagerItemView[]>([]);
  const [total, setTotal] = useState(0);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [path, setPath] = useState<FileManagerPathItem[]>([{ name: t('root') }]);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [mimeTypePrefix, setMimeTypePrefix] = useState('');
  const [sort, setSort] = useState('name:asc');
  const { settings: viewSettings, change: changeViewSettings } = useFileBrowserViewSettings();
  const viewMode = viewSettings.viewMode;
  const setViewMode = (mode: 'grid' | 'list') => changeViewSettings({ ...viewSettings, viewMode: mode });
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [detailFile, setDetailFile] = useState<FileManagerFileView | null>(null);
  const [detailUsages, setDetailUsages] = useState<FileManagerUsageItemView[]>([]);
  const [detailUsageNextPageToken, setDetailUsageNextPageToken] = useState<string | undefined>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [formOperation, setFormOperation] = useState<FormOperation | null>(null);
  const [moveOperation, setMoveOperation] = useState<MoveOperation | null>(null);
  const [deleteOperation, setDeleteOperation] = useState<DeleteOperation | null>(null);
  const [loading, setLoading] = useState(true);
  const [itemsLoadingMore, setItemsLoadingMore] = useState(false);
  const [itemsLoadMoreError, setItemsLoadMoreError] = useState<string | null>(null);
  const [mutationLoading, setMutationLoading] = useState(false);
  const [uploadPercentage, setUploadPercentage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folderNotFound, setFolderNotFound] = useState(false);

  const currentFolderID = path.at(-1)?.id;
  const sortInput = useMemo(() => parseFileBrowserSort(sort), [sort]);
  const selectedFileIds = useMemo(
    () =>
      items
        .filter((item): item is FileManagerFileView => item.kind === 'file' && selectedItemIds.includes(item.id))
        .map((item) => item.id),
    [items, selectedItemIds],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setAppliedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadItems = useCallback(async () => {
    const requestId = listRequestRef.current + 1;
    listRequestRef.current = requestId;
    moreRequestRef.current = null;
    setLoading(true);
    setItemsLoadingMore(false);
    setItemsLoadMoreError(null);
    setError(null);
    setFolderNotFound(false);
    setItems([]);
    setTotal(0);
    setNextPageToken(undefined);
    setSelectedItemIds([]);
    try {
      if (appliedQuery) {
        const result = await searchFileManagerItemsAction({
          query: appliedQuery,
          mimeTypePrefix,
          ...sortInput,
        });
        if (listRequestRef.current !== requestId) {
          return;
        }
        setItems(result.items.map(toFileManagerItemView));
        setTotal(result.total);
        setNextPageToken(result.nextPageToken);
      } else {
        const result = await listFileManagerItemsAction({
          folderId: currentFolderID,
          mimeTypePrefix,
          ...sortInput,
        });
        if (listRequestRef.current !== requestId) {
          return;
        }
        setFolderNotFound(result.folderNotFound);
        setItems(result.items.map(toFileManagerItemView));
        setTotal(result.total);
      }
    } catch {
      if (listRequestRef.current !== requestId) {
        return;
      }
      setError(errorMessage('load'));
    } finally {
      if (listRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [appliedQuery, currentFolderID, errorMessage, mimeTypePrefix, sortInput]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const loadMoreItems = async () => {
    if (
      !appliedQuery ||
      query.trim() !== appliedQuery ||
      !nextPageToken ||
      loading ||
      itemsLoadingMore ||
      moreRequestRef.current !== null
    ) {
      return;
    }
    const requestId = listRequestRef.current;
    const pageKey = JSON.stringify([requestId, nextPageToken]);
    moreRequestRef.current = pageKey;
    setItemsLoadingMore(true);
    setItemsLoadMoreError(null);
    try {
      const result = await searchFileManagerItemsAction({
        query: appliedQuery,
        mimeTypePrefix,
        ...sortInput,
        pageToken: nextPageToken,
      });
      if (listRequestRef.current !== requestId) {
        return;
      }
      if (result.nextPageToken === nextPageToken) {
        throw new Error('File search returned the same continuation cursor');
      }
      setItems((current) => [
        ...new Map(
          [...current, ...result.items.map(toFileManagerItemView)].map((item) => [`${item.kind}:${item.id}`, item]),
        ).values(),
      ]);
      setTotal(result.total);
      setNextPageToken(result.nextPageToken);
    } catch {
      if (listRequestRef.current === requestId) {
        setItemsLoadMoreError(errorMessage('load'));
      }
    } finally {
      if (listRequestRef.current === requestId && moreRequestRef.current === pageKey) {
        moreRequestRef.current = null;
        setItemsLoadingMore(false);
      }
    }
  };

  const closeFile = () => {
    detailRequestRef.current += 1;
    setDetailFile(null);
    setDetailUsages([]);
    setDetailUsageNextPageToken(undefined);
    setDetailLoading(false);
  };

  const openFolder = (folder: FileManagerFolderView) => {
    setFolderNotFound(false);
    if (appliedQuery && folder.folderPath?.length) {
      setPath([{ name: t('root') }, ...folder.folderPath]);
    } else {
      setPath((previous) => [...previous, { id: folder.id, name: folder.name }]);
    }
    setQuery('');
    setAppliedQuery('');
    setSelectedItemIds([]);
    closeFile();
  };

  const openPath = (index: number) => {
    setFolderNotFound(false);
    setPath((previous) => previous.slice(0, index + 1));
    setQuery('');
    setAppliedQuery('');
    setSelectedItemIds([]);
    closeFile();
  };

  const showMutationFailure = (errorCode?: Parameters<typeof errorMessage>[0]) =>
    notifications.show({ tone: 'danger', message: errorMessage(errorCode ?? 'mutation') });

  const openFile = async (file: FileManagerFileView) => {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setDetailFile(file);
    setDetailUsages([]);
    setDetailUsageNextPageToken(undefined);
    setDetailLoading(true);
    const [detailResult, usageResult] = await Promise.all([
      getManagedFileAction(file.id),
      listManagedFileUsagesAction({ fileId: file.id, pageSize: 25 }),
    ]);
    if (detailRequestRef.current !== requestId) {
      return;
    }
    if (detailResult.success) {
      setDetailFile(toFileManagerFileView(detailResult.file));
    }
    if (usageResult.success) {
      setDetailUsages(usageResult.usages.map(toFileManagerUsageItemView));
      setDetailUsageNextPageToken(usageResult.nextPageToken);
    }
    if (!detailResult.success || !usageResult.success) {
      showMutationFailure(!detailResult.success ? detailResult.errorCode : usageResult.errorCode);
    }
    setDetailLoading(false);
  };

  const loadMoreDetailUsages = async () => {
    if (!detailFile || !detailUsageNextPageToken) {
      return;
    }
    const requestId = detailRequestRef.current;
    const fileId = detailFile.id;
    setDetailLoading(true);
    const result = await listManagedFileUsagesAction({
      fileId,
      pageSize: 25,
      pageToken: detailUsageNextPageToken,
    });
    if (detailRequestRef.current !== requestId) {
      return;
    }
    if (result.success) {
      setDetailUsages((current) => [...current, ...result.usages.map(toFileManagerUsageItemView)]);
      setDetailUsageNextPageToken(result.nextPageToken);
    } else {
      showMutationFailure(result.errorCode);
    }
    setDetailLoading(false);
  };

  const submitFormOperation = async () => {
    if (!formOperation) {
      return;
    }
    setMutationLoading(true);
    try {
      let result: { success: boolean; errorCode?: Parameters<typeof errorMessage>[0] };
      switch (formOperation.kind) {
        case 'create-folder':
          result = await createFileFolderAction({ parentId: currentFolderID, name: formOperation.value });
          break;
        case 'rename-folder':
          result = await renameFileFolderAction({ folderId: formOperation.folder.id, name: formOperation.value });
          break;
        case 'rename-file':
          result = await renameManagedFileAction({ fileId: formOperation.file.id, fileName: formOperation.value });
          break;
      }
      if (!result.success) {
        showMutationFailure(result.errorCode);
        return;
      }
      setFormOperation(null);
      setSelectedItemIds([]);
      await loadItems();
    } finally {
      setMutationLoading(false);
    }
  };

  const confirmMoveHere = async () => {
    if (!moveOperation) {
      return;
    }
    setMutationLoading(true);
    try {
      const result =
        moveOperation.kind === 'folder'
          ? await moveFileFolderAction({ folderId: moveOperation.folder.id, parentId: currentFolderID })
          : await moveManagedFilesAction({ fileIds: moveOperation.fileIds, folderId: currentFolderID });
      if (!result.success) {
        showMutationFailure(result.errorCode);
        return;
      }
      setMoveOperation(null);
      setSelectedItemIds([]);
      await loadItems();
    } finally {
      setMutationLoading(false);
    }
  };

  const inspectSelectedDeletion = async () => {
    if (selectedFileIds.length === 0) {
      return;
    }
    setMutationLoading(true);
    const result = await getFileDeletionImpactAction(selectedFileIds);
    setMutationLoading(false);
    if (!result.success) {
      showMutationFailure(result.errorCode);
      return;
    }
    setDeleteOperation({ kind: 'files', fileIds: selectedFileIds, impacts: result.impacts });
  };

  const confirmDelete = async () => {
    if (!deleteOperation) {
      return;
    }
    setMutationLoading(true);
    try {
      if (deleteOperation.kind === 'folder') {
        const result = await deleteFileFolderAction(deleteOperation.folder.id);
        if (!result.success) {
          showMutationFailure(result.errorCode);
          return;
        }
      } else {
        const result = await deleteManagedFilesAction(deleteOperation.fileIds);
        if (!result.success) {
          showMutationFailure(result.errorCode);
          return;
        }
        if (result.rejectedFiles.length > 0) {
          showMutationFailure('inUse');
        }
      }
      setDeleteOperation(null);
      setSelectedItemIds([]);
      await loadItems();
    } finally {
      setMutationLoading(false);
    }
  };

  const uploadFile = async (file: File) => {
    setUploadPercentage(0);
    setError(null);
    try {
      await upload(file, {
        uploadType: UploadType.GENERAL_FILE,
        onProgress: (progress) => setUploadPercentage(progress.percentage),
      });
      notifications.show({ tone: 'positive', message: t('messages.uploaded') });
      const alreadyAtRoot = currentFolderID == null;
      setPath([{ name: t('root') }]);
      setSelectedItemIds([]);
      if (alreadyAtRoot) {
        await loadItems();
      }
    } catch {
      setError(errorMessage('upload'));
    } finally {
      setUploadPercentage(null);
    }
  };

  const formTitle = formOperation ? t(`dialogs.${formOperation.kind}.title`) : '';
  const formLabel = t('columns.name');
  const movePendingLabel =
    moveOperation?.kind === 'folder'
      ? `${t('actions.move')}: ${moveOperation.folder.name}`
      : moveOperation?.kind === 'files'
        ? t('selectedCount', { count: moveOperation.fileIds.length })
        : null;
  const blockingImpacts =
    deleteOperation?.kind === 'files' ? deleteOperation.impacts.filter((impact) => impact.totalUsageCount > 0) : [];
  const blockingUsagePreview = blockingImpacts
    .flatMap((impact) => impact.firstUsages)
    .slice(0, deletionImpactPreviewSize);
  const blockingTotalUsageCount = blockingImpacts.reduce((total, impact) => total + impact.totalUsageCount, 0);
  const blockingHiddenUsageCount = Math.max(0, blockingTotalUsageCount - blockingUsagePreview.length);
  const blockingDomainCounts = Array.from(
    blockingImpacts
      .flatMap((impact) => impact.domainCounts)
      .reduce(
        (counts, entry) => counts.set(entry.domain, (counts.get(entry.domain) ?? 0) + entry.count),
        new Map<FileUsageDomain, number>(),
      ),
  ).sort(([left], [right]) => left - right);

  return (
    <>
      <FilePicker
        onChange={(files) => {
          if (files[0]) {
            void uploadFile(files[0]);
          }
        }}
      >
        {(onBrowse) => (
          <FileManagerView
            labels={labels}
            role={viewerRole}
            items={items}
            path={path}
            total={total}
            loading={loading}
            searching={Boolean(appliedQuery)}
            hasMoreItems={Boolean(nextPageToken)}
            itemsNextPageKey={nextPageToken}
            itemsLoadingMore={itemsLoadingMore}
            itemsLoadMoreError={itemsLoadMoreError}
            query={query}
            mimeTypePrefix={mimeTypePrefix}
            sort={sort}
            viewMode={appliedQuery ? 'list' : viewMode}
            viewOptions={{
              value: viewSettings,
              labels: fileBrowserViewSettingsLabels(tViewSettings),
              onChange: changeViewSettings,
            }}
            selectedItemIds={selectedItemIds}
            detailFile={detailFile}
            detailUsages={detailUsages}
            detailLoading={detailLoading}
            hasMoreDetailUsages={Boolean(detailUsageNextPageToken)}
            uploadPercentage={uploadPercentage}
            error={error}
            folderNotFound={folderNotFound}
            movePendingLabel={movePendingLabel}
            mutationLoading={mutationLoading}
            onQueryChange={(value) => {
              setQuery(value);
            }}
            onMimeTypePrefixChange={(value) => {
              setMimeTypePrefix(value);
            }}
            onSortChange={(value) => {
              setSort(value);
            }}
            onViewModeChange={(mode) => {
              setViewMode(mode);
            }}
            onSelectedItemIdsChange={setSelectedItemIds}
            onOpenPath={openPath}
            onReturnToRoot={() => openPath(0)}
            onOpenFolder={openFolder}
            onOpenFile={(file) => void openFile(file)}
            onCloseFile={closeFile}
            onUploadRequested={onBrowse}
            onCreateFolder={() => setFormOperation({ kind: 'create-folder', value: '' })}
            onRenameFolder={(folder) => setFormOperation({ kind: 'rename-folder', folder, value: folder.name })}
            onMoveFolder={(folder) => {
              setMoveOperation({ kind: 'folder', folder });
              setSelectedItemIds([]);
            }}
            onDeleteFolder={(folder) => setDeleteOperation({ kind: 'folder', folder })}
            onRenameFile={(file) => setFormOperation({ kind: 'rename-file', file, value: file.fileName })}
            onMoveSelectedFiles={() => {
              if (selectedFileIds.length === 0) {
                return;
              }
              setMoveOperation({ kind: 'files', fileIds: selectedFileIds });
              setSelectedItemIds([]);
            }}
            onDeleteSelectedFiles={() => void inspectSelectedDeletion()}
            onConfirmMoveHere={() => void confirmMoveHere()}
            onCancelMove={() => setMoveOperation(null)}
            onLoadMoreDetailUsages={() => void loadMoreDetailUsages()}
            onLoadMoreItems={loadMoreItems}
          />
        )}
      </FilePicker>

      <FormModal
        opened={Boolean(formOperation)}
        onClose={() => setFormOperation(null)}
        onSubmit={() => void submitFormOperation()}
        title={formTitle}
        submitLabel={t('actions.save')}
        cancelLabel={t('actions.cancel')}
        closeLabel={t('actions.close')}
        loading={mutationLoading}
        submitDisabled={!formOperation?.value.trim()}
      >
        {formOperation ? (
          <TextInput
            label={formLabel}
            description={
              formOperation.kind === 'rename-file'
                ? t('dialogs.extensionSeparate', { extension: formOperation.file.extension })
                : undefined
            }
            value={formOperation.value}
            onChange={(event) => setFormOperation({ ...formOperation, value: event.currentTarget.value })}
          />
        ) : null}
      </FormModal>

      <ConfirmationDialog
        intent="delete"
        opened={Boolean(deleteOperation)}
        onClose={() => setDeleteOperation(null)}
        onConfirm={() => void confirmDelete()}
        title={t('dialogs.delete.title')}
        message={
          <DsLayoutStack gap="sm">
            <DsText>
              {deleteOperation?.kind === 'folder'
                ? t('dialogs.delete.folder')
                : t('dialogs.delete.files', { count: deleteOperation?.fileIds.length ?? 0 })}
            </DsText>
            {blockingImpacts.length > 0 ? (
              <>
                <DsText size="sm" tone="danger">
                  {t('dialogs.delete.blocked', { count: blockingImpacts.length })}
                </DsText>
                <DsText size="sm">{t('dialogs.delete.totalUsages', { count: blockingTotalUsageCount })}</DsText>
                <DsText size="sm">
                  {t('dialogs.delete.byDomain', {
                    summary: blockingDomainCounts
                      .map(([domain, count]) => `${labels.usageDomains[domain] ?? t('columns.usages')}: ${count}`)
                      .join(' · '),
                  })}
                </DsText>
                {blockingUsagePreview.map((usage, index) => (
                  <DsText key={`${usage.domain}-${usage.entityId}-${usage.slot}-${index}`} size="sm">
                    {usage.title || usage.entityId} · {usage.slot}
                  </DsText>
                ))}
                {blockingHiddenUsageCount > 0 ? (
                  <DsText size="sm">{t('dialogs.delete.more', { count: blockingHiddenUsageCount })}</DsText>
                ) : null}
              </>
            ) : null}
          </DsLayoutStack>
        }
        confirmLabel={t('actions.delete')}
        cancelLabel={t('actions.cancel')}
        closeLabel={t('actions.close')}
        loading={mutationLoading}
        confirmDisabled={blockingImpacts.length > 0}
      />
    </>
  );
}
