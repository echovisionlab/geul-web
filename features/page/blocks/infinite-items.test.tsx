// @vitest-environment jsdom
import { render, screen } from '@/test/render';
import { InfiniteItems } from './infinite-items';

type Item = { id: string };
const items = (from: number, count: number): Item[] =>
  Array.from({ length: count }, (_, index) => ({ id: `item-${from + index}` }));

function List({ total, loadPage }: { total: number; loadPage: (offset: number) => Promise<readonly Item[]> }) {
  return (
    <InfiniteItems initialItems={items(0, 2)} total={total} loadPage={loadPage}>
      {(shown) => (
        <ul>
          {shown.map((item) => (
            <li key={item.id}>{item.id}</li>
          ))}
        </ul>
      )}
    </InfiniteItems>
  );
}

describe('InfiniteItems', () => {
  it('appends the next page from the server offset and hides the action once everything is shown', async () => {
    const loadPage = vi.fn(async (offset: number) => items(offset, 2));
    const { user } = render(<List total={4} loadPage={loadPage} />);

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('item-3')).toBeInTheDocument();
    expect(loadPage).toHaveBeenCalledWith(2);
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('reports a failed page and retries it from the same offset', async () => {
    const loadPage = vi
      .fn<(offset: number) => Promise<readonly Item[]>>()
      .mockRejectedValueOnce(new Error('network'))
      .mockImplementation(async (offset) => items(offset, 2));
    const { user } = render(<List total={4} loadPage={loadPage} />);

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load more items.");

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('item-3')).toBeInTheDocument();
    expect(loadPage).toHaveBeenNthCalledWith(2, 2);
  });

  it('skips items already shown without re-requesting the same page', async () => {
    // The list shifted on the server: the second page starts with an item the first page already showed.
    const loadPage = vi
      .fn<(offset: number) => Promise<readonly Item[]>>()
      .mockResolvedValueOnce([{ id: 'item-1' }, { id: 'item-2' }])
      .mockResolvedValueOnce(items(3, 1));
    const { user } = render(<List total={5} loadPage={loadPage} />);

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('item-2')).toBeInTheDocument();
    expect(screen.getAllByText('item-1')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('item-3')).toBeInTheDocument();
    expect(loadPage).toHaveBeenNthCalledWith(2, 4);
  });

  it('stops asking when a page comes back empty', async () => {
    const loadPage = vi.fn(async () => [] as Item[]);
    const { user } = render(<List total={10} loadPage={loadPage} />);

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument());
    expect(loadPage).toHaveBeenCalledTimes(1);
  });
});
