// @vitest-environment jsdom

import { act, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageSlugAvailabilityResult } from '@/lib/queries/page-browser';
import { useSlugManagement } from './useSlugManagement';

const checkPageSlugAvailable = vi.fn<(slug: string, excludePageId?: string) => Promise<PageSlugAvailabilityResult>>(
  async () => ({ available: true }),
);

vi.mock('@/lib/queries/artist-browser', () => ({
  checkArtistSlugAvailable: vi.fn(async () => ({ available: true })),
}));

vi.mock('@/lib/queries/form-browser', () => ({
  checkFormSlugAvailable: vi.fn(async () => ({ available: true })),
}));

vi.mock('@/lib/queries/label-browser', () => ({
  checkLabelSlugAvailable: vi.fn(async () => ({ available: true })),
}));

vi.mock('@/lib/queries/page-browser', () => ({
  checkPageSlugAvailable: (...args: Parameters<typeof checkPageSlugAvailable>) => checkPageSlugAvailable(...args),
}));

vi.mock('@/lib/queries/post-browser', () => ({
  checkPostSlugAvailable: vi.fn(async () => ({ available: true })),
}));

vi.mock('@/lib/queries/release-browser', () => ({
  checkReleaseSlugAvailable: vi.fn(async () => ({ available: true })),
}));

vi.mock('@/lib/queries/series-browser', () => ({
  checkSeriesSlugAvailable: vi.fn(async () => ({ available: true })),
}));

vi.mock('@/lib/queries/work-browser', () => ({
  checkWorkSlugAvailable: vi.fn(async () => ({ available: true })),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let latestHook: ReturnType<typeof useSlugManagement> | null = null;
let latestRenderedSlug = '';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
  latestHook = null;
  latestRenderedSlug = '';
  vi.useRealTimers();
});

function TestHarness({
  initialSlug,
  onSave,
  debounceMs,
}: {
  initialSlug: string;
  onSave: (slug: string) => void | Promise<unknown>;
  debounceMs: number;
}) {
  const [slug, setSlug] = useState(initialSlug);
  const slugMgmt = useSlugManagement({
    entityType: 'page',
    entityId: 'page-1',
    slug,
    onSlugChange: setSlug,
    onSave,
    debounceMs,
  });

  latestHook = slugMgmt;
  latestRenderedSlug = slug;

  return null;
}

function renderHarness(node: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
  });
}

async function flushUpdates() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function flushFakeTimerUpdates() {
  await act(async () => {
    for (let index = 0; index < 3; index += 1) {
      await Promise.resolve();
      vi.advanceTimersByTime(0);
    }
  });
}

function getHook() {
  expect(latestHook).not.toBeNull();
  return latestHook as ReturnType<typeof useSlugManagement>;
}

function changeInput(value: string) {
  act(() => {
    getHook().handleChange(value);
  });
}

function blurInput() {
  act(() => {
    getHook().handleBlur();
  });
}

describe('useSlugManagement', () => {
  it('does not save a checked prefix after the user has continued typing', async () => {
    vi.useFakeTimers();
    let resolvePrefixCheck: ((result: PageSlugAvailabilityResult) => void) | undefined;
    const prefixCheck = new Promise<PageSlugAvailabilityResult>((resolve) => {
      resolvePrefixCheck = resolve;
    });
    checkPageSlugAvailable.mockImplementation((slug) =>
      slug === 'dyn' ? prefixCheck : Promise.resolve({ available: true }),
    );
    const onSave = vi.fn();

    renderHarness(<TestHarness initialSlug="" onSave={onSave} debounceMs={250} />);
    changeInput('dyn');

    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    await flushFakeTimerUpdates();
    expect(checkPageSlugAvailable).toHaveBeenCalledWith('dyn', 'page-1');

    changeInput('dynamic-gpgpu-particles-tutorial');
    await act(async () => {
      resolvePrefixCheck?.({ available: true });
      await Promise.resolve();
    });
    await flushFakeTimerUpdates();

    expect(onSave).not.toHaveBeenCalled();
    expect(latestRenderedSlug).toBe('dynamic-gpgpu-particles-tutorial');

    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    await flushFakeTimerUpdates();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('dynamic-gpgpu-particles-tutorial');
  });

  it('serializes saves and keeps only the newest value typed while a save is in flight', async () => {
    vi.useFakeTimers();
    let resolvePrefixSave: (() => void) | undefined;
    const prefixSave = new Promise<void>((resolve) => {
      resolvePrefixSave = resolve;
    });
    const onSave = vi.fn((slug: string) => (slug === 'dyn' ? prefixSave : Promise.resolve()));

    renderHarness(<TestHarness initialSlug="" onSave={onSave} debounceMs={250} />);
    changeInput('dyn');
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    await flushFakeTimerUpdates();
    expect(onSave).toHaveBeenCalledWith('dyn');

    changeInput('dynamic-gpgpu');
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    await flushFakeTimerUpdates();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(latestRenderedSlug).toBe('dynamic-gpgpu');

    await act(async () => {
      resolvePrefixSave?.();
      await Promise.resolve();
    });
    await flushFakeTimerUpdates();

    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith('dynamic-gpgpu');
    expect(latestRenderedSlug).toBe('dynamic-gpgpu');
  });

  it('saves an empty slug immediately on blur without checking availability', async () => {
    const onSave = vi.fn();

    renderHarness(<TestHarness initialSlug="existing-slug" onSave={onSave} debounceMs={1_000} />);
    await flushUpdates();
    checkPageSlugAvailable.mockClear();

    changeInput('');
    await flushUpdates();
    blurInput();
    await flushUpdates();

    expect(onSave).toHaveBeenCalledWith('');
    expect(checkPageSlugAvailable).not.toHaveBeenCalled();
  });

  it('treats an empty slug as saveable when the debounced value settles', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    renderHarness(<TestHarness initialSlug="existing-slug" onSave={onSave} debounceMs={250} />);
    await flushUpdates();
    checkPageSlugAvailable.mockClear();

    changeInput('');
    await flushUpdates();

    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledWith('');
    expect(checkPageSlugAvailable).not.toHaveBeenCalled();
  });

  it('normalizes each Page segment without replacing an interior slash', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    renderHarness(<TestHarness initialSlug="existing-slug" onSave={onSave} debounceMs={250} />);
    await flushUpdates();
    checkPageSlugAvailable.mockClear();

    changeInput('Nested Path/Team Page');
    await flushUpdates();

    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(checkPageSlugAvailable).toHaveBeenCalledWith('nested-path/team-page', 'page-1');
  });

  it('exposes the Page rejection reason without saving the slug', async () => {
    const onSave = vi.fn();
    checkPageSlugAvailable.mockResolvedValue({ available: false, reason: 'reservedRoute' });

    renderHarness(<TestHarness initialSlug="" onSave={onSave} debounceMs={1} />);
    changeInput('admin/team');
    await flushUpdates();

    expect(getHook().errorReason).toBe('reservedRoute');
    expect(getHook().error).toBeUndefined();
    expect(onSave).not.toHaveBeenCalled();
  });
});
