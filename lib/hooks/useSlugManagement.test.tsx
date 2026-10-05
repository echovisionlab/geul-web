// @vitest-environment jsdom

import { act, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushEditorSaves, getPendingEditorPatch, hasPendingEditorSaves } from '@/lib/editor/editor-save-registry';
import { checkPostSlugAvailable } from '@/lib/queries/post-browser';
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
let harnessQueryClient: QueryClient;
let setHarnessEntityId: ((entityId: string) => void) | null = null;

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
  setHarnessEntityId = null;
  setHarnessSlug = null;
  vi.useRealTimers();
});

function TestHarness({
  initialSlug,
  entityType = 'page',
  initialEntityId = 'page-1',
  onSave,
  debounceMs,
}: {
  initialSlug: string;
  entityType?: Parameters<typeof useSlugManagement>[0]['entityType'];
  initialEntityId?: string;
  onSave: (slug: string) => void | Promise<unknown>;
  debounceMs?: number;
}) {
  const [slug, setSlug] = useState(initialSlug);
  const [entityId, setEntityId] = useState(initialEntityId);
  setHarnessEntityId = setEntityId;
  setHarnessSlug = setSlug;
  const slugMgmt = useSlugManagement({
    entityType,
    entityId,
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

  harnessQueryClient = queryClient;
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

function changeEntityId(entityId: string) {
  expect(setHarnessEntityId).not.toBeNull();
  act(() => {
    (setHarnessEntityId as (value: string) => void)(entityId);
  });
}

describe('useSlugManagement', () => {
  it.each([
    { debounceMs: 300, checks: 5, label: 'explicit 300ms' },
    { debounceMs: undefined, checks: 1, label: 'default 1000ms' },
  ])('measures five edits 400ms apart with $label', async ({ debounceMs, checks }) => {
    vi.useFakeTimers();
    renderHarness(<TestHarness initialSlug="" onSave={vi.fn()} debounceMs={debounceMs} />);
    for (const value of ['t', 'ti', 'tit', 'titl', 'title']) {
      changeInput(value);
      await act(async () => {
        vi.advanceTimersByTime(400);
      });
      await flushFakeTimerUpdates();
    }
    await act(async () => {
      vi.advanceTimersByTime(599);
    });
    if (debounceMs === undefined) {
      expect(checkPageSlugAvailable).not.toHaveBeenCalled();
    }
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    await flushFakeTimerUpdates();
    expect(checkPageSlugAvailable).toHaveBeenCalledTimes(checks);
    expect(checkPageSlugAvailable).toHaveBeenLastCalledWith('title', 'page-1');
  });

  it('shows the spinner throughout the default 1000ms delay and availability request', async () => {
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
    expect(getHook().isChecking).toBe(true);
    expect(getHook().isAvailable).toBeUndefined();
    await act(async () => {
      vi.advanceTimersByTime(999);
    });
    expect(checkPageSlugAvailable).not.toHaveBeenCalled();
    expect(getHook().isChecking).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(checkPageSlugAvailable).toHaveBeenCalledExactlyOnceWith('new-slug', 'page-1');
    expect(getHook().isChecking).toBe(true);
    expect(getHook().isAvailable).toBeUndefined();
    await act(async () => {
      resolveCheck?.({ available: true });
    });
    await flushFakeTimerUpdates();
    expect(getHook().isChecking).toBe(false);
    expect(getHook().isAvailable).toBe(true);
  });

  it('checks only the final value after five manual edits 50ms apart', async () => {
    vi.useFakeTimers();
    renderHarness(<TestHarness initialSlug="" onSave={vi.fn()} debounceMs={300} />);
    for (const value of ['t', 'ti', 'tit', 'titl', 'title']) {
      changeInput(value);
      await act(async () => {
        vi.advanceTimersByTime(50);
      });
    }
    await act(async () => {
      vi.advanceTimersByTime(249);
    });
    expect(checkPageSlugAvailable).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    await flushFakeTimerUpdates();
    expect(checkPageSlugAvailable).toHaveBeenCalledExactlyOnceWith('title', 'page-1');
  });

  it('checks only the final title slug after five automatic edits 50ms apart', async () => {
    vi.useFakeTimers();
    renderHarness(<TestHarness initialSlug="" onSave={vi.fn()} debounceMs={300} />);
    for (const title of ['T', 'Ti', 'Tit', 'Titl', 'Title']) {
      act(() => {
        getHook().updateFromTitle(title);
      });
      await act(async () => {
        vi.advanceTimersByTime(50);
      });
    }
    expect(latestRenderedSlug).toBe('title');
    expect(getHook().isChecking).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(249);
    });
    expect(checkPageSlugAvailable).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    await flushFakeTimerUpdates();
    expect(checkPageSlugAvailable).toHaveBeenCalledExactlyOnceWith('title', 'page-1');
  });

  it.each(['custom', ''])('stops title autofill after a manual edit to %j', (manualSlug) => {
    renderHarness(<TestHarness initialSlug="" onSave={vi.fn()} debounceMs={300} />);
    act(() => {
      getHook().updateFromTitle('First Title');
    });
    expect(latestRenderedSlug).toBe('first-title');
    changeInput(manualSlug);
    act(() => {
      getHook().updateFromTitle('Second Title');
    });
    expect(latestRenderedSlug).toBe(manualSlug);
  });

  it('preserves an existing slug when its title changes', () => {
    renderHarness(<TestHarness initialSlug="existing" onSave={vi.fn()} debounceMs={300} />);
    act(() => {
      getHook().updateFromTitle('Changed Title');
    });
    expect(latestRenderedSlug).toBe('existing');
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

  it('hides the previous server rejection while new input is debouncing', async () => {
    vi.useFakeTimers();
    checkPageSlugAvailable.mockResolvedValue({ available: false, reason: 'alreadyExists' });
    renderHarness(<TestHarness initialSlug="taken" onSave={vi.fn()} debounceMs={300} />);
    await flushFakeTimerUpdates();
    expect(getHook().errorReason).toBe('alreadyExists');
    changeInput('new-slug');
    expect(getHook().isAvailable).toBeUndefined();
    expect(getHook().errorReason).toBeUndefined();
    expect(getHook().isChecking).toBe(true);
    changeInput('admin');
    expect(getHook().errorReason).toBe('reservedRoute');
  });

  it('hides cached rejection while the current slug refetches', async () => {
    vi.useFakeTimers();
    renderHarness(<TestHarness initialSlug="" onSave={vi.fn()} debounceMs={300} />);
    harnessQueryClient.setQueryData(['slug-check', 'page', 'cached', 'page-1'], {
      available: false,
      reason: 'alreadyExists',
    });
    let resolveCheck: ((result: PageSlugAvailabilityResult) => void) | undefined;
    checkPageSlugAvailable.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCheck = resolve;
        }),
    );
    changeInput('cached');
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(getHook().isChecking).toBe(true);
    expect(getHook().isAvailable).toBeUndefined();
    expect(getHook().errorReason).toBeUndefined();
    await act(async () => {
      resolveCheck?.({ available: true });
    });
    await flushFakeTimerUpdates();
    expect(getHook().isAvailable).toBe(true);
  });

  it('resets autofill and never checks or saves the previous entity debounced slug', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    renderHarness(<TestHarness initialSlug="old" onSave={onSave} debounceMs={300} />);
    await flushFakeTimerUpdates();
    changeInput('manual');
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    checkPageSlugAvailable.mockClear();
    act(() => {
      setHarnessEntityId?.('page-2');
      setHarnessSlug?.('');
    });
    act(() => {
      getHook().updateFromTitle('New Title');
    });
    expect(latestRenderedSlug).toBe('new-title');
    expect(checkPageSlugAvailable).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(checkPageSlugAvailable).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    await flushFakeTimerUpdates();
    expect(checkPageSlugAvailable).toHaveBeenCalledExactlyOnceWith('new-title', 'page-2');
    expect(onSave).toHaveBeenCalledExactlyOnceWith('new-title');
  });

  it('keeps the trailing delay when input returns to the last checked slug', async () => {
    vi.useFakeTimers();
    renderHarness(<TestHarness initialSlug="first" onSave={vi.fn()} debounceMs={300} />);
    await flushFakeTimerUpdates();
    checkPageSlugAvailable.mockClear();
    changeInput('second');
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    changeInput('first');
    expect(getHook().isChecking).toBe(true);
    expect(getHook().isAvailable).toBeUndefined();
    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(checkPageSlugAvailable).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    await flushFakeTimerUpdates();
    expect(checkPageSlugAvailable).toHaveBeenCalledExactlyOnceWith('first', 'page-1');
  });

  it('hides a non-Page duplicate error as soon as the input changes', async () => {
    vi.useFakeTimers();
    vi.mocked(checkPostSlugAvailable).mockResolvedValue({ available: false });
    renderHarness(<TestHarness entityType="post" initialSlug="taken" onSave={vi.fn()} debounceMs={300} />);
    await flushFakeTimerUpdates();
    expect(getHook().error).toBe('Slug already exists');
    changeInput('new-slug');
    expect(getHook().error).toBeUndefined();
    expect(getHook().isAvailable).toBeUndefined();
    expect(getHook().isChecking).toBe(true);
  });

  it('ignores an old query result after switching entities', async () => {
    vi.useFakeTimers();
    let resolveOldCheck: ((result: PageSlugAvailabilityResult) => void) | undefined;
    checkPageSlugAvailable.mockImplementation((slug) =>
      slug === 'old-pending'
        ? new Promise((resolve) => {
            resolveOldCheck = resolve;
          })
        : Promise.resolve({ available: true }),
    );
    const onSave = vi.fn();
    renderHarness(<TestHarness initialSlug="" onSave={onSave} debounceMs={300} />);
    changeInput('old-pending');
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    act(() => {
      setHarnessEntityId?.('page-2');
      setHarnessSlug?.('');
    });
    act(() => {
      getHook().updateFromTitle('New Title');
    });
    await act(async () => {
      resolveOldCheck?.({ available: false, reason: 'alreadyExists' });
    });
    await flushFakeTimerUpdates();
    expect(getHook().errorReason).toBeUndefined();
    expect(getHook().isChecking).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flushFakeTimerUpdates();
    expect(onSave).toHaveBeenCalledExactlyOnceWith('new-title');
  });

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
    await flushFakeTimerUpdates();

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

    let flushFinished = false;
    const flush = flushEditorSaves('post_series:series-1').then((result) => {
      flushFinished = true;
      return result;
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(flushFinished).toBe(false);

    await act(async () => {
      resolveSave?.();
      await Promise.resolve();
    });
    await expect(flush).resolves.toBe(true);
    expect(flushFinished).toBe(true);
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

  it('ignores a blur availability result after the hook switches entities', async () => {
    let resolveAvailability: ((result: PageSlugAvailabilityResult) => void) | undefined;
    const pendingAvailability = new Promise<PageSlugAvailabilityResult>((resolve) => {
      resolveAvailability = resolve;
    });
    checkPageSlugAvailable.mockImplementation((slug) =>
      slug === 'new-slug' ? pendingAvailability : Promise.resolve({ available: true }),
    );
    const onSave = vi.fn();

    renderHarness(<TestHarness initialSlug="old-slug" onSave={onSave} debounceMs={1_000} />);
    await flushUpdates();
    changeInput('new-slug');
    blurInput();
    changeEntityId('page-2');

    await act(async () => {
      resolveAvailability?.({ available: true });
      await Promise.resolve();
    });
    await flushUpdates();

    expect(onSave).not.toHaveBeenCalled();
  });
});
