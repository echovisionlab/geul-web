// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { ServerDataTableContent } from './ServerDataTableContent';

const mocks = vi.hoisted(() => ({
  buildSortUrl: vi.fn(),
  parseTableQuery: vi.fn(),
  push: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/things',
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => mocks.searchParams,
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

vi.mock('@/lib/utils/table-url', () => ({
  buildSortUrl: mocks.buildSortUrl,
  parseTableQuery: mocks.parseTableQuery,
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
  vi.clearAllMocks();
  mocks.buildSortUrl.mockReturnValue('/admin/things?things_sort=title.asc');
  mocks.parseTableQuery.mockReturnValue({ sorts: [{ field: 'title', direction: 'desc' }] });
  mocks.searchParams = new URLSearchParams('things_sort=title.desc');
  host = document.createElement('div');
  host.setAttribute('data-datatable-root', '');
  host.setAttribute('data-namespace', 'things');
  host.setAttribute('data-sort-config', JSON.stringify([{ field: 'title', label: 'Title' }]));
  host.setAttribute('data-sort-max', '2');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  host?.remove();
  host = null;
  root = null;
});

describe('ServerDataTableContent', () => {
  it('renders empty and pending states', async () => {
    act(() => {
      root?.render(
        <MantineProvider>
          <ServerDataTableContent
            columns={[]}
            result={{ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }}
            getRowKey={() => ''}
            emptyMessage="Nothing found"
          />
        </MantineProvider>,
      );
    });

    expect(document.body.textContent).toContain('Nothing found');

    host?.setAttribute('data-pending', 'true');
    act(() => {
      root?.render(
        <MantineProvider>
          <ServerDataTableContent
            columns={[]}
            result={{ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }}
            getRowKey={() => ''}
            emptyMessage="Nothing found"
            reservedRowCount={2}
          />
        </MantineProvider>,
      );
    });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    const loader = document.querySelector('[data-testid="page-loader"]');
    expect(loader).not.toBeNull();
    expect(loader?.getAttribute('data-min-height')).toBe('0');
    expect(loader?.parentElement?.hasAttribute('data-datatable-loading')).toBe(true);
    expect(loader?.parentElement?.getAttribute('aria-busy')).toBe('true');
    expect(loader?.parentElement?.style.position).toBe('relative');
    expect(loader?.parentElement?.style.minHeight).toBe('164px');
  });

  it('renders rows, toggles current-page selection, and pushes sort URLs', () => {
    const onSelectedRowKeysChange = vi.fn();

    act(() => {
      root?.render(
        <MantineProvider>
          <ServerDataTableContent
            columns={[{ key: 'title', header: 'Title' }]}
            result={{
              data: [
                { id: 'row-1', title: 'Alpha' },
                { id: 'row-2', title: 'Beta' },
              ],
              total: 2,
              page: 1,
              pageSize: 10,
              totalPages: 1,
            }}
            getRowKey={(row) => row.id}
            selection={{
              selectedRowKeys: ['row-1'],
              onSelectedRowKeysChange,
              getRowLabel: (row) => `Select ${row.title}`,
            }}
          />
        </MantineProvider>,
      );
    });

    expect(document.body.textContent).toContain('Alpha');
    expect(document.body.textContent).toContain('↓');

    document.querySelector<HTMLInputElement>('input[aria-label="Select Beta"]')?.click();
    expect(onSelectedRowKeysChange).toHaveBeenCalledWith(['row-1', 'row-2']);

    document.querySelector<HTMLInputElement>('input[aria-label="Select all rows"]')?.click();
    expect(onSelectedRowKeysChange).toHaveBeenCalledWith(['row-1', 'row-2']);

    document.querySelector<HTMLButtonElement>('button[aria-label="aria.sortBy:Title"]')?.click();
    expect(mocks.buildSortUrl).toHaveBeenCalledWith(
      'things',
      mocks.searchParams,
      [{ field: 'title', direction: 'asc' }],
      '/admin/things',
    );
    expect(mocks.push).toHaveBeenCalledWith('/admin/things?things_sort=title.asc', {
      scroll: false,
    });
  });
});
