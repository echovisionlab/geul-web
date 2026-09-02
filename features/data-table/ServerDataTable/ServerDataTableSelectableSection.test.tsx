// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { LocaleProvider } from '@/lib/providers/LocaleProvider';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';
import { ServerDataTableSelectableSection } from './ServerDataTableSelectableSection';

const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    const messages: Record<string, string> = {
      'actions.clearAll': 'Clear all',
      'actions.delete': 'Delete',
      'labels.actions': 'Actions',
      'errors.generic': 'Something went wrong',
    };
    if (key === 'messages.deleteNamedItemConfirm') {
      return `Are you sure you want to delete "${values?.name}"? This action cannot be undone.`;
    }
    if (key === 'messages.confirmDeleteSelectedCount') {
      return `Are you sure you want to delete ${values?.count} selected items? This action cannot be undone.`;
    }
    return messages[key] ?? key;
  },
}));

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

vi.mock('./ServerDataTable', () => {
  function Root({ children }: { children?: React.ReactNode }) {
    return <div data-testid="server-datatable-root">{children}</div>;
  }

  function Toolbar({ children }: { children?: React.ReactNode }) {
    return <div data-testid="server-datatable-toolbar">{children}</div>;
  }

  function Search(props: { namespace: string; placeholder: string }) {
    return (
      <div data-testid="server-datatable-search">
        {props.namespace}:{props.placeholder}
      </div>
    );
  }

  function MultiFilter(props: { namespace: string }) {
    return <div data-testid="server-datatable-filter">{props.namespace}:filter</div>;
  }

  function MultiSort(props: { namespace: string }) {
    return <div data-testid="server-datatable-sort">{props.namespace}:sort</div>;
  }

  function Content(props: {
    result: PaginatedQueryResult<{ id: string; title: string }>;
    getRowKey: (row: { id: string; title: string }) => string;
    selection?: {
      onSelectedRowKeysChange: (keys: string[]) => void;
      selectedOnPageRowKeys: string[];
    };
  }) {
    return (
      <div data-testid="server-datatable-content">
        <button
          type="button"
          onClick={() => props.selection?.onSelectedRowKeysChange(props.result.data.map((row) => props.getRowKey(row)))}
        >
          Select all
        </button>
        <button type="button" onClick={() => props.selection?.onSelectedRowKeysChange(['row-1'])}>
          Select first
        </button>
        <div>{props.selection ? 'selection-enabled' : 'selection-disabled'}</div>
        <div>selected:{props.selection?.selectedOnPageRowKeys.join(',') ?? ''}</div>
      </div>
    );
  }

  return {
    ServerDataTable: Object.assign(Root, {
      Toolbar,
      Search,
      MultiFilter,
      MultiSort,
      Content,
    }),
  };
});

vi.mock('@/components/core/DataTable', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/core/DataTable')>();

  return {
    ...actual,
    TableRowMenu: ({
      items,
      'aria-label': ariaLabel,
    }: {
      items: { label: string; onClick?: () => void; disabled?: boolean }[];
      'aria-label': string;
    }) => (
      <div data-testid="table-row-menu" aria-label={ariaLabel}>
        {items.map((item) => (
          <button key={item.label} type="button" disabled={item.disabled} onClick={item.onClick}>
            {item.label}
          </button>
        ))}
      </div>
    ),
  };
});

