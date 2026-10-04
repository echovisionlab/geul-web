// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), search: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('@tanstack/react-query', () => ({ useQuery: mocks.query }));
vi.mock('@/lib/queries/post-browser', () => ({ searchPublishedPosts: mocks.search }));
vi.mock('@mantine/spotlight', () => ({
  SpotlightEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SpotlightActionsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SpotlightAction: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  ),
}));
import { PostSpotlightRuntime, type PostSpotlightRuntimeProps } from './PostSpotlightRuntime';
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockReturnValue({ data: [], isLoading: false, isError: false });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function render(props: PostSpotlightRuntimeProps) {
  await act(async () => root.render(<PostSpotlightRuntime {...props} />));
}

describe('PostSpotlight results runtime', () => {
  it('gates RPC by the shell debounce, minimum length, and opened state', async () => {
    await render({ query: '', debouncedQuery: '', opened: true });
    expect(mocks.query.mock.lastCall?.[0].enabled).toBe(false);
    await render({ query: 'ab', debouncedQuery: 'a', opened: true });
    expect(mocks.query.mock.lastCall?.[0].enabled).toBe(false);
    await render({ query: 'ab', debouncedQuery: 'ab', opened: true });
    expect(mocks.query.mock.lastCall?.[0].enabled).toBe(true);
    await mocks.query.mock.lastCall?.[0].queryFn();
    expect(mocks.search).toHaveBeenCalledWith('ab', 10);
    await render({ query: 'ab', debouncedQuery: 'ab', opened: false });
    expect(mocks.query.mock.lastCall?.[0].enabled).toBe(false);
  });

  it('retains locale hints, loading/errors, and post navigation', async () => {
    await render({ query: '', debouncedQuery: '', opened: true });
    expect(host.textContent).toBe('searchPosts');
    await render({ query: 'a', debouncedQuery: 'a', opened: true });
    expect(host.textContent).toBe('typeAtLeast2Characters');
    mocks.query.mockReturnValue({ data: [], isLoading: true, isError: false });
    await render({ query: 'ab', debouncedQuery: 'ab', opened: true });
    expect(host.textContent).toBe('loading');
    mocks.query.mockReturnValue({ data: [], isLoading: false, isError: true });
    await render({ query: 'ab', debouncedQuery: 'ab', opened: true });
    expect(host.textContent).toBe('failedToLoad');
    mocks.query.mockReturnValue({
      data: [{ id: 'post-id', slug: 'post-slug', title: 'Post', featuredImageUrl: '' }],
      isLoading: false,
      isError: false,
    });
    await render({ query: 'ab', debouncedQuery: 'ab', opened: true });
    await act(async () => host.querySelector('button')!.click());
    expect(mocks.push).toHaveBeenCalledWith('/posts/post-slug');
  });
});
