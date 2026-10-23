'use client';
import { useFileBrowserViewSettings } from './useFileBrowserViewSettings';
import { fileBrowserViewSettingsLabels } from './ui/file-browser-view-settings';
import { useTranslations } from 'next-intl';
import { ConfirmationDialog } from '@/features/confirmation';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
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
} from '@/lib/actions/file';
import { useFileUpload } from '@/lib/hooks/useFileUpload';
import { FileManagerView, type FileManagerPathItem } from './FileManagerView';
import { summarizeFileDeletionImpact } from './file-deletion-impact';
import { useFileManagerI18n, type FileManagerErrorKey } from './i18n';
import { parseFileBrowserSort } from './sort';
import type {
  FileManagerFileView,
  FileManagerFolderView,
  FileManagerItemView,
  FileManagerUsageItemView,
} from './model';

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
  const detailMoreRequestRef = useRef<string | null>(null);
  const { upload } = useFileUpload();
  const [items, setItems] = useState<FileManagerItemView[]>([]);
  const [total, setTotal] = useState(0);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [folders, setFolders] = useState<FileManagerPathItem[]>([]);
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
  const [itemsLoadMoreError, setItemsLoadMoreError] = useState<FileManagerErrorKey | null>(null);
  const [mutationLoading, setMutationLoading] = useState(false);
  const [uploadPercentage, setUploadPercentage] = useState<number | null>(null);
  const [error, setError] = useState<FileManagerErrorKey | null>(null);
  const [folderNotFound, setFolderNotFound] = useState(false);

  const currentFolderID = folders.at(-1)?.id;
  const path: FileManagerPathItem[] = [{ name: t('root') }, ...folders];
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
        setItems(result.items);
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
        setItems(result.items);
        setTotal(result.total);
      }
    } catch {
      if (listRequestRef.current !== requestId) {
        return;
      }
      setError('load');
    } finally {
      if (listRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [appliedQuery, currentFolderID, mimeTypePrefix, sortInput]);

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
        ...new Map([...current, ...result.items].map((item) => [`${item.kind}:${item.id}`, item])).values(),
      ]);
      setTotal(result.total);
      setNextPageToken(result.nextPageToken);
    } catch {
      if (listRequestRef.current === requestId) {
        setItemsLoadMoreError('load');
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
    detailMoreRequestRef.current = null;
    setDetailFile(null);
    setDetailUsages([]);
    setDetailUsageNextPageToken(undefined);
    setDetailLoading(false);
  };

  const openFolder = (folder: FileManagerFolderView) => {
    setFolderNotFound(false);
    if (appliedQuery && folder.folderPath?.length) {
      setFolders(folder.folderPath);
    } else {
      setFolders((previous) => [...previous, { id: folder.id, name: folder.name }]);
    }
    setQuery('');
    setAppliedQuery('');
    setSelectedItemIds([]);
    closeFile();
  };

  const openPath = (index: number) => {
    setFolderNotFound(false);
    setFolders((previous) => previous.slice(0, index));
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
    detailMoreRequestRef.current = null;
    setDetailFile(file);
    setDetailUsages([]);
    setDetailUsageNextPageToken(undefined);
    setDetailLoading(true);
    try {
      const [detailResult, usageResult] = await Promise.all([
        getManagedFileAction(file.id),
        listManagedFileUsagesAction({ fileId: file.id, pageSize: 25 }),
      ]);
      if (detailRequestRef.current !== requestId) {
        return;
      }
      if (detailResult.success) {
        setDetailFile(detailResult.file);
      }
      if (usageResult.success) {
        setDetailUsages(usageResult.usages);
        setDetailUsageNextPageToken(usageResult.nextPageToken);
      }
      if (!detailResult.success || !usageResult.success) {
        showMutationFailure(!detailResult.success ? detailResult.errorCode : usageResult.errorCode);
      }
    } catch {
      if (detailRequestRef.current === requestId) {
        showMutationFailure('loadFile');
      }
    } finally {
      if (detailRequestRef.current === requestId) {
        setDetailLoading(false);
      }
    }
  };

  const loadMoreDetailUsages = async () => {
    if (!detailFile || !detailUsageNextPageToken || detailMoreRequestRef.current !== null) {
      return;
    }
    const requestId = detailRequestRef.current;
    const fileId = detailFile.id;
    const pageKey = JSON.stringify([requestId, detailUsageNextPageToken]);
    detailMoreRequestRef.current = pageKey;
    setDetailLoading(true);
    try {
      const result = await listManagedFileUsagesAction({
        fileId,
        pageSize: 25,
        pageToken: detailUsageNextPageToken,
      });
      if (detailRequestRef.current !== requestId) {
        return;
      }
      if (result.success) {
        setDetailUsages((current) => [...current, ...result.usages]);
        setDetailUsageNextPageToken(result.nextPageToken);
      } else {
        showMutationFailure(result.errorCode);
      }
    } catch {
      if (detailRequestRef.current === requestId) {
        showMutationFailure('loadUsages');
      }
    } finally {
      if (detailMoreRequestRef.current === pageKey) {
        detailMoreRequestRef.current = null;
      }
      if (detailRequestRef.current === requestId) {
        setDetailLoading(false);
      }
    }
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
    } catch {
      showMutationFailure();
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
    } catch {
      showMutationFailure();
    } finally {
      setMutationLoading(false);
    }
  };

  const inspectSelectedDeletion = async () => {
    if (selectedFileIds.length === 0) {
      return;
    }
    setMutationLoading(true);
    try {
      const result = await getFileDeletionImpactAction(selectedFileIds);
      if (!result.success) {
        showMutationFailure(result.errorCode);
        return;
      }
      setDeleteOperation({ kind: 'files', fileIds: selectedFileIds, impacts: result.impacts });
    } catch {
      showMutationFailure('inspectUsage');
    } finally {
      setMutationLoading(false);
    }
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
    } catch {
      showMutationFailure();
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
      setFolders([]);
      setSelectedItemIds([]);
      if (alreadyAtRoot) {
        await loadItems();
      }
    } catch {
      setError('upload');
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
  const {
    blockingFileCount,
    totalUsageCount: blockingTotalUsageCount,
    usagePreview: blockingUsagePreview,
    hiddenUsageCount: blockingHiddenUsageCount,
    domainCounts: blockingDomainCounts,
  } = summarizeFileDeletionImpact(
    deleteOperation?.kind === 'files' ? deleteOperation.impacts : [],
    deletionImpactPreviewSize,
  );

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
            itemsLoadMoreError={itemsLoadMoreError ? errorMessage(itemsLoadMoreError) : null}
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
            error={error ? errorMessage(error) : null}
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
            {blockingFileCount > 0 ? (
              <>
                <DsText size="sm" tone="danger">
                  {t('dialogs.delete.blocked', { count: blockingFileCount })}
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
        confirmDisabled={blockingFileCount > 0}
      />
    </>
  );
}
