// @vitest-environment jsdom
import { randomTestUuid } from '@echovisionlab/geul-common/test/random-id';
import { FileManagerSortField } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listFileManagerItemsAction,
  searchFileManagerItemsAction,
  type FileManagerFileRow,
  type FileManagerFolderRow,
  type FileManagerRow,
} from '@/lib/actions/file';
import { act, fireEvent, render, screen } from '@/test/render';
import { EditorFileLibraryPicker } from './EditorFileLibraryPicker';
vi.mock('@/lib/actions/file', () => ({
  listFileManagerItemsAction: vi.fn(),
  searchFileManagerItemsAction: vi.fn(),
}));

type ListResult = Awaited<ReturnType<typeof listFileManagerItemsAction>>;
type SearchResult = Awaited<ReturnType<typeof searchFileManagerItemsAction>>;

function fileRow(overrides: Partial<FileManagerFileRow> = {}): FileManagerFileRow {
  return {
    kind: 'file',
    id: randomTestUuid(),
    fileName: 'recording',
    extension: 'wav',
    mimeType: 'audio/wav',
    fileSize: 4096,
    createdAt: null,
    updatedAt: null,
    usageCount: 0,
    ...overrides,
  };
}

function folderRow(overrides: Partial<FileManagerFolderRow> = {}): FileManagerFolderRow {
  return { kind: 'folder', id: randomTestUuid(), name: 'Recordings', createdAt: null, updatedAt: null, ...overrides };
}

function directory(items: FileManagerRow[]): ListResult {
  return { items, total: items.length, folderNotFound: false };
}

function transport() {
  return {
    list: vi.fn<typeof listFileManagerItemsAction>().mockResolvedValue(directory([])),
    search: vi.fn<typeof searchFileManagerItemsAction>().mockResolvedValue({ items: [], total: 0 }),
  };
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', undefined);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.mocked(listFileManagerItemsAction).mockReset();
  vi.mocked(searchFileManagerItemsAction).mockReset();
});

function renderPicker(props: Parameters<typeof EditorFileLibraryPicker>[0]) {
  return render(<EditorFileLibraryPicker {...props} />).user;
}

async function searchFor(query: string) {
  vi.useFakeTimers();
  try {
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search files and folders' }), { target: { value: query } });
    await act(() => vi.advanceTimersByTimeAsync(300));
  } finally {
    vi.useRealTimers();
  }
}

