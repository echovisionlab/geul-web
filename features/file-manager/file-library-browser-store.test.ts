import { FileManagerSortField } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { describe, expect, it, vi } from 'vitest';
import type { FileManagerFileRow, FileManagerFolderRow, FileManagerRow } from '@/lib/actions/file';
import {
  createFileLibraryBrowserStore,
  FILE_LIBRARY_SEARCH_DEBOUNCE_MS,
  type FileLibraryBrowserAdapter,
  type FileLibraryBrowserClock,
  type FileLibraryBrowserOptions,
} from './file-library-browser-store';

type ListResult = Awaited<ReturnType<FileLibraryBrowserAdapter['list']>>;
type SearchResult = Awaited<ReturnType<FileLibraryBrowserAdapter['search']>>;

/** Timers run only when a test advances this clock. */
function manualClock(): FileLibraryBrowserClock & { advance: (ms: number) => void } {
  let now = 0;
  let nextHandle = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  return {
    setTimeout: (callback, delayMs) => {
      nextHandle += 1;
      timers.set(nextHandle, { at: now + delayMs, callback });
      return nextHandle;
    },
    clearTimeout: (handle) => {
      timers.delete(handle as number);
    },
    advance: (ms) => {
      now += ms;
      for (const [handle, timer] of [...timers].sort(([, left], [, right]) => left.at - right.at)) {
        if (timer.at <= now && timers.has(handle)) {
          timers.delete(handle);
          timer.callback();
        }
      }
    },
  };
}

