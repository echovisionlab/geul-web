// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import enMessages from '@/messages/en.json';
import { MyPostsPageView, type MyPostsPageViewProps } from './MyPostsPageView';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/my/posts',
  useSearchParams: () => new URLSearchParams(),
}));
const clients: QueryClient[] = [];
afterEach(() => clients.splice(0).forEach((client) => client.clear()));
it('retries a failed personal posts request and renders its paginated result', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const listAction = vi
    .fn<NonNullable<MyPostsPageViewProps['listAction']>>()
    .mockRejectedValueOnce(new Error('Offline fixture'))
    .mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
  const { user } = render(
    <QueryClientProvider client={client}>
      <MyPostsPageView listAction={listAction} />
    </QueryClientProvider>,
  );
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByRole('button', { name: /retry|try again/i })).toBeEnabled();
  expect(screen.queryByText(enMessages.posts.empty)).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /retry|try again/i }));
  expect(await screen.findByText(enMessages.posts.empty)).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