describe('EditorFileLibraryPicker', () => {
  it('runs browse and search against an injected transport without calling server actions', async () => {
    const dataSource = transport();
    const folder = folderRow({ name: 'Local folder' });
    dataSource.list.mockResolvedValue(directory([folder]));
    renderPicker({ dataSource, onSelect: vi.fn() });

    expect(await screen.findByRole('row', { name: 'Local folder' })).toBeInTheDocument();
    await searchFor('local');

    expect(dataSource.search).toHaveBeenCalledWith(expect.objectContaining({ query: 'local' }));
    expect(listFileManagerItemsAction).not.toHaveBeenCalled();
    expect(searchFileManagerItemsAction).not.toHaveBeenCalled();
  });

  it('shows supported file kinds and confirms one selected file as a list', async () => {
    const dataSource = transport();
    const audio = fileRow();
    const video = fileRow({ fileName: 'film', extension: 'mp4', mimeType: 'video/mp4', fileSize: 8192 });
    dataSource.list.mockResolvedValue(directory([audio, video]));
    const onSelect = vi.fn();
    const user = renderPicker({ dataSource, onSelect });

    expect(await screen.findByRole('row', { name: 'film.mp4' })).toBeInTheDocument();
    await user.click(screen.getByRole('row', { name: 'recording.wav' }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ id: audio.id, mimeType: 'audio/wav' }),
    ]);
  });

  it('keeps file selection across a keyboard-opened folder and confirms all selected files', async () => {
    const dataSource = transport();
    const folder = folderRow({ name: 'Folder' });
    const first = fileRow({ fileName: 'first' });
    const second = fileRow({ fileName: 'second' });
    dataSource.list.mockResolvedValueOnce(directory([first, folder])).mockResolvedValue(directory([second]));
    const onSelect = vi.fn();
    const user = renderPicker({ allowMultiple: true, dataSource, onSelect });

    await user.click(await screen.findByRole('row', { name: 'first.wav' }));
    const folderEntry = screen.getByRole('row', { name: 'Folder' });
    act(() => folderEntry.focus());
    await user.keyboard('{Enter}');

    expect(screen.getByText('1 item selected')).toBeInTheDocument();
    await user.keyboard('{Control>}');
    await user.click(screen.getByRole('row', { name: 'second.wav' }));
    await user.keyboard('{/Control}');
    expect(screen.getByText('2 items selected')).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith([first, second]);
  });

  it('keeps incompatible search results visible with their unavailable description and the server total', async () => {
    const dataSource = transport();
    const folder = folderRow({ folderPath: [{ id: randomTestUuid(), name: 'Recordings' }] });
    const audio = fileRow({ fileName: 'field', folderPath: [] });
    const oversizedImage = fileRow({
      fileName: 'poster',
      extension: 'png',
      mimeType: 'image/png',
      fileSize: Number.MAX_SAFE_INTEGER,
      folderPath: [],
    });
    dataSource.search.mockResolvedValue({ items: [folder, audio, oversizedImage], total: 12, nextPageToken: 'next' });
    const onSelect = vi.fn();
    const user = renderPicker({ dataSource, onSelect });
    await searchFor('field');

    expect(screen.getByText('12 results found')).toBeInTheDocument();
    const unavailable = screen.getByRole('row', { name: 'poster.png' });
    expect(unavailable).toHaveAccessibleDescription('This file cannot be added. Press Enter to preview it.');
    await user.click(unavailable);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('row', { name: 'field.wav' })).toBeInTheDocument();
  });

  it('sends the current folder, search scope, sort and filter selected through the shared controls', async () => {
    const dataSource = transport();
    const folder = folderRow();
    dataSource.list.mockResolvedValueOnce(directory([folder]));
    const user = renderPicker({ dataSource, onSelect: vi.fn() });
    const folderEntry = await screen.findByRole('row', { name: 'Recordings' });
    await user.click(folderEntry);
    expect(dataSource.list).toHaveBeenCalledTimes(1);
    await user.keyboard('{Enter}');
    await searchFor('field');

    await user.click(screen.getByRole('button', { name: 'Search · All files' }));
    await user.click(screen.getByRole('combobox', { name: 'Sort' }));
    await user.keyboard('{ArrowDown}');
    await user.click(screen.getByRole('option', { name: 'Largest' }));
    await user.click(screen.getByRole('combobox', { name: 'Type' }));
    await user.keyboard('{ArrowDown}');
    await user.click(screen.getByRole('option', { name: 'Audio' }));

    expect(dataSource.search).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: 'field',
        folderId: undefined,
        mimeTypePrefix: 'audio/',
        sortField: FileManagerSortField.FILE_SIZE,
        sortOrder: 'desc',
      }),
    );
  });

  it('bounds continuation retries and preserves selected files and deduplicated results', async () => {
    const dataSource = transport();
    const first = fileRow({ fileName: 'field-first' });
    const second = fileRow({ fileName: 'field-second' });
    let resolvePage!: (result: SearchResult) => void;
    dataSource.search
      .mockResolvedValueOnce({ items: [first], total: 2, nextPageToken: 'page-2' })
      .mockRejectedValueOnce(new Error('Offline'))
      .mockReturnValueOnce(new Promise<SearchResult>((resolve) => (resolvePage = resolve)));
    const onSelect = vi.fn();
    const user = renderPicker({ allowMultiple: true, dataSource, onSelect });
    await searchFor('field');
    await user.click(screen.getByRole('row', { name: 'field-first.wav' }));
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load files.');
    expect(screen.getByText('1 item selected')).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: 'Try again' });
    await user.dblClick(retry);
    await act(async () => resolvePage({ items: [first, second], total: 2 }));

    expect(screen.getByRole('row', { name: 'field-second.wav' })).toBeInTheDocument();
    expect(screen.getByText('1 item selected')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('End of results');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith([first]);
  });
});
