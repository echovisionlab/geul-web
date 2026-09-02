// @vitest-environment jsdom

import {
  act,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type Ref,
  type ReactNode,
} from 'react';
import { randomTestUuid } from '@echovisionlab/geul-common/test/random-id';
import { FileManagerSortField } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataTableViewProps } from '@/components/core/DataTable/DataTableView';
import type { FileBrowserGridViewProps } from '@/features/file-manager/ui/FileBrowserGridView';
import type { FileManagerRow, listFileManagerItemsAction, searchFileManagerItemsAction } from '@/lib/actions/file';
import { EditorFileLibraryPicker } from './EditorFileLibraryPicker';

const mockListFileManagerItemsAction = vi.fn<typeof listFileManagerItemsAction>();
const mockSearchFileManagerItemsAction = vi.fn<typeof searchFileManagerItemsAction>();

vi.mock('next-intl', () => {
  const translate = (key: string, values?: { count?: number }) =>
    values?.count == null ? key : `${key}:${values.count}`;
  return { useTranslations: () => translate };
});

vi.mock('@mantine/core', () => ({
  Box: ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> }) => (
    <div {...props}>{children}</div>
  ),
  Breadcrumbs: ({ children }: { children: ReactNode }) => <nav>{children}</nav>,
  Center: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Loader: () => <div>loading</div>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/core/Button', () => ({
  Button: ({
    children,
    leftSection: _leftSection,
    tone: _tone,
    emphasis: _emphasis,
    loading: _loading,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    leftSection?: ReactNode;
    tone?: string;
    emphasis?: string;
    loading?: boolean;
  }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/core/Input', () => ({
  TextInput: ({
    leftSection: _leftSection,
    ...props
  }: InputHTMLAttributes<HTMLInputElement> & { leftSection?: ReactNode }) => <input {...props} />,
  Select: ({
    data,
    onChange,
    ...props
  }: {
    data: { value: string; label: string }[];
    value: string;
    onChange: (value: string | null) => void;
    'aria-label': string;
  }) => (
    <select {...props} onChange={(event) => onChange(event.currentTarget.value)}>
      {data.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  ),
  SegmentedControl: ({
    data,
    onChange,
    ...props
  }: {
    data: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
    'aria-label': string;
  }) => (
    <select {...props} onChange={(event) => onChange(event.currentTarget.value)}>
      {data.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('@/components/core/TextButton', () => ({
  TextButton: ({
    children,
    appearance: _appearance,
    weight: _weight,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { appearance?: string; weight?: string }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/core/Modal', () => ({
  ContentModal: ({ opened, children }: { opened: boolean; children: ReactNode }) =>
    opened ? <div role="dialog">{children}</div> : null,
}));

vi.mock('@/components/core/DataTable', () => ({
  DataTableView: ({ rows, rowInteraction, getRowKey, loading }: DataTableViewProps<FileManagerRow>) =>
    loading ? (
      <div>loading</div>
    ) : (
      <div>
        {rows.map((row, index) => (
          <button
            type="button"
            key={getRowKey(row)}
            data-selected={rowInteraction?.isSelected?.(row) || undefined}
            disabled={rowInteraction?.isDisabled?.(row) || undefined}
            onClick={(event) => rowInteraction?.onClick?.(event, row, index)}
            onDoubleClick={(event) => rowInteraction?.onDoubleClick?.(event, row, index)}
            onKeyDown={(event) => rowInteraction?.onKeyDown?.(event, row, index)}
          >
            {row.kind === 'folder' ? row.name : `${row.fileName}.${row.extension}`}
          </button>
        ))}
      </div>
    ),
}));

vi.mock('@/components/core/DropdownMenu', () => {
  const Root = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    DropdownMenu: Object.assign(Root, {
      Target: ({ children }: { children: ReactNode }) => <>{children}</>,
      Dropdown: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Item: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
    }),
  };
});

vi.mock('@/features/file-manager/ui/FileBrowserGridView', () => ({
  FileBrowserGridView: ({
    items,
    selectedItemIds,
    onItemClick,
    onItemDoubleClick,
    onItemKeyDown,
  }: FileBrowserGridViewProps) => (
    <div>
      {items.map((item, index) => (
        <button
          type="button"
          key={item.id}
          data-selected={selectedItemIds.includes(item.id) || undefined}
          aria-disabled={item.disabled || undefined}
          onClick={(event) => onItemClick(event, item, index)}
          onDoubleClick={(event) => onItemDoubleClick(event, item, index)}
          onKeyDown={(event) => onItemKeyDown(event, item, index)}
        >
          {item.name}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('@/features/file-manager/ui/FileBrowserViewToggle', () => ({
  FileBrowserViewToggle: () => <div data-view-toggle />,
}));

vi.mock('@/lib/actions/file', () => ({
  listFileManagerItemsAction: (
    ...args: Parameters<typeof listFileManagerItemsAction>
  ): ReturnType<typeof listFileManagerItemsAction> => mockListFileManagerItemsAction(...args),
  searchFileManagerItemsAction: (
    ...args: Parameters<typeof searchFileManagerItemsAction>
  ): ReturnType<typeof searchFileManagerItemsAction> => mockSearchFileManagerItemsAction(...args),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  vi.useRealTimers();
  act(() => root.unmount());
  container.remove();
  mockListFileManagerItemsAction.mockReset();
  mockSearchFileManagerItemsAction.mockReset();
});

describe('EditorFileLibraryPicker', () => {
  it('opens folders on double click or Enter but not on a single click', async () => {
    const folderId = randomTestUuid();
    mockListFileManagerItemsAction
      .mockResolvedValueOnce({
        items: [
          {
            kind: 'folder',
            id: folderId,
            name: 'Recordings',
            createdAt: null,
            updatedAt: null,
          },
        ],
        total: 1,
        folderNotFound: false,
      })
      .mockResolvedValue({ items: [], total: 0, folderNotFound: false });

    await act(async () => {
      root.render(<EditorFileLibraryPicker onSelect={vi.fn()} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const folderButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Recordings',
    );
    act(() => folderButton?.click());
    expect(mockListFileManagerItemsAction).toHaveBeenCalledTimes(1);

    await act(async () => {
      folderButton?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockListFileManagerItemsAction).toHaveBeenLastCalledWith(expect.objectContaining({ folderId }));
  });

  it('shows every supported file kind and returns the selected File UUID projection as a list', async () => {
    const audioId = randomTestUuid();
    const videoId = randomTestUuid();
    mockListFileManagerItemsAction.mockResolvedValue({
      items: [
        {
          kind: 'file',
          id: audioId,
          fileName: 'recording',
          extension: 'wav',
          mimeType: 'audio/wav',
          fileSize: 4096,
          createdAt: null,
          updatedAt: null,
          usageCount: 0,
        },
        {
          kind: 'file',
          id: videoId,
          fileName: 'film',
          extension: 'mp4',
          mimeType: 'video/mp4',
          fileSize: 8192,
          createdAt: null,
          updatedAt: null,
          usageCount: 0,
        },
      ],
      total: 2,
      folderNotFound: false,
    });
    const onSelect = vi.fn();

    await act(async () => {
      root.render(<EditorFileLibraryPicker onSelect={onSelect} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockListFileManagerItemsAction).toHaveBeenCalledWith(expect.objectContaining({ folderId: undefined }));
    expect(container.textContent).toContain('recording.wav');
    expect(container.textContent).toContain('film.mp4');

    const recordingButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'recording.wav',
    );
    act(() => recordingButton?.click());
    const addButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'add');
    act(() => addButton?.click());

    expect(onSelect).toHaveBeenCalledWith([expect.objectContaining({ id: audioId, mimeType: 'audio/wav' })]);
  });

  it('keeps incompatible site-wide results visible and disabled while preserving the total', async () => {
    vi.useFakeTimers();
    mockListFileManagerItemsAction.mockResolvedValue({ items: [], total: 0, folderNotFound: false });
    mockSearchFileManagerItemsAction.mockResolvedValue({
      items: [
        {
          kind: 'folder',
          id: randomTestUuid(),
          name: 'Recordings',
          folderPath: [{ id: randomTestUuid(), name: 'Recordings' }],
          createdAt: null,
          updatedAt: null,
        },
        {
          kind: 'file',
          id: randomTestUuid(),
          fileName: 'field',
          extension: 'wav',
          mimeType: 'audio/wav',
          fileSize: 4096,
          folderPath: [],
          createdAt: null,
          updatedAt: null,
          usageCount: 0,
        },
        {
          kind: 'file',
          id: randomTestUuid(),
          fileName: 'poster',
          extension: 'png',
          mimeType: 'image/png',
          fileSize: Number.MAX_SAFE_INTEGER,
          folderPath: [],
          createdAt: null,
          updatedAt: null,
          usageCount: 0,
        },
      ],
      total: 12,
      nextPageToken: 'next',
    });

    await act(async () => {
      root.render(<EditorFileLibraryPicker onSelect={vi.fn()} />);
      await Promise.resolve();
    });
    const searchInput = container.querySelector<HTMLInputElement>('input[aria-label="search"]');
    await act(async () => {
      if (searchInput) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(searchInput, 'field');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSearchFileManagerItemsAction).toHaveBeenCalledWith(expect.objectContaining({ query: 'field' }));
    expect(container.textContent).toContain('Recordings');
    expect(container.textContent).toContain('field.wav');
    const incompatible = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'poster.png',
    );
    expect(incompatible?.getAttribute('aria-disabled')).toBe('true');
    expect(container.textContent).toContain('searchResultCount:12');
  });

  it('switches between the current folder subtree and all files with the shared sort and filter controls', async () => {
    vi.useFakeTimers();
    const folderId = randomTestUuid();
    mockListFileManagerItemsAction
      .mockResolvedValueOnce({
        items: [
          {
            kind: 'folder',
            id: folderId,
            name: 'Recordings',
            createdAt: null,
            updatedAt: null,
          },
        ],
        total: 1,
        folderNotFound: false,
      })
      .mockResolvedValue({ items: [], total: 0, folderNotFound: false });
    mockSearchFileManagerItemsAction.mockResolvedValue({ items: [], total: 0 });

    await act(async () => {
      root.render(<EditorFileLibraryPicker onSelect={vi.fn()} />);
      await Promise.resolve();
    });
    const folderButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Recordings',
    );
    await act(async () => {
      folderButton?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await Promise.resolve();
    });

    const searchInput = container.querySelector<HTMLInputElement>('input[aria-label="search"]');
    await act(async () => {
      if (searchInput) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(searchInput, 'field');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      vi.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockSearchFileManagerItemsAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: 'field', folderId }),
    );

    const scope = container.querySelector<HTMLSelectElement>('select[aria-label="searchScope.label"]');
    const sort = container.querySelector<HTMLSelectElement>('select[aria-label="sort.label"]');
    const filter = container.querySelector<HTMLSelectElement>('select[aria-label="columns.type"]');
    await act(async () => {
      if (scope) {
        scope.value = 'all';
        scope.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (sort) {
        sort.value = 'size:desc';
        sort.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (filter) {
        filter.value = 'audio/';
        filter.dispatchEvent(new Event('change', { bubbles: true }));
      }
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSearchFileManagerItemsAction).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: 'field',
        folderId: undefined,
        mimeTypePrefix: 'audio/',
        sortField: FileManagerSortField.FILE_SIZE,
        sortOrder: 'desc',
      }),
    );
  });
});
