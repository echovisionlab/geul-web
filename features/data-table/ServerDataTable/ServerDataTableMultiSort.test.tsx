// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@/test/render';
import { ServerDataTableMultiSort } from './ServerDataTableMultiSortRuntime';
import { ServerDataTableContent } from './ServerDataTableContent';
import { Button } from '@/components/core/Button';
const router = vi.hoisted(() => ({ push: vi.fn(), params: new URLSearchParams() }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/test',
  useSearchParams: () => router.params,
}));
const result = { data: [{ id: 'one', title: 'Notes' }], total: 1, page: 1, pageSize: 20, totalPages: 1 };
describe('ServerDataTableMultiSort', () => {
  it('keeps edits local and retains mounted row controls while Apply is pending', async () => {
    let finish!: () => void;
    router.push.mockReset().mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { user } = render(
      <div role="region" aria-label="Posts" data-datatable-root data-namespace="sort-test">
        <ServerDataTableMultiSort namespace="sort-test" fields={[{ field: 'title', label: 'Title' }]} />
        <ServerDataTableContent
          columns={[{ key: 'title', header: 'Title', cell: (row) => <Button>{row.title}</Button> }]}
          result={result}
          getRowKey={(row) => row.id}
        />
      </div>,
    );
    const rowControls = screen.getAllByRole('button', { name: 'Notes' });
    await user.click(screen.getByRole('button', { name: 'Sort' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Title' }));
    expect(router.push).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(decodeURIComponent(router.push.mock.calls[0][0])).toContain(
      '"sorts":[{"field":"title","direction":"desc"}]',
    );
    expect(screen.getByRole('button', { name: 'Apply' })).toHaveAttribute('aria-busy', 'true');
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Posts', hidden: true })).toHaveAttribute('aria-busy', 'true'),
    );
    expect(screen.getAllByRole('button', { name: 'Notes', hidden: true })).toEqual(rowControls);
    rowControls.forEach((control) => expect(control).toBeInTheDocument());
    await act(async () => finish());
    expect(await screen.findAllByRole('button', { name: 'Notes' })).toEqual(rowControls);
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Posts', hidden: true })).toHaveAttribute('aria-busy', 'false'),
    );
  });
});
