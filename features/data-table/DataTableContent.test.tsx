// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DataTableContent } from './DataTableContent';

const mocks = vi.hoisted(() => ({
  context: undefined as unknown,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values?.label ? `${key}:${values.label}` : key,
}));

vi.mock('@/features/site/PageLoader', () => ({
  PageLoader: ({ minHeight }: { minHeight?: string | number }) => (
    <div data-testid="page-loader" data-min-height={minHeight}>
      Loader
    </div>
  ),
}));

vi.mock('./DataTableContext', () => ({
  useDataTableContext: () => mocks.context,
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

let host: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  host = document.createElement('div');
  host.setAttribute('data-datatable-root', '');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  host?.remove();
  host = null;
  root = null;
  vi.clearAllMocks();
});

function renderContent(context: unknown, sortConfig = '[]', maxSorts = '3') {
  host?.setAttribute('data-sort-config', sortConfig);
  host?.setAttribute('data-sort-max', maxSorts);
  mocks.context = context;

  act(() => {
    root?.render(
      <DesignSystemProvider forceColorScheme="light">
        <DataTableContent />
      </DesignSystemProvider>,
    );
  });
}

describe('DataTableContent', () => {
  it('renders cells, toggles row selection, and cycles supported sort fields', async () => {
    const onQueryChange = vi.fn();
    const onSelectedRowKeysChange = vi.fn();
    const onRowActivate = vi.fn();
    const rows = [
      { id: 'row-1', displayName: 'Alpha', count: 2 },
      { id: 'row-2', displayName: 'Beta', count: 3 },
    ];

    renderContent(
      {
        columns: [
          { key: 'displayName', header: 'Name', accessor: 'displayName' },
          { key: 'count', header: 'Count', cell: (row: (typeof rows)[number]) => `#${row.count}` },
          { key: 'actions', header: '', kind: 'action', cell: () => <button type="button">Open</button> },
        ],
        result: { data: rows, total: 2, page: 1, pageSize: 10, totalPages: 1 },
        loading: false,
        query: { page: 2, sorts: [{ field: 'display_name', direction: 'desc' }] },
        getRowKey: (row: (typeof rows)[number]) => row.id,
        rowAction: {
          getHref: (row: (typeof rows)[number]) => `/rows/${row.id}`,
          onActivate: onRowActivate,
          getAccessibleLabel: (row: (typeof rows)[number]) => `Open ${row.displayName}`,
        },
        onQueryChange,
        emptyMessage: 'No rows',
        selection: {
          selectedRowKeys: ['row-1'],
          onSelectedRowKeysChange,
          getRowLabel: (row: (typeof rows)[number]) => `Select ${row.displayName}`,
        },
      },
      JSON.stringify([
        { field: 'display_name', label: 'Name' },
        { field: 'count', label: 'Count' },
      ]),
      '2',
    );

    expect(document.body.textContent).toContain('Alpha');
    expect(document.body.textContent).toContain('#3');
    expect(document.body.textContent).toContain('↓');
    const sortButton = host!.querySelector<HTMLButtonElement>('button[aria-label="aria.sortBy:Name"]')!;
    expect(document.getElementById(sortButton.getAttribute('aria-describedby')!)?.textContent).toBe(
      'sort.aria.directionDescending',
    );

    const alphaCheckbox = document.querySelector<HTMLInputElement>('input[aria-label="Select Alpha"]');
    await act(async () => alphaCheckbox!.click());
    expect(onSelectedRowKeysChange).toHaveBeenCalledWith([]);

    const selectAll = document.querySelector<HTMLInputElement>('input[aria-label="aria.selectAllRows"]');
    await act(async () => selectAll!.click());
    expect(onSelectedRowKeysChange).toHaveBeenCalledWith(['row-1', 'row-2']);

    await act(async () => document.querySelector<HTMLTableRowElement>('tbody tr')!.click());
    expect(onRowActivate).toHaveBeenCalledWith(rows[0]);

    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="aria.sortBy:Name"]')!.click());
    expect(onQueryChange).toHaveBeenCalledWith({
      page: 1,
      sorts: [{ field: 'display_name', direction: 'asc' }],
    });
  });
});
