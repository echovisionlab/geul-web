// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServerDataTablePendingProvider } from './ServerDataTableNavigation';
import { act, render, screen, waitFor, within } from '@/test/render';
import { LocaleProvider } from '@/lib/providers/LocaleProvider';
import { notifications } from '@/components/core/Notification';
import { ServerDataTableSelectableSection } from './ServerDataTableSelectableSection';
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), params: new URLSearchParams() }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/posts',
  useSearchParams: () => router.params,
}));
const result = {
  data: [
    { id: 'row-1', title: 'First row' },
    { id: 'row-2', title: 'Second row' },
  ],
  total: 2,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};
const deleteAction = vi.fn<(id: string) => Promise<{ success?: boolean; error?: string }>>();
function setup(bulk = true) {
  return render(
    <LocaleProvider locale="ko">
      <div role="region" aria-label="Posts" data-datatable-root data-namespace="posts">
        <ServerDataTablePendingProvider>
          <ServerDataTableSelectableSection
            namespace="posts"
            result={result}
            columns={[{ key: 'title', header: 'Title', accessor: 'title' }]}
            getRowKey={(row) => row.id}
            emptyMessage="No posts"
            searchPlaceholder="Search posts"
            filterFields={[]}
            sortFields={[]}
            bulkDelete={bulk ? { entityLabel: 'posts', deleteAction, getRowLabel: (row) => row.title } : undefined}
          />
        </ServerDataTablePendingProvider>
      </div>
    </LocaleProvider>,
  );
}
async function openDelete(user: ReturnType<typeof render>['user']) {
  await user.click(screen.getByRole('button', { name: 'Actions for posts' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
  return screen.findByRole('dialog', { name: 'Delete' });
}
beforeEach(() => {
  router.refresh.mockReset();
  deleteAction.mockReset().mockResolvedValue({ success: true });
});
describe('ServerDataTableSelectableSection', () => {
  it('does not enable row selection without bulk delete support', () => {
    setup(false);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actions for posts' })).not.toBeInTheDocument();
  });
  it('tracks current-page selection and clears it through the real action menu', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    expect(screen.getByText('2개 선택')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByRole('checkbox', { name: 'First row' })).toBeChecked();
    expect(within(screen.getByRole('table')).getByRole('checkbox', { name: 'Second row' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Actions for posts' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Clear all' }));
    expect(screen.queryByText('2개 선택')).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByRole('checkbox', { name: 'First row' })).not.toBeChecked();
    expect(within(screen.getByRole('table')).getByRole('checkbox', { name: 'Second row' })).not.toBeChecked();
  });
  it('reports partial failures, clears selections and shows table pending until refresh completes', async () => {
    const notice = vi.spyOn(notifications, 'show');
    let finish!: () => void;
    router.refresh.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    deleteAction.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ error: 'Second row failed' });
    try {
      const { user } = setup();
      await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
      const dialog = await openDelete(user);
      expect(dialog).toHaveTextContent(
        'Are you sure you want to delete 2 selected items? This action cannot be undone.',
      );
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
      expect(deleteAction).toHaveBeenNthCalledWith(1, 'row-1');
      expect(deleteAction).toHaveBeenNthCalledWith(2, 'row-2');
      expect(notice).toHaveBeenCalledWith({ message: 'Second row failed', tone: 'danger' });
      await waitFor(() => expect(screen.getByRole('region', { name: 'Posts' })).toHaveAttribute('aria-busy', 'true'));
      expect(screen.queryByText('2개 선택')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await act(async () => finish());
      expect(await within(screen.getByRole('table')).findByText('First row')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Posts' })).toHaveAttribute('aria-busy', 'false');
    } finally {
      notice.mockRestore();
    }
  });
  it('preserves selection and confirmation when every deletion fails', async () => {
    const notice = vi.spyOn(notifications, 'show');
    deleteAction
      .mockResolvedValueOnce({ error: 'First row failed' })
      .mockResolvedValueOnce({ error: 'Second row failed' });
    try {
      const { user } = setup();
      await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
      const dialog = await openDelete(user);
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(notice).toHaveBeenCalledWith({ message: 'First row failed', tone: 'danger' }));
      expect(router.refresh).not.toHaveBeenCalled();
      expect(screen.getByText('2개 선택')).toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Delete' })).toBeInTheDocument();
    } finally {
      notice.mockRestore();
    }
  });
  it('uses the selected row name for a single deletion', async () => {
    const { user } = setup();
    await user.click(within(screen.getByRole('table')).getByRole('checkbox', { name: 'First row' }));
    expect(await openDelete(user)).toHaveTextContent(
      'Are you sure you want to delete "First row"? This action cannot be undone.',
    );
    expect(screen.queryByText('1 posts')).not.toBeInTheDocument();
  });
});
