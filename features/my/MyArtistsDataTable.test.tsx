// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MyArtistsDataTable, type MyArtistsDataTableLabels, type MyArtistsDataTableProps } from './MyArtistsDataTable';
import type { MyArtistsTableRowViewModel } from './ui/MyArtistsTable';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { label?: string }) => values?.label ?? key,
}));

vi.mock('@/features/site/PageLoader', () => ({
  PageLoader: () => <div role="status">Loading artists</div>,
}));

const labels: MyArtistsDataTableLabels = {
  title: 'Artists',
  image: 'Image',
  name: 'Name',
  status: 'Status',
  created: 'Created',
  empty: 'No artists assigned to you.',
  searchPlaceholder: 'Search artists...',
};

const rows: MyArtistsTableRowViewModel[] = [
  {
    id: 'artist-1',
    name: 'Mina Park',
    slugLabel: '/mina-park',
    imageUrl: 'https://cdn.example.com/mina.jpg?w=96',
    href: '/artists/artist-1?edit=true',
    statusLabel: 'Published',
    statusTone: 'positive',
    createdLabel: '7/4/2026',
  },
];

const onQueryChange = vi.fn();
let container: HTMLDivElement;
let root: Root;

const defaultProps: MyArtistsDataTableProps = {
  result: {
    data: rows,
    total: 41,
    page: 1,
    pageSize: 20,
    totalPages: 3,
  },
  labels,
  query: { page: 1, pageSize: 20 },
  onQueryChange,
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  onQueryChange.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderDataTable(overrides: Partial<MyArtistsDataTableProps> = {}) {
  act(() => {
    root.render(
      <DesignSystemProvider forceColorScheme="light">
        <MyArtistsDataTable {...defaultProps} {...overrides} />
      </DesignSystemProvider>,
    );
  });
}

describe('MyArtistsDataTable', () => {
  it('renders only preformatted row display values and the supplied edit href', () => {
    renderDataTable();

    expect(container.querySelector('h1')?.textContent).toBe(labels.title);
    expect(container.querySelector('table')?.getAttribute('aria-label')).toBe(labels.title);
    const imageHeader = container.querySelector('thead th:first-child');
    expect(imageHeader).toHaveAccessibleName(labels.image);
    expect(imageHeader?.getAttribute('style')).toContain('width: 50px');
    const link = container.querySelector<HTMLAnchorElement>('a[href="/artists/artist-1?edit=true"]');
    expect(link?.textContent).toBe('Mina Park');
    expect(container.textContent).toContain('/mina-park');
    expect(container.textContent).toContain('Published');
    expect(container.textContent).toContain('7/4/2026');
    expect(container.querySelector<HTMLImageElement>('img')?.src).toContain('https://cdn.example.com/mina.jpg?w=96');
  });

  it('renders the supplied empty and loading states', () => {
    const emptyResult = { ...defaultProps.result!, data: [], total: 0, totalPages: 0 };
    renderDataTable({ result: emptyResult });
    expect(container.textContent).toContain(labels.empty);

    renderDataTable({ result: emptyResult, loading: true });
    expect(container.querySelector('[role="status"]')?.textContent).toBe('aria.loadingMessage');
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.textContent).not.toContain(labels.empty);
  });

  it('forwards pagination changes with the current query state', () => {
    renderDataTable();

    const pageTwoButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent === '2',
    );
    expect(pageTwoButton).toBeDefined();

    act(() => pageTwoButton?.click());
    expect(onQueryChange).toHaveBeenCalledWith({ page: 2, pageSize: 20 });
  });
});
