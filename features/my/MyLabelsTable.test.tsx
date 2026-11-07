// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import { MyLabelsTable } from './MyLabelsTable';

function page(rows: Parameters<typeof MyLabelsTable>[0]['initialData']['data'], total = rows.length) {
  return { data: rows, total, page: 1, pageSize: 20, totalPages: Math.ceil(total / 20) };
}

function renderTable(props: Parameters<typeof MyLabelsTable>[0]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MyLabelsTable {...props} />
    </QueryClientProvider>,
  );
}

const row = {
  id: 'label-1',
  name: 'Night Signals Records',
  slug: 'night-signals-records',
  imageLightUrl: null,
  imageDarkUrl: null,
  status: 'draft',
  createdAt: null,
};

describe('MyLabelsTable', () => {
  it('opens a draft Label in its editor by ID', () => {
    renderTable({ initialData: page([row]) });

    const link = screen.getAllByRole('link', { name: 'Night Signals Records' })[0];
    expect(link.getAttribute('href')).toBe('/labels/label-1?edit=true');
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
    expect(screen.getAllByText('/night-signals-records').length).toBeGreaterThan(0);
  });

  it('does not present the server-rendered first page as the result of another page', async () => {
    const listAction = vi.fn(() => new Promise<never>(() => undefined));
    const rows = Array.from({ length: 20 }, (_, index) => ({ ...row, id: `label-${index}`, name: `Label ${index}` }));
    const { user } = renderTable({ initialData: page(rows, 40), listAction });
    expect(screen.getAllByText('Label 0').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(listAction).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    expect(screen.queryAllByText('Label 0')).toHaveLength(0);
  });
});
