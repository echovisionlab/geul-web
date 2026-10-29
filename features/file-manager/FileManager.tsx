'use client';
import { useFileBrowserViewSettings } from './useFileBrowserViewSettings';
import { fileBrowserViewSettingsLabels } from './ui/file-browser-view-settings';
import { useTranslations } from 'next-intl';
import { ConfirmationDialog } from '@/features/confirmation';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useMemo, useRef, useState } from 'react';
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
import type { FileLibraryBrowserAdapter, FileLibraryBrowserOptions } from './file-library-browser-store';
import { useFileLibraryBrowserStore } from './useFileLibraryBrowserStore';
import { useFileManagerI18n } from './i18n';
import type { FileManagerFileView, FileManagerFolderView, FileManagerUsageItemView } from './model';

type FormOperation =
  | { kind: 'create-folder'; value: string }
  | { kind: 'rename-folder'; folder: FileManagerFolderView; value: string }
  | { kind: 'rename-file'; file: FileManagerFileView; value: string };

type MoveOperation = { kind: 'folder'; folder: FileManagerFolderView } | { kind: 'files'; fileIds: string[] };

type DeleteOperation =
  | { kind: 'folder'; folder: FileManagerFolderView }
  | { kind: 'files'; fileIds: string[]; impacts: FileDeletionImpactView[] };

const deletionImpactPreviewSize = 5;

const fileManagerLibrary: FileLibraryBrowserAdapter = {
  list: listFileManagerItemsAction,
  search: searchFileManagerItemsAction,
};
const fileManagerBrowsing: FileLibraryBrowserOptions = { initialSearchScope: 'all' };

export function FileManager({ viewerRole }: { viewerRole: 'author' | 'admin' }) {
  const tViewSettings = useTranslations('fileManager.viewSettings');
  const { labels, errorMessage, message: t } = useFileManagerI18n();
  const detailRequestRef = useRef(0);
  const detailMoreRequestRef = useRef<string | null>(null);
  const { upload } = useFileUpload();
  const { store: browser, state: browserState } = useFileLibraryBrowserStore(fileManagerLibrary, fileManagerBrowsing);
  const {
    items,
    total,
    nextPageToken,
    folders,
    query,
    appliedQuery,
    mimeTypePrefix,
    sort,
    loading,
    loadingMore: itemsLoadingMore,
    loadMoreError: itemsLoadMoreError,
    error,
    folderNotFound,
  } = browserState;
  const selectedItemIds = useMemo(() => browserState.selectedRows.map((row) => row.id), [browserState.selectedRows]);
  const { settings: viewSettings, change: changeViewSettings } = useFileBrowserViewSettings();
  const viewMode = viewSettings.viewMode;
  const setViewMode = (mode: 'grid' | 'list') => changeViewSettings({ ...viewSettings, viewMode: mode });
  const [detailFile, setDetailFile] = useState<FileManagerFileView | null>(null);
  const [detailUsages, setDetailUsages] = useState<FileManagerUsageItemView[]>([]);
  const [detailUsageNextPageToken, setDetailUsageNextPageToken] = useState<string | undefined>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [formOperation, setFormOperation] = useState<FormOperation | null>(null);
  const [moveOperation, setMoveOperation] = useState<MoveOperation | null>(null);
  const [deleteOperation, setDeleteOperation] = useState<DeleteOperation | null>(null);
  const [mutationLoading, setMutationLoading] = useState(false);
  const [uploadPercentage, setUploadPercentage] = useState<number | null>(null);

  const currentFolderID = folders.at(-1)?.id;
  const path: FileManagerPathItem[] = [{ name: t('root') }, ...folders];
  const selectedFileIds = useMemo(
    () =>
      items
        .filter((item): item is FileManagerFileView => item.kind === 'file' && selectedItemIds.includes(item.id))
        .map((item) => item.id),
    [items, selectedItemIds],
  );

  const closeFile = () => {
    detailRequestRef.current += 1;
    detailMoreRequestRef.current = null;
    setDetailFile(null);
    setDetailUsages([]);
    setDetailUsageNextPageToken(undefined);
    setDetailLoading(false);
  };

  const openFolder = (folder: FileManagerFolderView) => {
    browser.openFolder(folder);
    closeFile();
  };

  const openPath = (index: number) => {
    browser.openPath(index);
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
      browser.setSelection([]);
      await browser.reload();
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
      browser.setSelection([]);
      await browser.reload();
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
      browser.setSelection([]);
      await browser.reload();
    } catch {
      showMutationFailure();
    } finally {
      setMutationLoading(false);
    }
  };

  const uploadFile = async (file: File) => {
    setUploadPercentage(0);
    browser.setError(null);
    try {
      await upload(file, {
        uploadType: UploadType.GENERAL_FILE,
        onProgress: (progress) => setUploadPercentage(progress.percentage),
      });
      notifications.show({ tone: 'positive', message: t('messages.uploaded') });
      await browser.showRoot();
    } catch {
      browser.setError('upload');
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
            onQueryChange={browser.setQuery}
            onMimeTypePrefixChange={browser.setMimeTypePrefix}
            onSortChange={browser.setSort}
            onViewModeChange={(mode) => {
              setViewMode(mode);
            }}
            onSelectedItemIdsChange={(ids) =>
              browser.setSelection(ids.flatMap((id) => items.filter((item) => item.id === id)))
            }
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
              browser.setSelection([]);
            }}
            onDeleteFolder={(folder) => setDeleteOperation({ kind: 'folder', folder })}
            onRenameFile={(file) => setFormOperation({ kind: 'rename-file', file, value: file.fileName })}
            onMoveSelectedFiles={() => {
              if (selectedFileIds.length === 0) {
                return;
              }
              setMoveOperation({ kind: 'files', fileIds: selectedFileIds });
              browser.setSelection([]);
            }}
            onDeleteSelectedFiles={() => void inspectSelectedDeletion()}
            onConfirmMoveHere={() => void confirmMoveHere()}
            onCancelMove={() => setMoveOperation(null)}
            onLoadMoreDetailUsages={() => void loadMoreDetailUsages()}
            onLoadMoreItems={browser.loadMore}
          />
        )}
      </FilePicker>

      <FormModal
        opened={Boolean(formOperation)}
        onClose={() => setFormOperation(null)}
        onSubmit={() => void submitFormOperation()}
        title={formTitle}
        submitLabel={t('actions.save')}
        submitTone="brand"
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
