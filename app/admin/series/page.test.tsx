import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listSeriesAdmin: vi.fn(),
  tableProps: null as null | {
    filterFields: { field: string; operators?: string[] }[];
    sortFields: { field: string }[];
  },
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

vi.mock('@/features/admin/ui/AdminPageHeader', () => ({ AdminPageHeader: () => null }));

vi.mock('@/features/data-table/ServerDataTable', () => {
  const ServerDataTable = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  ServerDataTable.Pagination = () => null;
  return { ServerDataTable };
});

vi.mock('@/features/admin/series', () => ({
  CreateSeriesButton: () => null,
  SeriesModalProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  SeriesModals: () => null,
  SeriesTableContent: (props: NonNullable<typeof mocks.tableProps>) => {
    mocks.tableProps = props;
    return null;
  },
}));

vi.mock('@/lib/queries/series', () => ({ listSeriesAdmin: mocks.listSeriesAdmin }));

import AdminSeriesPage from './page';

describe('AdminSeriesPage query controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tableProps = null;
    mocks.listSeriesAdmin.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
  });

  it('only exposes filters and sorts supported by the current Series API', async () => {
    const element = await AdminSeriesPage({ searchParams: Promise.resolve({}) });
    renderToStaticMarkup(element);

    expect(mocks.tableProps?.filterFields.map((field) => field.field)).toEqual(['status']);
    expect(mocks.tableProps?.filterFields[0]?.operators).toEqual(['eq']);
    expect(mocks.tableProps?.sortFields.map((field) => field.field)).toEqual(['title', 'status', 'created_at']);
  });

  it('forwards title search and status without forwarding unsupported filters', async () => {
    const query = JSON.stringify({
      search: 'sessions',
      filters: [
        { field: 'status', op: 'eq', value: 'published' },
        { field: 'slug', op: 'ilike', value: 'ignored' },
      ],
    });
    const element = await AdminSeriesPage({ searchParams: Promise.resolve({ series: query }) });
    renderToStaticMarkup(element);

    expect(mocks.listSeriesAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'sessions', status: 'published' }),
    );
    expect(mocks.listSeriesAdmin.mock.calls[0]?.[0]).not.toHaveProperty('filter');
  });
});