/** Lets resolved transport calls and the store's follow-up updates run. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function folderRow(overrides: Partial<FileManagerFolderRow> = {}): FileManagerFolderRow {
  return { kind: 'folder', id: 'folder-1', name: '2026', createdAt: null, updatedAt: null, ...overrides };
}

function fileRow(id: string): FileManagerFileRow {
  return {
    kind: 'file',
    id,
    fileName: id,
    extension: 'png',
    mimeType: 'image/png',
    fileSize: 1,
    createdAt: null,
    updatedAt: null,
    usageCount: 1,
  };
}

function directory(items: FileManagerRow[]): ListResult {
  return { items, total: items.length, folderNotFound: false };
}

const names = (folders: { name: string }[]) => folders.map((folder) => folder.name);

function setup(options: Omit<FileLibraryBrowserOptions, 'clock'> = {}) {
  const clock = manualClock();
  const adapter = {
    list: vi.fn<FileLibraryBrowserAdapter['list']>().mockResolvedValue(directory([])),
    search: vi.fn<FileLibraryBrowserAdapter['search']>().mockResolvedValue({ items: [], total: 0 }),
  };
  const store = createFileLibraryBrowserStore({ ...options, clock });
  const state = () => store.api.getState();
  const applyQuery = async (query: string) => {
    store.setQuery(query);
    clock.advance(FILE_LIBRARY_SEARCH_DEBOUNCE_MS);
    await settle();
  };
  return { store, adapter, clock, state, applyQuery };
}

describe('File library browser: File manager behavior', () => {
  const fileManager = { initialSearchScope: 'all' } as const;

  it('clears the previous directory before a failed navigation result', async () => {
    const { store, adapter, state } = setup(fileManager);
    const folder = folderRow();
    adapter.list
      .mockResolvedValueOnce(directory([folder]))
      .mockRejectedValueOnce(new Error('Failed to load directory'));
    store.start(adapter);
    await settle();
    expect(state().items).toEqual([folder]);

    store.openFolder(folder);
    await settle();

    expect(adapter.list).toHaveBeenLastCalledWith(expect.objectContaining({ folderId: 'folder-1' }));
    expect(names(state().folders)).toEqual(['2026']);
    expect(state().items).toEqual([]);
    expect(state().total).toBe(0);
    expect(state().error).toBe('load');
  });

  it('switches to paginated site-wide results and opens a folder by its returned path', async () => {
    const { store, adapter, state, applyQuery } = setup(fileManager);
    const searchFolder = folderRow({
      id: 'needle-folder',
      name: 'Needle',
      folderPath: [
        { id: 'library-folder', name: 'Library' },
        { id: 'needle-folder', name: 'Needle' },
      ],
    });
    adapter.search.mockResolvedValue({ items: [searchFolder], total: 12, nextPageToken: 'next' });
    store.start(adapter);
    await settle();

    await applyQuery('NeEdLe');

    expect(adapter.search).toHaveBeenCalledWith(expect.objectContaining({ query: 'NeEdLe', folderId: undefined }));
    expect(state().appliedQuery).toBe('NeEdLe');
    expect(state().total).toBe(12);
    expect(state().nextPageToken).toBe('next');

    store.openFolder(searchFolder);
    expect(names(state().folders)).toEqual(['Library', 'Needle']);
    expect(state().query).toBe('');
  });

  it('loads the real next cursor once, retains selection and deduplicates overlapping search pages', async () => {
    const { store, adapter, state, applyQuery } = setup(fileManager);
    const first = fileRow('first');
    const second = fileRow('second');
    const page = Promise.withResolvers<SearchResult>();
    adapter.search
      .mockResolvedValueOnce({ items: [first], total: 2, nextPageToken: 'page-2' })
      .mockReturnValueOnce(page.promise);
    store.start(adapter);
    await settle();
    await applyQuery('needle');
    store.setSelection([first]);

    void store.loadMore();
    void store.loadMore();

    expect(adapter.search).toHaveBeenCalledTimes(2);
    expect(adapter.search).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'needle', pageToken: 'page-2' }));
    expect(state().loadingMore).toBe(true);
    page.resolve({ items: [first, second], total: 2 });
    await settle();
    expect(state().items.map((item) => item.id)).toEqual(['first', 'second']);
    expect(state().selectedRows.map((row) => row.id)).toEqual(['first']);
    expect(state().loadingMore).toBe(false);
    expect(state().nextPageToken).toBeUndefined();
  });

  it('retains results after page failure, retries explicitly and discards a page from an obsolete query', async () => {
    const { store, adapter, state, applyQuery } = setup(fileManager);
    const first = fileRow('first');
    const replacement = fileRow('replacement');
    const page = Promise.withResolvers<SearchResult>();
    adapter.search
      .mockResolvedValueOnce({ items: [first], total: 2, nextPageToken: 'page-2' })
      .mockRejectedValueOnce(new Error('Offline'))
      .mockReturnValueOnce(page.promise)
      .mockResolvedValueOnce({ items: [replacement], total: 1 });
    store.start(adapter);
    await settle();
    await applyQuery('needle');

    await store.loadMore();
    expect(state().items).toEqual([first]);
    expect(state().loadMoreError).toBe('load');
    expect(state().nextPageToken).toBe('page-2');

    void store.loadMore();
    expect(state().loadMoreError).toBeNull();

    await applyQuery('replacement');
    page.resolve({ items: [fileRow('stale')], total: 2 });
    await settle();
    expect(state().items).toEqual([replacement]);
    expect(state().loadingMore).toBe(false);
    expect(state().loadMoreError).toBeNull();
  });
});

describe('File library browser: editor picker behavior', () => {
  it('browses and searches through the given transport', async () => {
    const { store, adapter, applyQuery } = setup();
    adapter.list.mockResolvedValue(directory([folderRow({ name: 'Local folder' })]));
    store.start(adapter);
    await settle();
    expect(adapter.list).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ folderId: undefined }));

    await applyQuery('local');
    expect(adapter.search).toHaveBeenCalledWith(expect.objectContaining({ query: 'local' }));
  });

  it('keeps picked Files across an opened folder when several can be picked', async () => {
    const { store, adapter, state } = setup({ preserveSelection: true });
    const folder = folderRow({ name: 'Folder' });
    const first = fileRow('first');
    const second = fileRow('second');
    adapter.list.mockResolvedValueOnce(directory([first, folder])).mockResolvedValue(directory([second]));
    store.start(adapter);
    await settle();
    store.setSelection([first]);

    store.openFolder(folder);
    await settle();

    expect(adapter.list).toHaveBeenLastCalledWith(expect.objectContaining({ folderId: folder.id }));
    expect(state().items).toEqual([second]);
    expect(state().selectedRows).toEqual([first]);
  });

  it('sends the current folder, search scope, sort and filter', async () => {
    const { store, adapter, applyQuery } = setup();
    const folder = folderRow();
    adapter.list.mockResolvedValueOnce(directory([folder]));
    store.start(adapter);
    await settle();
    store.openFolder(folder);
    await settle();
    await applyQuery('field');
    expect(adapter.search).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'field', folderId: folder.id }));

    store.setSearchScope('all');
    store.setSort('size:desc');
    store.setMimeTypePrefix('audio/');
    await settle();

    expect(adapter.search).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: 'field',
        folderId: undefined,
        mimeTypePrefix: 'audio/',
        sortField: FileManagerSortField.FILE_SIZE,
        sortOrder: 'desc',
      }),
    );
  });

  it('bounds continuation retries and preserves picked Files and deduplicated results', async () => {
    const { store, adapter, state, applyQuery } = setup({ preserveSelection: true });
    const first = fileRow('field-first');
    const second = fileRow('field-second');
    const page = Promise.withResolvers<SearchResult>();
    adapter.search
      .mockResolvedValueOnce({ items: [first], total: 2, nextPageToken: 'page-2' })
      .mockRejectedValueOnce(new Error('Offline'))
      .mockReturnValueOnce(page.promise);
    store.start(adapter);
    await settle();
    await applyQuery('field');
    store.setSelection([first]);

    await store.loadMore();
    expect(state().loadMoreError).toBe('load');
    expect(state().selectedRows).toEqual([first]);

    void store.loadMore();
    void store.loadMore();
    expect(adapter.search).toHaveBeenCalledTimes(3);
    expect(adapter.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: 'field', pageToken: 'page-2', folderId: undefined }),
    );
    page.resolve({ items: [first, second], total: 2 });
    await settle();

    expect(state().items).toEqual([first, second]);
    expect(state().selectedRows).toEqual([first]);
    expect(state().nextPageToken).toBeUndefined();
    expect(state().loadMoreError).toBeNull();
  });
});

describe('File library browser rules', () => {
  it('waits for a pause in typing before searching', async () => {
    const { store, adapter, clock } = setup();
    store.start(adapter);
    await settle();
    store.setQuery('n');
    clock.advance(200);
    store.setQuery('ne');
    clock.advance(200);
    expect(adapter.search).not.toHaveBeenCalled();

    clock.advance(100);
    await settle();
    expect(adapter.search).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ query: 'ne' }));
  });

  it('never searches for spaces, and does not search again when only surrounding spaces change', async () => {
    const { store, adapter, state, applyQuery } = setup();
    store.start(adapter);
    await settle();
    await applyQuery('   ');
    expect(adapter.search).not.toHaveBeenCalled();
    expect(adapter.list).toHaveBeenCalledTimes(1);

    await applyQuery('needle');
    await applyQuery(' needle ');
    expect(adapter.search).toHaveBeenCalledTimes(1);
    expect(state().appliedQuery).toBe('needle');
  });

  it('does not load again when the open breadcrumb is chosen, but still clears a single selection', async () => {
    const { store, adapter, state } = setup();
    store.start(adapter);
    await settle();
    store.openFolder(folderRow());
    await settle();
    store.setSelection([fileRow('picked')]);

    store.openPath(1);
    await settle();

    expect(adapter.list).toHaveBeenCalledTimes(2);
    expect(names(state().folders)).toEqual(['2026']);
    expect(state().selectedRows).toEqual([]);
  });

  it('opens the parent folder, and stays at the root when there is none', async () => {
    const { store, adapter, state } = setup();
    store.start(adapter);
    await settle();
    store.openParent();
    expect(state().folders).toEqual([]);
    expect(adapter.list).toHaveBeenCalledTimes(1);

    store.openFolder(folderRow());
    await settle();
    store.openParent();
    await settle();
    expect(state().folders).toEqual([]);
    expect(adapter.list).toHaveBeenCalledTimes(3);
    expect(adapter.list).toHaveBeenLastCalledWith(expect.objectContaining({ folderId: undefined }));
  });

  it('reports a missing folder and forgets it as soon as another folder opens', async () => {
    const { store, adapter, state } = setup();
    adapter.list
      .mockResolvedValueOnce(directory([]))
      .mockResolvedValueOnce({ items: [], total: 0, folderNotFound: true });
    store.start(adapter);
    await settle();
    store.openFolder(folderRow());
    await settle();
    expect(state().folderNotFound).toBe(true);

    store.openParent();
    expect(state().folderNotFound).toBe(false);
  });

  it('searches the whole library from inside a folder when its scope is all Files', async () => {
    const { store, adapter, applyQuery } = setup({ initialSearchScope: 'all' });
    store.start(adapter);
    await settle();
    store.openFolder(folderRow());
    await settle();
    await applyQuery('needle');
    expect(adapter.search).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'needle', folderId: undefined }));
  });

  it('does not load again when the search scope changes while browsing', async () => {
    const { store, adapter } = setup();
    store.start(adapter);
    await settle();
    store.setSearchScope('all');
    await settle();
    expect(adapter.list).toHaveBeenCalledTimes(1);
    expect(adapter.search).not.toHaveBeenCalled();
  });

  it('shows the root with the current search and always loads it again', async () => {
    const { store, adapter, state, applyQuery } = setup({ initialSearchScope: 'all' });
    store.start(adapter);
    await settle();
    store.openFolder(folderRow());
    await settle();
    await applyQuery('needle');
    expect(adapter.search).toHaveBeenCalledTimes(1);

    await store.showRoot();
    expect(state().folders).toEqual([]);
    expect(state().appliedQuery).toBe('needle');
    expect(adapter.search).toHaveBeenCalledTimes(2);

    await store.showRoot();
    expect(adapter.search).toHaveBeenCalledTimes(3);
  });

  it('keeps the newer search results when an older search answers last', async () => {
    const { store, adapter, state, applyQuery } = setup();
    const older = Promise.withResolvers<SearchResult>();
    const newer = fileRow('newer');
    adapter.search.mockReturnValueOnce(older.promise).mockResolvedValueOnce({ items: [newer], total: 1 });
    store.start(adapter);
    await settle();
    await applyQuery('old');
    await applyQuery('new');

    older.resolve({ items: [fileRow('older')], total: 1, nextPageToken: 'older-2' });
    await settle();

    expect(state().items).toEqual([newer]);
    expect(state().nextPageToken).toBeUndefined();
    expect(state().loading).toBe(false);
  });

  it('rejects a results page that repeats its continuation cursor', async () => {
    const { store, adapter, state, applyQuery } = setup();
    const first = fileRow('first');
    adapter.search
      .mockResolvedValueOnce({ items: [first], total: 2, nextPageToken: 'page-2' })
      .mockResolvedValueOnce({ items: [fileRow('repeat')], total: 2, nextPageToken: 'page-2' });
    store.start(adapter);
    await settle();
    await applyQuery('needle');

    await store.loadMore();

    expect(state().items).toEqual([first]);
    expect(state().loadMoreError).toBe('load');
    expect(state().nextPageToken).toBe('page-2');
  });

  it('does not load more while a typed query has not been applied yet', async () => {
    const { store, adapter, applyQuery } = setup();
    adapter.search.mockResolvedValueOnce({ items: [fileRow('first')], total: 2, nextPageToken: 'page-2' });
    store.start(adapter);
    await settle();
    await applyQuery('needle');
    store.setQuery('needles');

    await store.loadMore();

    expect(adapter.search).toHaveBeenCalledTimes(1);
  });

  it('clears a single selection when the shown items change, and keeps it when several Files can be picked', async () => {
    const { store, adapter, state } = setup();
    const picked = fileRow('picked');
    store.start(adapter);
    await settle();
    store.setSelection([picked]);
    store.setSort('size:desc');
    expect(state().selectedRows).toEqual([]);

    store.setPreserveSelection(true);
    store.setSelection([picked]);
    store.setSort('name:asc');
    await settle();
    expect(state().selectedRows).toEqual([picked]);
  });

  it('drops picked Files when several Files can no longer be picked', () => {
    const { store, state } = setup({ preserveSelection: true });
    store.setSelection([fileRow('first'), fileRow('second')]);

    store.setPreserveSelection(false);

    expect(state().selectedRows).toEqual([]);
  });

  it('ignores a response that arrives after it stopped', async () => {
    const { store, adapter, state } = setup();
    const listing = Promise.withResolvers<ListResult>();
    adapter.list.mockReturnValueOnce(listing.promise);
    store.start(adapter);
    store.stop();

    listing.resolve(directory([fileRow('late')]));
    await settle();

    expect(state().items).toEqual([]);
  });

  it('cancels a pending search pause when it stops, and loads again after a restart', async () => {
    const { store, adapter, state, clock } = setup();
    store.start(adapter);
    await settle();
    store.setQuery('needle');
    store.stop();
    clock.advance(FILE_LIBRARY_SEARCH_DEBOUNCE_MS);
    await settle();
    expect(adapter.search).not.toHaveBeenCalled();
    expect(state().appliedQuery).toBe('');

    store.start(adapter);
    await settle();
    expect(adapter.list).toHaveBeenCalledTimes(2);
  });
});
