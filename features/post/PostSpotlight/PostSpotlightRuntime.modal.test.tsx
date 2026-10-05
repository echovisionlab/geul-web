// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const probes = vi.hoisted(() => ({ load: vi.fn(), query: vi.fn(), push: vi.fn(), search: vi.fn() }));
vi.mock('./post-spotlight-runtime-loader', () => ({ loadPostSpotlightRuntime: probes.load }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: probes.push }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@tanstack/react-query', () => ({ useQuery: probes.query }));
vi.mock('@/lib/queries/post-browser', () => ({ searchPublishedPosts: probes.search }));
import { PostSpotlight } from './PostSpotlight';
import { PostSpotlightRuntime } from './PostSpotlightRuntime';
import { consumePostSpotlightOpen, openPostSpotlight } from './post-spotlight-trigger';

let host: HTMLDivElement;
let trigger: HTMLButtonElement;
let root: Root;
const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, writable: true, value: vi.fn() });
  vi.useFakeTimers();
  vi.setSystemTime(0);
  consumePostSpotlightOpen();
  probes.load.mockResolvedValue(PostSpotlightRuntime);
  probes.query.mockImplementation((options: { enabled: boolean }) => ({
    data: options.enabled ? [{ id: 'post-id', slug: 'post-slug', title: 'Post', featuredImageUrl: '' }] : [],
    isLoading: false,
    isError: false,
  }));
  host = document.createElement('div');
  trigger = document.createElement('button');
  trigger.textContent = 'Search';
  document.body.append(trigger, host);
  trigger.focus();
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  trigger.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (scrollIntoViewDescriptor) {
    Object.defineProperty(Element.prototype, 'scrollIntoView', scrollIntoViewDescriptor);
  } else {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  }
});
async function mount() {
  await act(async () =>
    root.render(
      <MantineProvider env="test">
        <PostSpotlight />
      </MantineProvider>,
    ),
  );
}
function input() {
  return document.querySelector<HTMLInputElement>('input[placeholder="searchPosts"]')!;
}
async function tick(ms: number) {
  await act(async () => vi.advanceTimersByTimeAsync(ms));
}
async function type(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), value);
    input().dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function escape() {
  await act(async () => input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
}

it('shows the same real dialog/input at 0 ms of a controlled 500 ms import and retains typed query', async () => {
  probes.load.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(PostSpotlightRuntime), 500)));
  await mount();
  expect(probes.load).not.toHaveBeenCalled();
  expect(probes.query).not.toHaveBeenCalled();
  await act(async () => {
    openPostSpotlight();
    openPostSpotlight();
  });
  const originalInput = input();
  expect(Date.now()).toBe(0);
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  expect(originalInput).not.toBeNull();
  await type('ab');
  await tick(499);
  expect(originalInput.value).toBe('ab');
  expect(document.activeElement).toBe(originalInput);
  expect(probes.query).not.toHaveBeenCalled();
  await tick(1);
  expect(input()).toBe(originalInput);
  expect(input().value).toBe('ab');
  expect(probes.load).toHaveBeenCalledTimes(1);
  expect(probes.query.mock.lastCall?.[0]).toEqual(
    expect.objectContaining({ queryKey: ['post', 'searchPublished', 'ab'], enabled: true }),
  );
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
});

it('honors the full 300 ms debounce even when results code arrives 50 ms after typing', async () => {
  let resolve!: (runtime: typeof PostSpotlightRuntime) => void;
  probes.load.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await mount();
  await act(async () => openPostSpotlight());
  await type('ab');
  await tick(50);
  await act(async () => resolve(PostSpotlightRuntime));
  expect(probes.query.mock.lastCall?.[0].enabled).toBe(false);
  await tick(249);
  expect(probes.query.mock.lastCall?.[0].enabled).toBe(false);
  await tick(1);
  expect(probes.query.mock.lastCall?.[0].enabled).toBe(true);
  await escape();
  await tick(250);
  const calls = probes.query.mock.calls.length;
  await tick(500);
  expect(probes.query).toHaveBeenCalledTimes(calls);
});

it('cancels a pending open with Escape, returns original focus, and never reopens on late code completion', async () => {
  let resolve!: (runtime: typeof PostSpotlightRuntime) => void;
  probes.load.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await mount();
  await act(async () =>
    document.documentElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })),
  );
  expect(input()).not.toBeNull();
  await tick(50);
  expect(document.activeElement).toBe(input());
  await escape();
  await tick(250);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  await act(async () => resolve(PostSpotlightRuntime));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(probes.query).not.toHaveBeenCalled();
  await act(async () => openPostSpotlight());
  expect(input()).not.toBeNull();
  expect(probes.load).toHaveBeenCalledTimes(1);
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
});

it('keeps Mantine arrow/Enter result selection and returns focus after selecting a post', async () => {
  await mount();
  await act(async () => openPostSpotlight());
  await tick(50);
  await type('ab');
  await tick(300);
  expect(document.querySelector('[data-action]')?.textContent).toContain('Post');
  await act(async () =>
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true })),
  );
  expect(document.querySelector('[data-selected]')).not.toBeNull();
  await act(async () =>
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true })),
  );
  expect(probes.push).toHaveBeenCalledWith('/posts/post-slug');
  await tick(250);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
