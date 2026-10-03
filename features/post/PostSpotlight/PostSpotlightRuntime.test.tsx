// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  search: vi.fn(),
  push: vi.fn(),
  props: null as null | {
    shortcut: string | null;
    nothingFound: string;
    onQueryChange: (query: string) => void;
    store: { opened: boolean; listeners: Set<() => void> };
    actions: { onClick: () => void }[];
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('@tanstack/react-query', () => ({ useQuery: mocks.query }));
vi.mock('@/lib/queries/post-browser', () => ({ searchPublishedPosts: mocks.search }));
vi.mock('@mantine/spotlight', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    createSpotlight: () => {
      const store = { opened: false, listeners: new Set<() => void>() };
      const update = (opened: boolean) => {
        store.opened = opened;
        store.listeners.forEach((listener) => listener());
      };
      return [store, { open: () => update(true), close: () => update(false) }];
    },
    useSpotlight: (store: { opened: boolean; listeners: Set<() => void> }) => ({
      opened: React.useSyncExternalStore(
        (listener) => {
          store.listeners.add(listener);
          return () => {
            store.listeners.delete(listener);
          };
        },
        () => store.opened,
      ),
    }),
    Spotlight: Object.assign(
      (props: NonNullable<typeof mocks.props>) => {
        mocks.props = props;
        return null;
      },
      { Action: () => null },
    ),
  };
});
import { PostSpotlightRuntime } from './PostSpotlightRuntime';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mocks.query.mockReturnValue({ data: [], isLoading: false, isError: false });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});

function props() {
  if (!mocks.props) {
    throw new Error('Expected runtime Spotlight');
  }
  return mocks.props;
}

describe('PostSpotlight runtime', () => {
  it('opens the Mantine store and keeps its own shortcut disabled', async () => {
    await act(async () => root.render(<PostSpotlightRuntime openRequest={1} />));
    expect(props().store.opened).toBe(true);
    expect(props().shortcut).toBeNull();
    await act(async () => root.unmount());
    expect(props().store.opened).toBe(false);
    root = createRoot(host);
  });

  it('gates search by two characters, 300ms debounce, and opened state', async () => {
    await act(async () => root.render(<PostSpotlightRuntime openRequest={1} />));
    expect(mocks.query.mock.lastCall?.[0].enabled).toBe(false);
    await act(async () => props().onQueryChange('a'));
    await act(async () => vi.advanceTimersByTime(300));
    expect(mocks.query.mock.lastCall?.[0].enabled).toBe(false);
    await act(async () => props().onQueryChange('ab'));
    expect(mocks.query.mock.lastCall?.[0].enabled).toBe(false);
    await act(async () => vi.advanceTimersByTime(299));
    expect(mocks.query.mock.lastCall?.[0].enabled).toBe(false);
    await act(async () => vi.advanceTimersByTime(1));
    expect(mocks.query.mock.lastCall?.[0].enabled).toBe(true);
    await mocks.query.mock.lastCall?.[0].queryFn();
    expect(mocks.search).toHaveBeenCalledWith('ab', 10);
    await act(async () => {
      props().store.opened = false;
      props().store.listeners.forEach((listener) => listener());
    });
    expect(mocks.query.mock.lastCall?.[0].enabled).toBe(false);
    await act(async () => root.render(<PostSpotlightRuntime openRequest={2} />));
    expect(props().store.opened).toBe(true);
  });

  it('retains post navigation and presents RPC errors', async () => {
    mocks.query.mockReturnValue({
      data: [{ id: 'post-id', slug: 'post-slug', title: 'Post', featuredImageUrl: '' }],
      isLoading: false,
      isError: true,
    });
    await act(async () => root.render(<PostSpotlightRuntime openRequest={1} />));
    await act(async () => props().onQueryChange('ab'));
    await act(async () => vi.advanceTimersByTime(300));
    expect(props().nothingFound).toBe('failedToLoad');
    props().actions[0].onClick();
    expect(mocks.push).toHaveBeenCalledWith('/posts/post-slug');
  });
});
