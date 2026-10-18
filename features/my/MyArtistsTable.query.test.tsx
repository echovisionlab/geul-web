// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import { MyArtistsTable } from './MyArtistsTable';

const firstPage = {
  data: Array.from({ length: 20 }, (_, index) => ({
    id: `artist-${index}`,
    name: `First page artist ${index}`,
    slug: `first-page-artist-${index}`,
    imageUrl: null,
    status: 'ARTIST_STATUS_PUBLISHED',
    createdAt: null,
  })),
  total: 40,
  page: 1,
  pageSize: 20,
  totalPages: 2,
};

describe('MyArtistsTable server pages', () => {
  it('does not present the server-rendered first page as the result of another page', async () => {
    const listAction = vi.fn(() => new Promise<never>(() => undefined));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { user } = render(
      <QueryClientProvider client={queryClient}>
        <MyArtistsTable initialData={firstPage} listAction={listAction} />
      </QueryClientProvider>,
    );
    expect(screen.getAllByText('First page artist 0').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(listAction).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    expect(screen.queryAllByText('First page artist 0')).toHaveLength(0);
  });
});
