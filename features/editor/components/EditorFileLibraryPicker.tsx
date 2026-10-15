'use client';
import { useFileBrowserViewSettings } from '@/features/file-manager/useFileBrowserViewSettings';
import { fileBrowserViewSettingsLabels } from '@/features/file-manager/ui/file-browser-view-settings';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { parseFileBrowserSort } from '@/features/file-manager/sort';
import {
  listFileManagerItemsAction,
  searchFileManagerItemsAction,
  type FileManagerFileRow,
  type FileManagerFolderRow,
  type FileManagerRow,
} from '@/lib/actions/file';
import {
  isUnifiedEditorLibraryFileEligible,
  type EditorLibraryFileSelection,
} from '../lib/editor-library-file-selection';
import {
  EditorFileLibraryPickerView,
  type EditorFileLibraryPickerViewLabels,
  type FileLibraryPathItem,
} from './EditorFileLibraryPickerView';

/** Read-only transport boundary; the same controller and view run in app and catalogue. */
export interface EditorFileLibraryDataSource {
  list: typeof listFileManagerItemsAction;
  search: typeof searchFileManagerItemsAction;
}

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
  const requestRef = useRef(0);
  const moreRequestRef = useRef<string | null>(null);
  const [path, setPath] = useState<FileLibraryPathItem[]>([{ name: tFileManager('root') }]);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'folder' | 'all'>('folder');
  const [mimeTypePrefix, setMimeTypePrefix] = useState(initialMimeTypePrefix);
  const [sort, setSort] = useState('name:asc');
  const [rows, setRows] = useState<FileManagerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [selectedFiles, setSelectedFiles] = useState<FileManagerFileRow[]>([]);
  const { settings: viewSettings, change: changeViewSettings } = useFileBrowserViewSettings();
  const viewMode = viewSettings.viewMode;
  const setViewMode = (mode: 'grid' | 'list') => changeViewSettings({ ...viewSettings, viewMode: mode });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folderNotFound, setFolderNotFound] = useState(false);
  const currentFolderId = path.at(-1)?.id;
  const searching = appliedQuery !== '';
  const sortInput = useMemo(() => parseFileBrowserSort(sort), [sort]);

  useEffect(() => {
    const timer = window.setTimeout(() => setAppliedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadRows = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    moreRequestRef.current = null;
    setLoading(true);
    setLoadingMore(false);
    setLoadMoreError(null);
    setError(null);
    setFolderNotFound(false);
    if (!allowMultiple) {
      setSelectedFiles([]);
    }
    setRows([]);
    setTotal(0);
    setNextPageToken(undefined);

    try {
      if (appliedQuery) {
        const result = await dataSource.search({
          query: appliedQuery,
          folderId: searchScope === 'folder' ? currentFolderId : undefined,
          mimeTypePrefix,
          ...sortInput,
        });
        if (requestRef.current !== requestId) {
          return;
        }
        setRows(result.items);
        setTotal(result.total);
        setNextPageToken(result.nextPageToken);
      } else {
        const result = await dataSource.list({
          folderId: currentFolderId,
          mimeTypePrefix,
          ...sortInput,
        });
        if (requestRef.current !== requestId) {
          return;
        }
        setFolderNotFound(result.folderNotFound);
        setRows(result.items);
        setTotal(result.items.length);
      }
    } catch {
      if (requestRef.current !== requestId) {
        return;
      }
      setRows([]);
      setError(tFileManager('errors.load'));
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [allowMultiple, appliedQuery, currentFolderId, dataSource, mimeTypePrefix, searchScope, sortInput, tFileManager]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const loadMore = useCallback(async () => {
    if (
      !appliedQuery ||
      query.trim() !== appliedQuery ||
      !nextPageToken ||
      loading ||
      loadingMore ||
      moreRequestRef.current !== null
    ) {
      return;
    }
    const requestId = requestRef.current;
    const pageKey = JSON.stringify([requestId, nextPageToken]);
    moreRequestRef.current = pageKey;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const result = await dataSource.search({
        query: appliedQuery,
        folderId: searchScope === 'folder' ? currentFolderId : undefined,
        mimeTypePrefix,
        ...sortInput,
        pageToken: nextPageToken,
      });
      if (requestRef.current !== requestId) {
        return;
      }
      if (result.nextPageToken === nextPageToken) {
        throw new Error('File search returned the same continuation cursor');
      }
      setRows((current) => [
        ...new Map([...current, ...result.items].map((item) => [`${item.kind}:${item.id}`, item])).values(),
      ]);
      setTotal(result.total);
      setNextPageToken(result.nextPageToken);
    } catch {
      if (requestRef.current === requestId) {
        setLoadMoreError(tFileManager('errors.load'));
      }
    } finally {
      if (requestRef.current === requestId && moreRequestRef.current === pageKey) {
        moreRequestRef.current = null;
        setLoadingMore(false);
      }
    }
  }, [
    appliedQuery,
    currentFolderId,
    dataSource,
    loading,
    loadingMore,
    mimeTypePrefix,
    nextPageToken,
    query,
    searchScope,
    sortInput,
    tFileManager,
  ]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setAppliedQuery('');
  }, []);

  const openFolder = useCallback(
    (folder: FileManagerFolderRow) => {
      if (searching && folder.folderPath?.length) {
        setPath([{ name: tFileManager('root') }, ...folder.folderPath]);
      } else {
        setPath((previous) => [...previous, { id: folder.id, name: folder.name }]);
      }
      if (!allowMultiple) {
        setSelectedFiles([]);
      }
      clearSearch();
    },
    [allowMultiple, clearSearch, searching, tFileManager],
  );

  const isRowDisabled = useCallback(
    (row: FileManagerRow) => row.kind === 'file' && !isUnifiedEditorLibraryFileEligible(row),
    [],
  );

  const activateRow = useCallback(
    (row: FileManagerRow) => {
      if (row.kind === 'folder') {
        openFolder(row);
      } else if (!isRowDisabled(row)) {
        setSelectedFiles((current) => {
          if (!allowMultiple) {
            return [row];
          }
          return current.some((file) => file.id === row.id)
            ? current.filter((file) => file.id !== row.id)
            : [...current, row];
        });
      }
    },
    [allowMultiple, isRowDisabled, openFolder],
  );

  const confirmFiles = useCallback(
    (files: FileManagerFileRow[]) => {
      const eligibleFiles = files.filter((file) => !isRowDisabled(file));
      if (eligibleFiles.length > 0) {
        onSelect(allowMultiple ? eligibleFiles : eligibleFiles.slice(0, 1));
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
      loadMoreError={loadMoreError}
      error={error}
      folderNotFound={folderNotFound}
      isRowDisabled={isRowDisabled}
      onQueryChange={setQuery}
      onSearchScopeChange={setSearchScope}
      onMimeTypePrefixChange={setMimeTypePrefix}
      onSortChange={setSort}
      onOpenPath={(index) => {
        setPath((previous) => previous.slice(0, index + 1));
        if (!allowMultiple) {
          setSelectedFiles([]);
        }
        clearSearch();
      }}
      onActivateRow={activateRow}
      onSelectedFilesChange={(files) => {
        const eligible = files.filter((file) => !isRowDisabled(file));
        setSelectedFiles(allowMultiple ? eligible : eligible.slice(0, 1));
      }}
      onConfirmFiles={confirmFiles}
      onReturnToParent={() => {
        setPath((previous) => previous.slice(0, -1));
        clearSearch();
      }}
      onLoadMore={loadMore}
      onViewModeChange={setViewMode}
    />
  );
}
