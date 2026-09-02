// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileUsageDomain } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { MantineProvider } from '@mantine/core';
import { FileManager } from './FileManager';
import type { FileManagerViewProps } from './FileManagerView';
import type { FileManagerFileView, FileManagerFolderView } from './model';

const mocks = vi.hoisted(() => ({
  listItems: vi.fn(),
  searchItems: vi.fn(),
  getDeletionImpact: vi.fn(),
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

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}));

vi.mock('@/lib/hooks/useFileUpload', () => ({
  useFileUpload: () => ({ upload: vi.fn() }),
}));

vi.mock('@/lib/actions/file', () => ({
  createFileFolderAction: vi.fn(),
  deleteFileFolderAction: vi.fn(),
  deleteManagedFilesAction: vi.fn(),
  getFileDeletionImpactAction: mocks.getDeletionImpact,
  getManagedFileAction: vi.fn(),
  listFileManagerItemsAction: mocks.listItems,
  searchFileManagerItemsAction: mocks.searchItems,
  listManagedFileUsagesAction: vi.fn(),
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

  it('clears the previous directory before a failed navigation result', async () => {
    mocks.listItems
      .mockResolvedValueOnce({ items: [folder], total: 1, folderNotFound: false })
      .mockRejectedValueOnce(new Error('Failed to load directory'));

    await act(async () => {
      root.render(
        <MantineProvider>
          <FileManager viewerRole="admin" />
        </MantineProvider>,
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
        <MantineProvider>
          <FileManager viewerRole="admin" />
        </MantineProvider>,
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
        <MantineProvider>
          <FileManager viewerRole="author" />
        </MantineProvider>,
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
});
