// @vitest-environment jsdom

import { act, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushEditorSaves, getPendingEditorPatch, hasPendingEditorSaves } from '@/lib/editor/editor-save-registry';
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
let setHarnessSlug: ((slug: string) => void) | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  checkPageSlugAvailable.mockReset().mockResolvedValue({ available: true });
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
  setHarnessSlug = null;
  vi.useRealTimers();
});

function TestHarness({
  initialSlug,
  entityType = 'page',
  initialEntityId = 'page-1',
  onSave,
  debounceMs,
  checkAvailability,
}: {
  initialSlug: string;
  entityType?: Parameters<typeof useSlugManagement>[0]['entityType'];
  initialEntityId?: string;
  onSave: (slug: string) => void | Promise<unknown>;
  debounceMs?: number;
  checkAvailability?: Parameters<typeof useSlugManagement>[0]['checkAvailability'];
}) {
  const [slug, setSlug] = useState(initialSlug);
  const entityId = initialEntityId;
  setHarnessSlug = setSlug;
  const slugMgmt = useSlugManagement({
    entityType,
    entityId,
    slug,
    onSlugChange: setSlug,
    onSave,
    debounceMs,
    checkAvailability,
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
  it('checks the settled slug after the default 1000ms delay and returns the result', async () => {
    vi.useFakeTimers();
    let resolveCheck: ((result: PageSlugAvailabilityResult) => void) | undefined;
    checkPageSlugAvailable.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCheck = resolve;
        }),
    );
    renderHarness(<TestHarness initialSlug="" onSave={vi.fn()} />);
    changeInput('new-slug');
    await act(async () => {
      vi.advanceTimersByTime(999);
    });
    expect(checkPageSlugAvailable).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(checkPageSlugAvailable).toHaveBeenCalledExactlyOnceWith('new-slug', 'page-1');
    await act(async () => {
      resolveCheck?.({ available: true });
    });
    await flushFakeTimerUpdates();
    expect(getHook().isAvailable).toBe(true);
  });

  it('stops title autofill after a collaborative slug change', () => {
    renderHarness(<TestHarness initialSlug="" onSave={vi.fn()} debounceMs={300} />);
    act(() => {
      getHook().updateFromTitle('First Title');
    });
    act(() => {
      setHarnessSlug?.('collaborator-slug');
    });
    act(() => {
      getHook().updateFromTitle('Second Title');
    });
    expect(latestRenderedSlug).toBe('collaborator-slug');
  });

  it('returns a failed check as the failure reason', async () => {
    vi.useFakeTimers();
    checkPageSlugAvailable.mockRejectedValue(new Error('backend unavailable'));
    const onSave = vi.fn();
    renderHarness(<TestHarness initialSlug="" onSave={onSave} debounceMs={300} />);
    changeInput('new-slug');
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flushFakeTimerUpdates();
    expect(getHook().errorReason).toBe('checkFailed');
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

  it('lets the shared document flush wait for an in-flight slug save', async () => {
    vi.useFakeTimers();
    let resolveSave: (() => void) | undefined;
    const blockedSave = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    const onSave = vi.fn(() => blockedSave);

    renderHarness(<TestHarness initialSlug="old-slug" onSave={onSave} debounceMs={250} />);
    await flushUpdates();
    changeInput('new-slug');

    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    await flushFakeTimerUpdates();
    expect(onSave).toHaveBeenCalledExactlyOnceWith('new-slug');

    let flushFinished = false;
    const flush = flushEditorSaves('page:page-1').then((result) => {
      flushFinished = true;
      return result;
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(onSave).toHaveBeenCalledExactlyOnceWith('new-slug');
    expect(flushFinished).toBe(false);

    await act(async () => {
      resolveSave?.();
      await Promise.resolve();
    });
    await expect(flush).resolves.toBe(true);
    expect(flushFinished).toBe(true);
  });

  it('registers Series slug saves under the post_series document key', async () => {
    vi.useFakeTimers();
    let resolveSave: (() => void) | undefined;
    const blockedSave = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    const onSave = vi.fn(() => blockedSave);

    renderHarness(
      <TestHarness
        entityType="series"
        initialEntityId="series-1"
        initialSlug="old-slug"
        onSave={onSave}
        debounceMs={250}
      />,
    );
    await flushUpdates();
    changeInput('new-slug');

    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    await flushFakeTimerUpdates();
    expect(onSave).toHaveBeenCalledExactlyOnceWith('new-slug');
    expect(hasPendingEditorSaves('post_series:series-1')).toBe(true);
    expect(hasPendingEditorSaves('series:series-1')).toBe(false);

    await act(async () => {
      resolveSave?.();
      await Promise.resolve();
    });
  });

  it('retains a rejected slug save for the next shared flush attempt', async () => {
    vi.useFakeTimers();
    let shouldSucceed = false;
    const onSave = vi.fn(async () => {
      if (!shouldSucceed) {
        throw new Error('temporary failure');
      }
    });

    renderHarness(<TestHarness initialSlug="old-slug" onSave={onSave} debounceMs={250} />);
    await flushUpdates();
    changeInput('new-slug');

    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    await flushFakeTimerUpdates();
    expect(onSave).toHaveBeenCalledExactlyOnceWith('new-slug');

    await expect(flushEditorSaves('page:page-1')).resolves.toBe(false);
    expect(getPendingEditorPatch('page:page-1')).toEqual({ slug: 'new-slug' });
    expect(onSave).toHaveBeenCalledTimes(2);

    shouldSucceed = true;
    await expect(flushEditorSaves('page:page-1')).resolves.toBe(true);
    expect(onSave).toHaveBeenCalledTimes(3);
    expect(onSave).toHaveBeenLastCalledWith('new-slug');
    expect(getPendingEditorPatch('page:page-1')).toEqual({});
  });
});
