// @vitest-environment jsdom
import { mockBrowserNavigation } from '@/components/core/testing/browser-navigation';
import { ServerDataTablePendingProvider } from './ServerDataTableNavigation';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@/test/render';
import { ServerDataTablePaginationView } from './ServerDataTablePaginationView';
import { NavigationIntentProvider } from '@/components/core/Navigation/NavigationIntentProvider';
import { ServerDataTableContent } from './ServerDataTableContent';
const router = vi.hoisted(() => ({ push: vi.fn(), params: new URLSearchParams() }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/test',
  useSearchParams: () => router.params,
}));
const browserNavigation = mockBrowserNavigation();
const labels = {
  navigation: 'Post pages',
  firstPage: 'First page',
  previousPage: 'Previous page',
  page: (page: number) => `Page ${page}`,
  nextPage: 'Next page',
  lastPage: 'Last page',
};
const props = { currentPage: 3, totalPages: 8, getPageUrl: (page: number) => `/admin/posts?page=${page}`, labels };
describe('server table page navigation', () => {
  it.each(['ctrlKey', 'metaKey', 'shiftKey', 'altKey'] as const)(
    'preserves native %s link intent',
    async (modifier) => {
      const navigate = vi.fn();
      const { user } = render(<ServerDataTablePaginationView {...props} onNavigate={navigate} />);
      const next = screen.getByRole('link', { name: 'Next page' });
      browserNavigation.attach(screen.getByRole('navigation', { name: 'Post pages' }));
      fireEvent.click(next, { [modifier]: true });
      expect(navigate).not.toHaveBeenCalled();
      expect(browserNavigation.navigate).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ href: new URL('/admin/posts?page=4', window.location.href).href, [modifier]: true }),
      );
      expect(next).toHaveAttribute('href', '/admin/posts?page=4');
      await user.click(next);
      expect(navigate).toHaveBeenCalledExactlyOnceWith('/admin/posts?page=4');
      expect(browserNavigation.navigate).toHaveBeenCalledTimes(1);
    },
  );
  it('names pagination and preserves the current and last visible numbers', () => {
    render(<ServerDataTablePaginationView {...props} />);
    const nav = screen.getByRole('navigation', { name: 'Post pages' });
    expect(within(nav).getByRole('link', { name: 'Page 3' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Page 3' })).toHaveTextContent('3');
    expect(within(nav).getByRole('link', { name: 'Page 8' })).toHaveTextContent('8');
  });
  it('keeps first and previous bounds disabled and the ellipsis range', () => {
    render(<ServerDataTablePaginationView {...props} currentPage={1} />);
    expect(screen.getByRole('button', { name: 'First page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getAllByRole('link').map((link) => link.textContent || link.getAttribute('aria-label'))).toEqual([
      '1',
      '2',
      '3',
      '8',
      'Next page',
      'Last page',
    ]);
    expect(screen.getByRole('link', { name: 'Last page' })).toHaveAttribute('href', '/admin/posts?page=8');
  });
  it('omits navigation for empty data with or without a reserved footer', () => {
    const { rerender } = render(<ServerDataTablePaginationView {...props} totalPages={0} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    rerender(<ServerDataTablePaginationView {...props} totalPages={0} reserveSpaceWhenHidden />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
  it('preserves the application navigation guard before tracking a page change', async () => {
    router.push.mockReset();
    const { user } = render(
      <NavigationIntentProvider onNavigationIntent={(_intent, event) => event.preventDefault()}>
        <ServerDataTablePaginationView {...props} />
      </NavigationIntentProvider>,
    );
    await user.click(screen.getByRole('link', { name: 'Next page' }));
    expect(router.push).not.toHaveBeenCalled();
  });
  it('keeps another island pending when the first navigation finishes', async () => {
    const tasks: Array<() => void> = [];
    router.push.mockReset().mockImplementation(() => new Promise<void>((resolve) => tasks.push(resolve)));
    const { user } = render(
      <div role="region" aria-label="Concurrent posts" data-datatable-root>
        <ServerDataTablePendingProvider>
          <ServerDataTableContent
            columns={[]}
            result={{ data: [], total: 0, page: 1, pageSize: 1, totalPages: 0 }}
            getRowKey={() => ''}
          />
          <ServerDataTablePaginationView {...props} />
          <ServerDataTablePaginationView {...props} labels={{ ...labels, navigation: 'Other pages' }} />
        </ServerDataTablePendingProvider>
      </div>,
    );
    await user.click(
      within(screen.getByRole('navigation', { name: 'Post pages' })).getByRole('link', { name: 'Next page' }),
    );
    await user.click(
      within(screen.getByRole('navigation', { name: 'Other pages' })).getByRole('link', { name: 'Next page' }),
    );
    await act(async () => tasks[0]());
    expect(screen.getByRole('region', { name: 'Concurrent posts' })).toHaveAttribute('aria-busy', 'true');
    await act(async () => tasks[1]());
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Concurrent posts' })).toHaveAttribute('aria-busy', 'false'),
    );
  });
  it.each([undefined, false])(
    'retains current rows during deferred pagination with showPendingLoader=%s',
    async (showPendingLoader) => {
      let finish!: () => void;
      router.push.mockReset().mockReturnValue(
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      );
      const { user } = render(
        <div role="region" aria-label="Posts" data-datatable-root>
          <ServerDataTablePendingProvider>
            <ServerDataTableContent
              columns={[{ key: 'title', header: 'Title', cell: (row: { id: string; title: string }) => row.title }]}
              result={{ data: [{ id: 'one', title: 'Notes' }], total: 8, page: 3, pageSize: 1, totalPages: 8 }}
              getRowKey={(row) => row.id}
              showPendingLoader={showPendingLoader}
            />
            <ServerDataTablePaginationView {...props} />
          </ServerDataTablePendingProvider>
        </div>,
      );
      const row = screen.getByRole('cell', { name: 'Notes' });
      await user.click(screen.getByRole('link', { name: 'Next page' }));
      await waitFor(() => expect(screen.getByRole('region', { name: 'Posts' })).toHaveAttribute('aria-busy', 'true'));
      expect(screen.getByRole('cell', { name: 'Notes' })).toBe(row);
      await act(async () => finish());
      expect(await screen.findByRole('cell', { name: 'Notes' })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('region', { name: 'Posts' })).toHaveAttribute('aria-busy', 'false'));
    },
  );
});
