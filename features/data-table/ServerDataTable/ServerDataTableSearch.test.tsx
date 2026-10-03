// @vitest-environment jsdom

import { act, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerDataTableSearch } from './ServerDataTableSearchRuntime';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  onChange: null as null | ((event: { currentTarget: { value: string } }) => void),
}));
let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => '/works',
  useSearchParams: () => searchParams,
}));
vi.mock('next-intl', () => ({ useTranslations: () => () => 'Search' }));
vi.mock('@mantine/core', () => ({
  Box: ({ children, ref }: { children: ReactNode; ref: ComponentProps<'div'>['ref'] }) => (
    <div ref={ref}>{children}</div>
  ),
}));
vi.mock('@/components/core/Input/TextInput', () => ({
  TextInput: ({ leftSection: _leftSection, ref, ...props }: ComponentProps<'input'> & { leftSection: ReactNode }) => {
    mocks.onChange = props.onChange as typeof mocks.onChange;
    return <input ref={ref} {...props} />;
  },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement | undefined;
afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  container?.remove();
  root = undefined;
  vi.useRealTimers();
  mocks.push.mockClear();
});

describe('ServerDataTable search runtime', () => {
  it('keeps the namespaced initial search, debounces edits, and preserves other query state', async () => {
    vi.useFakeTimers();
    searchParams = new URLSearchParams({
      works: JSON.stringify({ page: 3, search: 'initial', sorts: [{ field: 'title', direction: 'asc' }] }),
      posts: JSON.stringify({ search: 'other table' }),
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () =>
      root?.render(<ServerDataTableSearch namespace="works" placeholder="Find works" debounceMs={450} />),
    );
    expect(container.querySelector('input')?.value).toBe('initial');
    expect(container.querySelector('input')?.getAttribute('aria-label')).toBe('Find works');
    expect(mocks.push).not.toHaveBeenCalled();
    await act(async () => {
      mocks.onChange?.({ currentTarget: { value: 'edited' } });
    });
    await act(async () => {
      vi.advanceTimersByTime(449);
    });
    expect(mocks.push).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(mocks.push).toHaveBeenCalledTimes(1);
    const [url, options] = mocks.push.mock.calls[0];
    const parsed = new URL(url, 'https://example.test');
    expect(parsed.pathname).toBe('/works');
    expect(options).toEqual({ scroll: false });
    expect(JSON.parse(parsed.searchParams.get('works')!)).toEqual({
      search: 'edited',
      sorts: [{ field: 'title', direction: 'asc' }],
    });
    expect(parsed.searchParams.get('posts')).toBe(searchParams.get('posts'));
  });
});
