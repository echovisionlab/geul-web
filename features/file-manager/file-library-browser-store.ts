import { createStore, type StoreApi } from 'zustand/vanilla';
import type {
  FileManagerFolderRow,
  FileManagerPathSegment,
  FileManagerRow,
  listFileManagerItemsAction,
  searchFileManagerItemsAction,
} from '@/lib/actions/file';
import { parseFileBrowserSort } from './sort';

/** Read-only transport; the app passes the server actions, the catalogue a local library. */
export interface FileLibraryBrowserAdapter {
  list: typeof listFileManagerItemsAction;
  search: typeof searchFileManagerItemsAction;
}

export interface FileLibraryBrowserClock {
  setTimeout: (callback: () => void, delayMs: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

export const FILE_LIBRARY_SEARCH_DEBOUNCE_MS = 300;

export type FileLibrarySearchScope = 'folder' | 'all';

/** The view translates these as `fileManager.errors.<code>`. */
export type FileLibraryBrowserError = 'load' | 'upload';

export interface FileLibraryBrowserState {
  /** Folders below the root. The root has no ID, and each view adds its own label for it. */
  folders: FileManagerPathSegment[];
  query: string;
  /** The query being shown; empty while browsing a folder. */
  appliedQuery: string;
  searchScope: FileLibrarySearchScope;
  mimeTypePrefix: string;
  sort: string;
  items: FileManagerRow[];
  total: number;
  nextPageToken: string | undefined;
  selectedRows: FileManagerRow[];
  loading: boolean;
  loadingMore: boolean;
  loadMoreError: 'load' | null;
  error: FileLibraryBrowserError | null;
  folderNotFound: boolean;
}

export interface FileLibraryBrowserOptions {
  clock?: FileLibraryBrowserClock;
  initialMimeTypePrefix?: string;
  initialSearchScope?: FileLibrarySearchScope;
  initialSort?: string;
  /** Keep the selection when the shown items change, for picking Files from several folders. */
  preserveSelection?: boolean;
}

export interface FileLibraryBrowserStore {
  readonly api: StoreApi<FileLibraryBrowserState>;
  /** Loads the current folder or search. A later start loads again. */
  start: (adapter: FileLibraryBrowserAdapter) => void;
  stop: () => void;
  /** Applies the trimmed query after the search pause. */
  setQuery: (query: string) => void;
  setSearchScope: (scope: FileLibrarySearchScope) => void;
  setMimeTypePrefix: (prefix: string) => void;
  setSort: (sort: string) => void;
  openFolder: (folder: FileManagerFolderRow) => void;
  /** Opens an entry of the path shown as [root, ...folders]; 0 is the root. */
  openPath: (index: number) => void;
  openParent: () => void;
  /** Shows the root with the current query, and always loads it again. */
  showRoot: () => Promise<void>;
  reload: () => Promise<void>;
  /** Loads the next page of search results. */
  loadMore: () => Promise<void>;
  setSelection: (rows: FileManagerRow[]) => void;
  setPreserveSelection: (preserve: boolean) => void;
  setError: (error: FileLibraryBrowserError | null) => void;
}

const defaultClock: FileLibraryBrowserClock = {
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Browses the File library one folder at a time, or searches it with paged results. */
export function createFileLibraryBrowserStore(options: FileLibraryBrowserOptions = {}): FileLibraryBrowserStore {
  const clock = options.clock ?? defaultClock;
  let preserveSelection = options.preserveSelection ?? false;
  const api = createStore<FileLibraryBrowserState>()(() => ({
    folders: [],
    query: '',
    appliedQuery: '',
    searchScope: options.initialSearchScope ?? 'folder',
    mimeTypePrefix: options.initialMimeTypePrefix ?? '',
    sort: options.initialSort ?? 'name:asc',
    items: [],
    total: 0,
    nextPageToken: undefined,
    selectedRows: [],
    loading: true,
    loadingMore: false,
    loadMoreError: null,
    error: null,
    folderNotFound: false,
  }));
  const set = api.setState;
  const get = api.getState;

  let adapter: FileLibraryBrowserAdapter | null = null;
  let generation = 0;
  let pageRequest: string | null = null;
  let searchTimer: unknown = null;
  let loadedKey: string | null = null;

  const currentFolderId = () => get().folders.at(-1)?.id;
  const searchFolderId = () => (get().searchScope === 'folder' ? currentFolderId() : undefined);
  const loadKey = () => {
    const { appliedQuery, searchScope, mimeTypePrefix, sort } = get();
    return JSON.stringify([
      currentFolderId() ?? null,
      appliedQuery,
      appliedQuery ? searchScope : null,
      mimeTypePrefix,
      sort,
    ]);
  };

  const cancelSearchTimer = () => {
    if (searchTimer !== null) {
      clock.clearTimeout(searchTimer);
      searchTimer = null;
    }
  };

  const load = async (): Promise<void> => {
    if (!adapter) {
      return;
    }
    const source = adapter;
    const request = ++generation;
    loadedKey = loadKey();
    pageRequest = null;
    set({
      loading: true,
      loadingMore: false,
      loadMoreError: null,
      error: null,
      folderNotFound: false,
      items: [],
      total: 0,
      nextPageToken: undefined,
      ...(preserveSelection ? {} : { selectedRows: [] }),
    });
    const { appliedQuery, mimeTypePrefix, sort } = get();
    const sortInput = parseFileBrowserSort(sort);
    try {
      if (appliedQuery) {
        const result = await source.search({
          query: appliedQuery,
          folderId: searchFolderId(),
          mimeTypePrefix,
          ...sortInput,
        });
        if (request === generation) {
          set({ items: result.items, total: result.total, nextPageToken: result.nextPageToken });
        }
      } else {
        const result = await source.list({ folderId: currentFolderId(), mimeTypePrefix, ...sortInput });
        if (request === generation) {
          set({ folderNotFound: result.folderNotFound, items: result.items, total: result.total });
        }
      }
    } catch {
      if (request === generation) {
        set({ error: 'load' });
      }
    } finally {
      if (request === generation) {
        set({ loading: false });
      }
    }
  };

  /** Loads only when the shown folder, search or filters changed since the last load. */
  const sync = () => {
    if (adapter && loadKey() !== loadedKey) {
      void load();
    }
  };

  const navigate = (folders: FileManagerPathSegment[]) => {
    cancelSearchTimer();
    set({
      folders,
      query: '',
      appliedQuery: '',
      folderNotFound: false,
      ...(preserveSelection ? {} : { selectedRows: [] }),
    });
    sync();
  };

  return {
    api,
    start: (nextAdapter) => {
      adapter = nextAdapter;
      void load();
    },
    stop: () => {
      adapter = null;
      generation += 1;
      pageRequest = null;
      loadedKey = null;
      cancelSearchTimer();
    },
    setQuery: (query) => {
      set({ query });
      cancelSearchTimer();
      searchTimer = clock.setTimeout(() => {
        searchTimer = null;
        const appliedQuery = query.trim();
        if (appliedQuery !== get().appliedQuery) {
          set({ appliedQuery });
          sync();
        }
      }, FILE_LIBRARY_SEARCH_DEBOUNCE_MS);
    },
    setSearchScope: (searchScope) => {
      set({ searchScope });
      sync();
    },
    setMimeTypePrefix: (mimeTypePrefix) => {
      set({ mimeTypePrefix });
      sync();
    },
    setSort: (sort) => {
      set({ sort });
      sync();
    },
    openFolder: (folder) => {
      const { appliedQuery, folders } = get();
      // A search result names its full location, so opening it replaces the path.
      navigate(
        appliedQuery && folder.folderPath?.length
          ? folder.folderPath
          : [...folders, { id: folder.id, name: folder.name }],
      );
    },
    openPath: (index) => navigate(get().folders.slice(0, index)),
    openParent: () => {
      const { folders } = get();
      if (folders.length > 0) {
        navigate(folders.slice(0, -1));
      }
    },
    showRoot: () => {
      set({ folders: [], ...(preserveSelection ? {} : { selectedRows: [] }) });
      return load();
    },
    reload: load,
    loadMore: async () => {
      const { appliedQuery, query, nextPageToken, loading, loadingMore, mimeTypePrefix, sort } = get();
      if (
        !adapter ||
        !appliedQuery ||
        query.trim() !== appliedQuery ||
        !nextPageToken ||
        loading ||
        loadingMore ||
        pageRequest !== null
      ) {
        return;
      }
      const source = adapter;
      const request = generation;
      const pageKey = JSON.stringify([request, nextPageToken]);
      pageRequest = pageKey;
      set({ loadingMore: true, loadMoreError: null });
      try {
        const result = await source.search({
          query: appliedQuery,
          folderId: searchFolderId(),
          mimeTypePrefix,
          ...parseFileBrowserSort(sort),
          pageToken: nextPageToken,
        });
        if (request !== generation) {
          return;
        }
        if (result.nextPageToken === nextPageToken) {
          throw new Error('File search returned the same continuation cursor');
        }
        set((state) => ({
          // Pages can overlap; an item keeps its first position and its latest value.
          items: [
            ...new Map([...state.items, ...result.items].map((item) => [`${item.kind}:${item.id}`, item])).values(),
          ],
          total: result.total,
          nextPageToken: result.nextPageToken,
        }));
      } catch {
        if (request === generation) {
          set({ loadMoreError: 'load' });
        }
      } finally {
        if (request === generation && pageRequest === pageKey) {
          pageRequest = null;
          set({ loadingMore: false });
        }
      }
    },
    setSelection: (selectedRows) => set({ selectedRows }),
    setPreserveSelection: (preserve) => {
      preserveSelection = preserve;
      if (!preserve && get().selectedRows.length > 0) {
        set({ selectedRows: [] });
      }
    },
    setError: (error) => set({ error }),
  };
}
