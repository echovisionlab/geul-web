// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileUsageDomain } from '@echovisionlab/geul-proto/secure/file_pb.ts';

import { notifications } from '@/components/core/Notification';
import { FileManager } from './FileManager';
import type { FileManagerViewProps } from './FileManagerView';
import type { FileManagerFileView, FileManagerFolderView } from './model';

const mocks = vi.hoisted(() => ({
  listItems: vi.fn(),
  searchItems: vi.fn(),
  getDeletionImpact: vi.fn(),
  getFile: vi.fn(),
  listUsages: vi.fn(),
  deleteFolder: vi.fn(),
  translate: (key: string, values?: Record<string, unknown>) => {
    if (values && 'count' in values) {
      return `${key}:${String(values.count)}`;
    }
    if (values && 'summary' in values) {
      return `${key}:${String(values.summary)}`;
    }
    return key;
  },
  viewProps: undefined as unknown,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => mocks.translate,
}));

vi.mock('@/components/core/Notification', () => ({
  notifications: { show: vi.fn() },
}));

vi.mock('@/lib/hooks/useFileUpload', () => ({
  useFileUpload: () => ({ upload: vi.fn() }),
}));

vi.mock('@/lib/actions/file', () => ({
  createFileFolderAction: vi.fn(),
  deleteFileFolderAction: mocks.deleteFolder,
  deleteManagedFilesAction: vi.fn(),
  getFileDeletionImpactAction: mocks.getDeletionImpact,
  getManagedFileAction: mocks.getFile,
  listFileManagerItemsAction: mocks.listItems,
  searchFileManagerItemsAction: mocks.searchItems,
  listManagedFileUsagesAction: mocks.listUsages,
  moveFileFolderAction: vi.fn(),
  moveManagedFilesAction: vi.fn(),
  renameFileFolderAction: vi.fn(),
  renameManagedFileAction: vi.fn(),
}));

vi.mock('./FileManagerView', () => ({
  FileManagerView: (props: FileManagerViewProps) => {
    mocks.viewProps = props;
    return null;
  },
}));

function getViewProps(): FileManagerViewProps {
  return mocks.viewProps as FileManagerViewProps;
}

const folder: FileManagerFolderView = {
  kind: 'folder',
  id: 'folder-1',
  name: '2026',
  createdAt: null,
  updatedAt: null,
};

