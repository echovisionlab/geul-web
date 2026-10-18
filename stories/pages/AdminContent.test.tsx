// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@/test/render';
import { AdminContentPreview } from './AdminContent.stories';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/preview',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/actions/post', () => ({ createPostAction: vi.fn(), deletePostAdminAction: vi.fn() }));
vi.mock('@/lib/actions/page', () => ({ createPageAction: vi.fn(), deletePageAdminAction: vi.fn() }));

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

// The toolbar imports are shared setup; each case waits for its own observable controls.
beforeAll(async () => {
  await Promise.all([
    import('@/features/data-table/ServerDataTable/ServerDataTableSearchRuntime'),
    import('@/features/data-table/ServerDataTable/ServerDataTableMultiFilterRuntime'),
    import('@/features/data-table/ServerDataTable/ServerDataTableMultiSortRuntime'),
  ]);
}, 60_000);

describe('content list accessibility states', () => {
  it.each(['posts', 'pages'] as const)(
    'keeps %s visible titles and names the table, search, selection and results',
    async (domain) => {
      render(<AdminContentPreview domain={domain} />);
      const title = domain === 'posts' ? 'Posts' : 'Pages';
      expect(await screen.findByRole('searchbox', { name: `Search ${domain}...` })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
      expect(screen.getByRole('table', { name: title })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toBeInTheDocument();
      for (const checkbox of screen.getAllByRole('checkbox')) {
        expect(checkbox).toHaveAccessibleName();
      }
      expect(screen.getByRole('status')).toHaveTextContent('2 results');
      const name = domain === 'posts' ? 'Listening Notes' : 'Listening Room';
      expect(screen.getAllByRole('link', { name })[0]).toHaveAttribute(
        'href',
        expect.stringContaining(domain === 'posts' ? 'post-1' : 'page-1'),
      );
    },
  );

  // Both domains share the same table error branch.
  it('announces the actual error state without exposing stale rows', async () => {
    render(<AdminContentPreview domain="posts" state="error" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it.each(['posts', 'pages'] as const)(
    'deletes a %s row through its named menu and returns focus to list search',
    async (domain) => {
      const view = render(<AdminContentPreview domain={domain} />);
      const name = domain === 'posts' ? 'Listening Notes' : 'Listening Room';
      const triggers = await screen.findAllByRole('button', { name: `Actions for ${name}` });
      await view.user.click(triggers[0]!);
      const menu = await screen.findByRole('menu');
      await view.user.click(within(menu).getByRole('menuitem', { name: 'Delete' }));
      const dialog = await screen.findByRole('dialog', { name: 'Delete' });
      expect(dialog).toHaveTextContent(name);
      await view.user.click(within(dialog).getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(screen.queryAllByRole('button', { name: `Actions for ${name}` })).toHaveLength(0));
      await waitFor(() => expect(screen.getByRole('searchbox', { name: `Search ${domain}...` })).toHaveFocus());
    },
  );
});