vi.mock('@/components/core/Modal', () => ({
  ConfirmModal: ({
    opened,
    title,
    message,
    onClose,
    onConfirm,
  }: {
    opened: boolean;
    title: string;
    message: React.ReactNode;
    onClose: () => void;
    onConfirm: () => void;
  }) =>
    opened ? (
      <div data-testid="confirm-modal">
        <div>{title}</div>
        <div>{message}</div>
        <button type="button" onClick={onClose}>
          Close
        </button>
        <button type="button" onClick={onConfirm}>
          Confirm
        </button>
      </div>
    ) : null,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

type Row = { id: string; title: string };

const columns: ColumnDef<Row>[] = [{ key: 'title', header: 'Title', accessor: 'title' }];
const result: PaginatedQueryResult<Row> = {
  data: [
    { id: 'row-1', title: 'First row' },
    { id: 'row-2', title: 'Second row' },
  ],
  total: 2,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <MantineProvider>
        <LocaleProvider locale="ko">{node}</LocaleProvider>
      </MantineProvider>,
    );
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  refreshMock.mockReset();
  vi.mocked(notifications.show).mockReset();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

describe('ServerDataTableSelectableSection', () => {
  it('does not enable row selection plumbing without bulk delete support', () => {
    render(
      <ServerDataTableSelectableSection
        namespace="posts"
        result={result}
        columns={columns}
        getRowKey={(row) => row.id}
        emptyMessage="No posts"
        searchPlaceholder="Search posts"
        filterFields={[]}
        sortFields={[]}
      />,
    );

    expect(document.body.textContent).toContain('selection-disabled');
    expect(document.body.textContent).not.toContain('선택');
    expect(document.body.textContent).not.toContain('Clear all');
  });

  it('tracks current-page selection and clears it through the bulk action menu', async () => {
    render(
      <ServerDataTableSelectableSection
        namespace="posts"
        result={result}
        columns={columns}
        getRowKey={(row) => row.id}
        emptyMessage="No posts"
        searchPlaceholder="Search posts"
        filterFields={[]}
        sortFields={[]}
        bulkDelete={{
          entityLabel: 'posts',
          deleteAction: vi.fn(),
          getRowLabel: (row) => row.title,
        }}
      />,
    );

    expect(document.body.textContent).toContain('selection-enabled');
    expect(document.body.textContent).not.toContain('2개 선택');

    const selectAllButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Select all',
    );
    expect(selectAllButton).not.toBeNull();

    act(() => {
      selectAllButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain('2개 선택');
    expect(document.body.textContent).toContain('selected:row-1,row-2');

    const clearAllButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Clear all',
    );
    expect(clearAllButton).not.toBeNull();

    act(() => {
      clearAllButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).not.toContain('2개 선택');
    expect(document.body.textContent).toContain('selected:');
  });

  it('shows delete errors, clears successful selections, and refreshes the router', async () => {
    const deleteAction = vi
      .fn<(_: string) => Promise<{ success?: boolean; error?: string }>>()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ error: 'Second row failed' });

    render(
      <ServerDataTableSelectableSection
        namespace="posts"
        result={result}
        columns={columns}
        getRowKey={(row) => row.id}
        emptyMessage="No posts"
        searchPlaceholder="Search posts"
        filterFields={[]}
        sortFields={[]}
        bulkDelete={{
          entityLabel: 'posts',
          deleteAction,
          getRowLabel: (row) => row.title,
        }}
      />,
    );

    const selectAllButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Select all',
    );
    act(() => {
      selectAllButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const deleteButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Delete',
    );
    expect(deleteButton).not.toBeNull();

    act(() => {
      deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain(
      'Are you sure you want to delete 2 selected items? This action cannot be undone.',
    );

    const confirmButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Confirm',
    );
    expect(confirmButton).not.toBeNull();

    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await flush();

    expect(deleteAction).toHaveBeenCalledTimes(2);
    expect(deleteAction).toHaveBeenNthCalledWith(1, 'row-1');
    expect(deleteAction).toHaveBeenNthCalledWith(2, 'row-2');
    expect(notifications.show).toHaveBeenCalledWith({
      message: 'Second row failed',
      color: 'red',
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain('2개 선택');
  });

  it('does not refresh or clear selection when every bulk delete fails', async () => {
    const deleteAction = vi
      .fn<(_: string) => Promise<{ success?: boolean; error?: string }>>()
      .mockResolvedValueOnce({ error: 'First row failed' })
      .mockResolvedValueOnce({ error: 'Second row failed' });

    render(
      <ServerDataTableSelectableSection
        namespace="posts"
        result={result}
        columns={columns}
        getRowKey={(row) => row.id}
        emptyMessage="No posts"
        searchPlaceholder="Search posts"
        filterFields={[]}
        sortFields={[]}
        bulkDelete={{
          entityLabel: 'posts',
          deleteAction,
          getRowLabel: (row) => row.title,
        }}
      />,
    );

    const selectAllButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Select all',
    );
    act(() => {
      selectAllButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const deleteButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Delete',
    );
    act(() => {
      deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const confirmButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Confirm',
    );

    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await flush();

    expect(notifications.show).toHaveBeenCalledWith({
      message: 'First row failed',
      color: 'red',
    });
    expect(refreshMock).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('2개 선택');
    expect(document.querySelector('[data-testid="confirm-modal"]')).not.toBeNull();
  });

  it('uses the selected row label when confirming a single bulk delete', async () => {
    render(
      <ServerDataTableSelectableSection
        namespace="posts"
        result={result}
        columns={columns}
        getRowKey={(row) => row.id}
        emptyMessage="No posts"
        searchPlaceholder="Search posts"
        filterFields={[]}
        sortFields={[]}
        bulkDelete={{
          entityLabel: 'posts',
          deleteAction: vi.fn().mockResolvedValue({ success: true }),
          getRowLabel: (row) => row.title,
        }}
      />,
    );

    const selectFirstButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Select first',
    );
    expect(selectFirstButton).not.toBeNull();

    act(() => {
      selectFirstButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const deleteButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Delete',
    );
    expect(deleteButton).not.toBeNull();

    act(() => {
      deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain(
      'Are you sure you want to delete "First row"? This action cannot be undone.',
    );
    expect(document.body.textContent).not.toContain('1 posts');
  });
});