function file(id: string): FileManagerFileView {
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

describe('FileManager directory loading', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.listItems.mockReset();
    mocks.searchItems.mockReset();
    mocks.getDeletionImpact.mockReset();
    mocks.getFile.mockReset();
    mocks.listUsages.mockReset();
    mocks.deleteFolder.mockReset();
    vi.mocked(notifications.show).mockReset();
    mocks.viewProps = undefined;
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => root.unmount());
    container.remove();
  });

  async function renderManager() {
    await act(async () => {
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <FileManager viewerRole="admin" />
        </DesignSystemProvider>,
      );
    });
  }

  it('stops loading a file when its details cannot be requested', async () => {
    const opened = file('file-1');
    mocks.listItems.mockResolvedValue({ items: [opened], total: 1, folderNotFound: false });
    mocks.getFile.mockRejectedValue(new Error('offline'));
    mocks.listUsages.mockResolvedValue({ success: true, usages: [] });
    await renderManager();

    await act(async () => {
      getViewProps().onOpenFile(opened);
    });

    expect(getViewProps().detailLoading).toBe(false);
    expect(notifications.show).toHaveBeenCalledWith({ tone: 'danger', message: 'errors.loadFile' });
  });

  it("loads one more page of a file's usages at a time", async () => {
    const opened = file('file-1');
    const nextPage = Promise.withResolvers<{ success: true; usages: [] }>();
    mocks.listItems.mockResolvedValue({ items: [opened], total: 1, folderNotFound: false });
    mocks.getFile.mockResolvedValue({ success: true, file: opened });
    mocks.listUsages
      .mockResolvedValueOnce({ success: true, usages: [], nextPageToken: 'usages-2' })
      .mockReturnValueOnce(nextPage.promise);
    await renderManager();
    await act(async () => {
      getViewProps().onOpenFile(opened);
    });

    await act(async () => {
      getViewProps().onLoadMoreDetailUsages();
      getViewProps().onLoadMoreDetailUsages();
    });

    expect(mocks.listUsages).toHaveBeenCalledTimes(2);
    expect(mocks.listUsages).toHaveBeenLastCalledWith({ fileId: 'file-1', pageSize: 25, pageToken: 'usages-2' });
    await act(async () => nextPage.resolve({ success: true, usages: [] }));
    expect(getViewProps().detailLoading).toBe(false);
  });

  it('stops checking a deletion when the usage check cannot be requested', async () => {
    const selected = file('file-1');
    mocks.listItems.mockResolvedValue({ items: [selected], total: 1, folderNotFound: false });
    mocks.getDeletionImpact.mockRejectedValue(new Error('offline'));
    await renderManager();
    await act(async () => {
      getViewProps().onSelectedItemIdsChange([selected.id]);
    });

    await act(async () => {
      getViewProps().onDeleteSelectedFiles();
    });

    expect(getViewProps().mutationLoading).toBe(false);
    expect(notifications.show).toHaveBeenCalledWith({ tone: 'danger', message: 'errors.inspectUsage' });
  });

  it('opens a breadcrumb by its index in the root-first path', async () => {
    const child: FileManagerFolderView = {
      kind: 'folder',
      id: 'folder-2',
      name: 'March',
      createdAt: null,
      updatedAt: null,
    };
    mocks.listItems.mockResolvedValue({ items: [], total: 0, folderNotFound: false });
    await renderManager();
    await act(async () => getViewProps().onOpenFolder(folder));
    await act(async () => getViewProps().onOpenFolder(child));
    expect(getViewProps().path.map((part) => part.name)).toEqual(['root', '2026', 'March']);

    await act(async () => getViewProps().onOpenPath(1));
    expect(getViewProps().path.map((part) => part.name)).toEqual(['root', '2026']);
    expect(mocks.listItems).toHaveBeenLastCalledWith(expect.objectContaining({ folderId: 'folder-1' }));

    await act(async () => getViewProps().onOpenPath(0));
    expect(getViewProps().path.map((part) => part.name)).toEqual(['root']);
    expect(mocks.listItems).toHaveBeenLastCalledWith(expect.objectContaining({ folderId: undefined }));
  });

  it('stops waiting for a folder deletion that cannot be requested', async () => {
    mocks.listItems.mockResolvedValue({ items: [folder], total: 1, folderNotFound: false });
    mocks.deleteFolder.mockRejectedValue(new Error('offline'));
    await renderManager();
    await act(async () => getViewProps().onDeleteFolder(folder));
    const confirm = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'actions.delete',
    );
    expect(confirm).toBeDefined();

    await act(async () => {
      confirm?.click();
    });

    expect(mocks.deleteFolder).toHaveBeenCalledWith('folder-1');
    expect(getViewProps().mutationLoading).toBe(false);
    expect(notifications.show).toHaveBeenCalledWith({ tone: 'danger', message: 'errors.mutation' });
  });

  it('clears the previous directory before a failed navigation result', async () => {
    mocks.listItems
      .mockResolvedValueOnce({ items: [folder], total: 1, folderNotFound: false })
      .mockRejectedValueOnce(new Error('Failed to load directory'));

    await act(async () => {
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <FileManager viewerRole="admin" />
        </DesignSystemProvider>,
      );
    });
    expect(getViewProps().items).toEqual([folder]);

    await act(async () => {
      getViewProps().onOpenFolder(folder);
    });

    expect(getViewProps().path.map((part) => part.name)).toEqual(['root', '2026']);
    expect(getViewProps().items).toEqual([]);
    expect(getViewProps().total).toBe(0);
    expect(getViewProps().error).toBe('errors.load');
  });

  it('shows at most five exact usages and derives the remainder from all selected files', async () => {
    const files = Array.from({ length: 6 }, (_, index) => file(`file-${index + 1}`));
    mocks.listItems.mockResolvedValue({ items: files, total: files.length, folderNotFound: false });
    mocks.getDeletionImpact.mockResolvedValue({
      success: true,
      impacts: files.map((item, index) => ({
        fileId: item.id,
        totalUsageCount: 1,
        domainCounts: [{ domain: FileUsageDomain.POST, count: 1 }],
        firstUsages: [
          {
            domain: FileUsageDomain.POST,
            entityId: `post-${index + 1}`,
            slot: 'editor',
            title: `Usage ${index + 1}`,
            count: 1,
          },
        ],
        hasMoreUsages: false,
      })),
    });

    await act(async () => {
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <FileManager viewerRole="admin" />
        </DesignSystemProvider>,
      );
    });
    await act(async () => {
      getViewProps().onSelectedItemIdsChange(files.map((item) => item.id));
    });
    await act(async () => {
      getViewProps().onDeleteSelectedFiles();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('dialogs.delete.totalUsages:6');
    expect(document.body.textContent).toContain('dialogs.delete.byDomain:post: 6');
    expect(document.body.textContent).toContain('Usage 5');
    expect(document.body.textContent).not.toContain('Usage 6');
    expect(document.body.textContent).toContain('dialogs.delete.more:1');
    expect(
      Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent === 'actions.delete')
        ?.hasAttribute('disabled'),
    ).toBe(true);
  });

  it('switches to paginated site-wide results and opens a folder by its returned path', async () => {
    vi.useFakeTimers();
    const searchFolder: FileManagerFolderView = {
      kind: 'folder',
      id: 'needle-folder',
      name: 'Needle',
      folderPath: [
        { id: 'library-folder', name: 'Library' },
        { id: 'needle-folder', name: 'Needle' },
      ],
      createdAt: null,
      updatedAt: null,
    };
    mocks.listItems.mockResolvedValue({ items: [], total: 0, folderNotFound: false });
    mocks.searchItems.mockResolvedValue({ items: [searchFolder], total: 12, nextPageToken: 'next' });

    await act(async () => {
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <FileManager viewerRole="author" />
        </DesignSystemProvider>,
      );
      await Promise.resolve();
    });
    await act(async () => {
      getViewProps().onQueryChange('NeEdLe');
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.searchItems).toHaveBeenCalledWith(expect.objectContaining({ query: 'NeEdLe' }));
    expect(getViewProps().searching).toBe(true);
    expect(getViewProps().viewMode).toBe('list');
    expect(getViewProps().total).toBe(12);
    expect(getViewProps().hasMoreItems).toBe(true);

    await act(async () => {
      getViewProps().onOpenFolder(searchFolder);
      await Promise.resolve();
    });
    expect(getViewProps().path.map((part) => part.name)).toEqual(['root', 'Library', 'Needle']);
    expect(getViewProps().query).toBe('');
  });

  it('loads the real next cursor once, retains selection and deduplicates overlapping search pages', async () => {
    vi.useFakeTimers();
    const first = file('first');
    const second = file('second');
    let resolvePage!: (result: { items: FileManagerFileView[]; total: number }) => void;
    const pending = new Promise<{ items: FileManagerFileView[]; total: number }>((resolve) => {
      resolvePage = resolve;
    });
    mocks.listItems.mockResolvedValue({ items: [], total: 0, folderNotFound: false });
    mocks.searchItems
      .mockResolvedValueOnce({ items: [first], total: 2, nextPageToken: 'page-2' })
      .mockReturnValueOnce(pending);
    await act(async () =>
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <FileManager viewerRole="author" />
        </DesignSystemProvider>,
      ),
    );
    await act(async () => getViewProps().onQueryChange('needle'));
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => getViewProps().onSelectedItemIdsChange([first.id]));
    const load = getViewProps().onLoadMoreItems;
    await act(async () => {
      void load();
      void load();
    });
    expect(mocks.searchItems).toHaveBeenCalledTimes(2);
    expect(mocks.searchItems).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: 'needle', pageToken: 'page-2' }),
    );
    expect(getViewProps().itemsLoadingMore).toBe(true);
    await act(async () => resolvePage({ items: [first, second], total: 2 }));
    expect(getViewProps().items.map((item) => item.id)).toEqual(['first', 'second']);
    expect(getViewProps().selectedItemIds).toEqual(['first']);
    expect(getViewProps().itemsLoadingMore).toBe(false);
    expect(getViewProps().hasMoreItems).toBe(false);
  });

  it('retains results after page failure, retries explicitly and discards a page from an obsolete query', async () => {
    vi.useFakeTimers();
    const first = file('first');
    const replacement = file('replacement');
    let resolvePage!: (result: { items: FileManagerFileView[]; total: number }) => void;
    const pending = new Promise<{ items: FileManagerFileView[]; total: number }>((resolve) => {
      resolvePage = resolve;
    });
    mocks.listItems.mockResolvedValue({ items: [], total: 0, folderNotFound: false });
    mocks.searchItems
      .mockResolvedValueOnce({ items: [first], total: 2, nextPageToken: 'page-2' })
      .mockRejectedValueOnce(new Error('Offline'))
      .mockReturnValueOnce(pending)
      .mockResolvedValueOnce({ items: [replacement], total: 1 });
    await act(async () =>
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <FileManager viewerRole="author" />
        </DesignSystemProvider>,
      ),
    );
    await act(async () => getViewProps().onQueryChange('needle'));
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => getViewProps().onLoadMoreItems());
    expect(getViewProps().items).toEqual([first]);
    expect(getViewProps().itemsLoadMoreError).toBe('errors.load');
    expect(getViewProps().hasMoreItems).toBe(true);
    await act(async () => {
      void getViewProps().onLoadMoreItems();
    });
    expect(getViewProps().itemsLoadMoreError).toBeNull();
    await act(async () => getViewProps().onQueryChange('replacement'));
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => resolvePage({ items: [file('stale')], total: 2 }));
    expect(getViewProps().items).toEqual([replacement]);
    expect(getViewProps().itemsLoadingMore).toBe(false);
    expect(getViewProps().itemsLoadMoreError).toBeNull();
  });
});
