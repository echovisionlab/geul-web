'use client';

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

interface EditorFileLibraryPickerProps {
  allowMultiple?: boolean;
  mimeTypePrefix?: string;
  onSelect: (files: EditorLibraryFileSelection[]) => void;
}

export function EditorFileLibraryPicker({
  allowMultiple = false,
  mimeTypePrefix: initialMimeTypePrefix = '',
  onSelect,
}: EditorFileLibraryPickerProps) {
  const tFileManager = useTranslations('fileManager');
  const tMedia = useTranslations('editorCommon.media');
  const tCommonActions = useTranslations('common.actions');
  const tCommonStates = useTranslations('common.states');
  const requestRef = useRef(0);
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
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
    setLoading(true);
    setError(null);
    setFolderNotFound(false);
    setSelectedFiles([]);
    setRows([]);
    setTotal(0);
    setNextPageToken(undefined);

    try {
      if (appliedQuery) {
        const result = await searchFileManagerItemsAction({
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
        const result = await listFileManagerItemsAction({
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
  }, [appliedQuery, currentFolderId, mimeTypePrefix, searchScope, sortInput, tFileManager]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const loadMore = useCallback(async () => {
    if (!appliedQuery || !nextPageToken || loadingMore) {
      return;
    }
    const requestId = requestRef.current;
    setLoadingMore(true);
    try {
      const result = await searchFileManagerItemsAction({
        query: appliedQuery,
        folderId: searchScope === 'folder' ? currentFolderId : undefined,
        mimeTypePrefix,
        ...sortInput,
        pageToken: nextPageToken,
      });
      if (requestRef.current !== requestId) {
        return;
      }
      setRows((current) => [...current, ...result.items]);
      setTotal(result.total);
      setNextPageToken(result.nextPageToken);
    } catch {
      if (requestRef.current === requestId) {
        setError(tFileManager('errors.load'));
      }
    } finally {
      if (requestRef.current === requestId) {
        setLoadingMore(false);
      }
    }
  }, [appliedQuery, currentFolderId, loadingMore, mimeTypePrefix, nextPageToken, searchScope, sortInput, tFileManager]);

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
      setSelectedFiles([]);
      clearSearch();
    },
    [clearSearch, searching, tFileManager],
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
      selectAllRows: tFileManager('selectAll'),
      open: tFileManager('actions.open'),
      preview: tFileManager('actions.preview'),
      download: tFileManager('actions.download'),
      gridView: tFileManager('actions.gridView'),
      listView: tFileManager('actions.listView'),
      closePreview: tFileManager('actions.close'),
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
      selectedFiles={selectedFiles}
      allowMultiple={allowMultiple}
      loading={loading}
      loadingMore={loadingMore}
      hasMore={Boolean(nextPageToken)}
      error={error}
      folderNotFound={folderNotFound}
      isRowDisabled={isRowDisabled}
      onQueryChange={setQuery}
      onSearchScopeChange={setSearchScope}
      onMimeTypePrefixChange={setMimeTypePrefix}
      onSortChange={setSort}
      onOpenPath={(index) => {
        setPath((previous) => previous.slice(0, index + 1));
        setSelectedFiles([]);
        clearSearch();
      }}
      onActivateRow={activateRow}
      onSelectedFilesChange={(files) => {
        setSelectedFiles(files);
      }}
      onConfirmFiles={confirmFiles}
      onReturnToParent={() => {
        setPath((previous) => previous.slice(0, -1));
        clearSearch();
      }}
      onLoadMore={() => void loadMore()}
      onViewModeChange={setViewMode}
    />
  );
}
