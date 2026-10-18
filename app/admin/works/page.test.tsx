// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@/test/render';

import AdminWorksPage from './page';

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
const workActions = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), remove: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/works',
  useSearchParams: () => new URLSearchParams(),
}));

// Server actions are the boundary: the list returns the row the create action persisted on its next call.
vi.mock('@/lib/actions/work', () => ({
  createWorkAction: workActions.create,
  deleteWorkAction: workActions.remove,
  listWorksAdminAction: workActions.list,
}));

const createdWork = {
  id: 'new-work-id',
  title: 'Untitled Work',
  slug: null,
  type: 'portfolio',
  featuredImageUrl: null,
  featured: false,
  status: 'draft',
  creditCount: 0,
  clientCount: 0,
  createdAt: null,
  updatedAt: null,
};

function listResult(rows: (typeof createdWork)[]) {
  return {
    ok: true,
    value: { data: rows, total: rows.length, page: 1, pageSize: 20, totalPages: rows.length > 0 ? 1 : 0 },
  };
}

beforeEach(() => {
  navigation.push.mockReset();
  workActions.list
    .mockReset()
    .mockResolvedValueOnce(listResult([]))
    .mockResolvedValue(listResult([createdWork]));
  workActions.create.mockReset().mockResolvedValue({ data: { id: 'new-work-id' } });
  workActions.remove.mockReset();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AdminWorksPage', () => {
  it('refreshes the work list and opens the new work in the editor after creating it', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { user } = render(
      <QueryClientProvider client={queryClient}>
        <AdminWorksPage />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(workActions.list).toHaveBeenCalledTimes(1));

    await user.click(await screen.findByRole('button', { name: 'New Work' }));

    const rowLinks = await screen.findAllByRole('link', { name: 'Untitled Work' });
    for (const link of rowLinks) {
      expect(link.getAttribute('href')).toContain('new-work-id');
    }
    expect(workActions.list).toHaveBeenCalledTimes(2);
    expect(workActions.create).toHaveBeenCalledTimes(1);
    expect(navigation.push.mock.calls.filter(([href]) => href === '/works/new-work-id?edit=true')).toHaveLength(1);
  });
});
