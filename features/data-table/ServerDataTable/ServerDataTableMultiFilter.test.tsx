// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@/test/render';
import { ServerDataTableMultiFilter } from './ServerDataTableMultiFilterRuntime';
import { ServerDataTableContent } from './ServerDataTableContent';
const router = vi.hoisted(() => ({ push: vi.fn(), params: new URLSearchParams() }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/test',
  useSearchParams: () => router.params,
}));
describe('ServerDataTableMultiFilter', () => {
  it('keeps draft filters local and exposes recovery pending without hiding the query error', async () => {
    router.params = new URLSearchParams({
      posts: JSON.stringify({ filters: [{ field: 'title', op: 'eq', value: 'space' }], filterBy: 'AND' }),
    });
    let finish!: () => void;
    router.push.mockReset().mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { user } = render(
      <div role="region" aria-label="Posts" data-datatable-root data-namespace="posts">
        <ServerDataTableMultiFilter namespace="posts" fields={[{ field: 'title', label: 'Title', type: 'string' }]} />
        <ServerDataTableContent
          columns={[]}
          result={{ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0, error: 'Could not load posts' }}
          getRowKey={() => ''}
        />
      </div>,
    );
    await user.click(screen.getByRole('button', { name: 'Filter (1)' }));
    await user.click(await screen.findByRole('button', { name: 'Clear all' }));
    expect(router.push).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(decodeURIComponent(router.push.mock.calls[0][0])).not.toContain('"filters"');
    expect(screen.getByRole('button', { name: 'Apply' })).toHaveAttribute('aria-busy', 'true');
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Posts', hidden: true })).toHaveAttribute('aria-busy', 'true'),
    );
    expect(screen.getByRole('alert', { hidden: true })).toHaveTextContent('Could not load posts');
    expect(screen.getByRole('status', { name: 'Loading...', hidden: true })).toHaveTextContent('Loading');
    await act(async () => finish());
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Posts', hidden: true })).toHaveAttribute('aria-busy', 'false'),
    );
    expect(screen.getByRole('alert', { hidden: true })).toHaveTextContent('Could not load posts');
  });
});
