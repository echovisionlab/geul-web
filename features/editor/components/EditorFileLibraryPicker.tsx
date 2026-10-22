'use client';
import { useFileBrowserViewSettings } from '@/features/file-manager/useFileBrowserViewSettings';
import { fileBrowserViewSettingsLabels } from '@/features/file-manager/ui/file-browser-view-settings';

import { useCallback, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { FileLibraryBrowserAdapter } from '@/features/file-manager/file-library-browser-store';
import { useFileLibraryBrowserStore } from '@/features/file-manager/useFileLibraryBrowserStore';
import {
  listFileManagerItemsAction,
  searchFileManagerItemsAction,
  type FileManagerFileRow,
  type FileManagerRow,
} from '@/lib/actions/file';
import {
  isUnifiedEditorLibraryFileEligible,
  type EditorLibraryFileSelection,
} from '../lib/editor-library-file-selection';
import { eligibleLibrarySelection, toggleLibraryFileSelection } from '../lib/editor-library-picker-selection';
import {
  EditorFileLibraryPickerView,
  type EditorFileLibraryPickerViewLabels,
  type FileLibraryPathItem,
} from './EditorFileLibraryPickerView';

/** Read-only transport boundary; the same controller and view run in app and catalogue. */
export type EditorFileLibraryDataSource = FileLibraryBrowserAdapter;

const defaultLibraryDataSource: EditorFileLibraryDataSource = {
  list: listFileManagerItemsAction,
  search: searchFileManagerItemsAction,
};

interface EditorFileLibraryPickerProps {
  dataSource?: EditorFileLibraryDataSource;
  allowMultiple?: boolean;
  mimeTypePrefix?: string;
  onSelect: (files: EditorLibraryFileSelection[]) => void;
}

export function EditorFileLibraryPicker({
  dataSource = defaultLibraryDataSource,
  allowMultiple = false,
  mimeTypePrefix: initialMimeTypePrefix = '',
  onSelect,
}: EditorFileLibraryPickerProps) {
  const tViewSettings = useTranslations('fileManager.viewSettings');
  const tFileManager = useTranslations('fileManager');
  const tMedia = useTranslations('editorCommon.media');
  const tCommonActions = useTranslations('common.actions');
  const tCommonStates = useTranslations('common.states');
  const { store: browser, state } = useFileLibraryBrowserStore(dataSource, {
    initialMimeTypePrefix,
    preserveSelection: allowMultiple,
  });
  const { folders, query, appliedQuery, searchScope, mimeTypePrefix, sort, items: rows, total, nextPageToken } = state;
  const { loading, loadingMore, folderNotFound } = state;
  const selectedFiles = useMemo(
    () => state.selectedRows.filter((row): row is FileManagerFileRow => row.kind === 'file'),
    [state.selectedRows],
  );
  const path = useMemo<FileLibraryPathItem[]>(
    () => [{ name: tFileManager('root') }, ...folders],
    [folders, tFileManager],
  );
  const { settings: viewSettings, change: changeViewSettings } = useFileBrowserViewSettings();
  const viewMode = viewSettings.viewMode;
  const setViewMode = (mode: 'grid' | 'list') => changeViewSettings({ ...viewSettings, viewMode: mode });
  const searching = appliedQuery !== '';
  useEffect(() => browser.setPreserveSelection(allowMultiple), [allowMultiple, browser]);

  const isRowDisabled = useCallback(
    (row: FileManagerRow) => row.kind === 'file' && !isUnifiedEditorLibraryFileEligible(row),
    [],
  );

  const activateRow = useCallback(
    (row: FileManagerRow) => {
      if (row.kind === 'folder') {
        browser.openFolder(row);
      } else if (!isRowDisabled(row)) {
        // Read the store, not this render: two activations in one tick must both count.
        const current = browser.api
          .getState()
          .selectedRows.filter((item): item is FileManagerFileRow => item.kind === 'file');
        browser.setSelection(toggleLibraryFileSelection(current, row, allowMultiple));
      }
    },
    [allowMultiple, browser, isRowDisabled],
  );

  const confirmFiles = useCallback(
    (files: FileManagerFileRow[]) => {
      const eligibleFiles = eligibleLibrarySelection(files, allowMultiple, isRowDisabled);
      if (eligibleFiles.length > 0) {
        onSelect(eligibleFiles);
      }
    },
    [allowMultiple, isRowDisabled, onSelect],
  );

  const labels = useMemo<EditorFileLibraryPickerViewLabels>(
    () => ({
      search: tFileManager('search'),
      searchScope: tFileManager('searchScope.label'),
      currentFolder: tFileManager('searchScope.currentFolder'),
      allFiles: tFileManager('searchScope.allFiles'),
      name: tFileManager('columns.name'),
      type: tFileManager('columns.type'),
      allTypes: tFileManager('types.all'),
      images: tFileManager('types.images'),
      audio: tFileManager('types.audio'),
      video: tFileManager('types.video'),
      documents: tFileManager('types.documents'),
      sortLabel: tFileManager('sort.label'),
      sortName: tFileManager('sort.name'),
      sortNewest: tFileManager('sort.newest'),
      sortOldest: tFileManager('sort.oldest'),
      sortSize: tFileManager('sort.size'),
      sortSmallest: tFileManager('sort.smallest'),
      size: tFileManager('columns.size'),
      location: tFileManager('columns.location'),
      folderType: tFileManager('types.folder'),
      empty: tFileManager('empty'),
      folderNotFound: tFileManager('folderNotFound'),
      selectFile: tMedia('ingestDialog.selectFile'),
      loading: tCommonStates('loading'),
      back: tCommonActions('back'),
      add: tCommonActions('add'),
      loadMore: tFileManager('actions.loadMore'),
      pagination: {
        load: tFileManager('actions.loadMore'),
        loading: tCommonStates('loading'),
        end: tFileManager('pagination.end'),
        retry: tCommonActions('tryAgain'),
        failed: tFileManager('errors.load'),
      },
      selectAllRows: tFileManager('selectAll'),
      open: tFileManager('actions.open'),
      preview: tFileManager('actions.preview'),
      download: tFileManager('actions.download'),
      gridView: tFileManager('actions.gridView'),
      listView: tFileManager('actions.listView'),
      viewMode: tCommonActions('view'),
      closePreview: tFileManager('actions.close'),
      selectionUnavailableDescription: tFileManager('selectionUnavailableDescription'),
      itemCount: (count) => tFileManager('itemCount', { count }),
      searchResultCount: (count) => tFileManager('searchResultCount', { count }),
      selectedCount: (count) => tFileManager('selectedCount', { count }),
    }),
    [tCommonActions, tCommonStates, tFileManager, tMedia],
  );

  return (
    <EditorFileLibraryPickerView
      labels={labels}
      rows={rows}
      path={path}
      query={query}
      searchScope={searchScope}
      mimeTypePrefix={mimeTypePrefix}
      sort={sort}
      searching={searching}
      total={total}
      viewMode={viewMode}
      viewOptions={{
        value: viewSettings,
        labels: fileBrowserViewSettingsLabels(tViewSettings),
        onChange: changeViewSettings,
      }}
      selectedFiles={selectedFiles}
      allowMultiple={allowMultiple}
      loading={loading}
      loadingMore={loadingMore}
      hasMore={Boolean(nextPageToken)}
      nextPageKey={nextPageToken}
      loadMoreError={state.loadMoreError ? tFileManager(`errors.${state.loadMoreError}`) : null}
      error={state.error ? tFileManager(`errors.${state.error}`) : null}
      folderNotFound={folderNotFound}
      isRowDisabled={isRowDisabled}
      onQueryChange={browser.setQuery}
      onSearchScopeChange={browser.setSearchScope}
      onMimeTypePrefixChange={browser.setMimeTypePrefix}
      onSortChange={browser.setSort}
      onOpenPath={browser.openPath}
      onActivateRow={activateRow}
      onSelectedFilesChange={(files) =>
        browser.setSelection(eligibleLibrarySelection(files, allowMultiple, isRowDisabled))
      }
      onConfirmFiles={confirmFiles}
      onReturnToParent={browser.openParent}
      onLoadMore={browser.loadMore}
      onViewModeChange={setViewMode}
    />
  );
}
