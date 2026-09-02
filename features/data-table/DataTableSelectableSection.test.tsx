// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { LocaleProvider } from '@/lib/providers/LocaleProvider';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQuery } from '@/lib/types/common/query';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';
import { DataTableSelectableSection } from './DataTableSelectableSection';

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

vi.mock('./DataTable', () => {
  const TableContext = React.createContext<{
    result: PaginatedQueryResult<Row> | undefined;
    getRowKey: ((row: Row) => string) | undefined;
    selection:
      | {
          onSelectedRowKeysChange: (keys: string[]) => void;
          selectedOnPageRowKeys: string[];
        }
      | undefined;
  } | null>(null);

  function Root({
    children,
    result,
    getRowKey,
    selection,
  }: {
    children?: React.ReactNode;
    result?: PaginatedQueryResult<Row>;
    getRowKey?: (row: Row) => string;
    selection?: {
      onSelectedRowKeysChange: (keys: string[]) => void;
      selectedOnPageRowKeys: string[];
    };
  }) {
    return (
      <TableContext.Provider value={{ result, getRowKey, selection }}>
        <div data-testid="datatable-root">{children}</div>
      </TableContext.Provider>
    );
  }

  function Toolbar({ children }: { children?: React.ReactNode }) {
    return <div data-testid="datatable-toolbar">{children}</div>;
  }

  function Search(props: { placeholder: string }) {
    return <div data-testid="datatable-search">{props.placeholder}</div>;
  }

  function MultiFilter() {
    return <div data-testid="datatable-filter">filter</div>;
  }

  function MultiSort() {
    return <div data-testid="datatable-sort">sort</div>;
  }

  function Content() {
    const context = React.useContext(TableContext);
    return (
      <div data-testid="datatable-content">
        <button
          type="button"
          onClick={() =>
            context?.selection?.onSelectedRowKeysChange(
              context.result?.data.map((row) => context.getRowKey?.(row) ?? row.id) ?? [],
            )
          }
        >
          Select all
        </button>
        <button type="button" onClick={() => context?.selection?.onSelectedRowKeysChange(['row-1'])}>
          Select first
        </button>
        <div>{context?.selection ? 'selection-enabled' : 'selection-disabled'}</div>
        <div>selected:{context?.selection?.selectedOnPageRowKeys.join(',') ?? ''}</div>
      </div>
    );
  }

  function Pagination() {
    return <div data-testid="datatable-pagination">pagination</div>;
  }

  return {
    DataTable: Object.assign(Root, {
      Toolbar,
      Search,
      MultiFilter,
      MultiSort,
      Content,
      Pagination,
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
          <button key={item.label} type="button" onClick={item.onClick} disabled={item.disabled}>
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
const query: PaginatedQuery = {
  page: 1,
  pageSize: 20,
};
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

describe('DataTableSelectableSection', () => {
  it('does not render bulk actions or selected counts without bulk delete support', () => {
    render(
      <DataTableSelectableSection
        result={result}
        query={query}
        columns={columns}
        getRowKey={(row) => row.id}
        onQueryChange={vi.fn()}
        emptyMessage="No rows"
        searchPlaceholder="Search rows"
        filterFields={[]}
        sortFields={[]}
      />,
    );

    expect(document.body.textContent).toContain('Search rows');
    expect(document.body.textContent).not.toContain('선택');
    expect(document.body.textContent).not.toContain('Clear all');
    expect(document.querySelector('[data-testid="confirm-modal"]')).toBeNull();
  });

  it('runs mixed-result bulk deletes, keeps notifications, and forwards successful ids', async () => {
    const onSuccess = vi.fn();
    const deleteAction = vi
      .fn<(_: string) => Promise<{ success?: boolean; error?: string }>>()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ error: 'Second row failed' });

    render(
      <DataTableSelectableSection
        result={result}
        query={query}
        columns={columns}
        getRowKey={(row) => row.id}
        onQueryChange={vi.fn()}
        emptyMessage="No rows"
        searchPlaceholder="Search rows"
        filterFields={[]}
        sortFields={[]}
        bulkDelete={{
          entityLabel: 'rows',
          deleteAction,
          getRowLabel: (row) => row.title,
          onSuccess,
          successMessage: 'Deleted rows',
          successColor: 'green',
        }}
      />,
    );

    const selectAllButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Select all',
    );
    expect(selectAllButton).not.toBeNull();

    act(() => {
      selectAllButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain('2개 선택');

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
    expect(onSuccess).toHaveBeenCalledWith(['row-1']);
    expect(vi.mocked(notifications.show)).toHaveBeenNthCalledWith(1, {
      message: 'Second row failed',
      color: 'red',
    });
    expect(vi.mocked(notifications.show)).toHaveBeenNthCalledWith(2, {
      message: 'Deleted rows',
      color: 'green',
    });
    expect(document.body.textContent).not.toContain('2개 선택');
    expect(document.querySelector('[data-testid="confirm-modal"]')).toBeNull();
  });

  it('uses the selected row label when confirming a single bulk delete', async () => {
    render(
      <DataTableSelectableSection
        result={result}
        query={query}
        columns={columns}
        getRowKey={(row) => row.id}
        onQueryChange={vi.fn()}
        emptyMessage="No rows"
        searchPlaceholder="Search rows"
        filterFields={[]}
        sortFields={[]}
        bulkDelete={{
          entityLabel: 'rows',
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
    expect(document.body.textContent).not.toContain('1 rows');
  });
});
