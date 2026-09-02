// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOgImage } from './useOgImage';

type LifecycleCallback = (event: unknown) => void;

const mocks = vi.hoisted(() => ({
  getGeneration: vi.fn(),
  getLatest: vi.fn(),
  routerRefresh: vi.fn(),
  router: null as { refresh: () => void } | null,
  lifecycleCallback: null as LifecycleCallback | null,
  subscriptionOptions: null as Record<string, unknown> | null,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => mocks.router,
}));

vi.mock('@/lib/actions/og-generation', () => ({
  getOgGenerationAction: (...args: unknown[]) => mocks.getGeneration(...args),
  getLatestOgGenerationAction: (...args: unknown[]) => mocks.getLatest(...args),
}));

vi.mock('@/lib/hooks/useOgLifecycleSubscription', () => ({
  useOgLifecycleSubscription: (_provider: unknown, callback: LifecycleCallback, options: Record<string, unknown>) => {
    mocks.lifecycleCallback = callback;
    mocks.subscriptionOptions = options;
  },
}));

let host: HTMLDivElement | null = null;
let root: Root | null = null;
let latestState: ReturnType<typeof useOgImage> | null = null;

function generation(
  generationId: string,
  status: 'queued' | 'processing' | 'ready' | 'failed' | 'superseded' | 'cancelled',
  extra: Record<string, unknown> = {},
) {
  return {
    generationId,
    runId: `run-${generationId}`,
    status,
    ...extra,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function OgImageProbe({
  locale = 'ko',
  provider = null,
}: {
  locale?: string | null;
  provider?: Parameters<typeof useOgImage>[0]['provider'];
}) {
  const state = useOgImage({
    entityType: 'post',
    entityId: 'post-1',
    locale,
    initialOgImageUrl: 'https://cdn.example.test/old.webp',
    provider,
  });
  latestState = state;

  return (
    <div
      data-testid="probe"
      data-generation-id={state.generationId ?? ''}
      data-status={state.status ?? ''}
      data-src={state.src ?? ''}
      data-error={state.error ?? ''}
      data-regenerating={state.isRegenerating ? 'true' : 'false'}
    >
      <button type="button" data-testid="track" onClick={() => state.trackGeneration('generation-a')}>
        Track
      </button>
      <button type="button" data-testid="track-b" onClick={() => state.trackGeneration('generation-b')}>
        Track B
      </button>
      <button type="button" data-testid="latest" onClick={() => void state.trackLatest()}>
        Latest
      </button>
    </div>
  );
}

function probe(): HTMLDivElement {
  const node = host?.querySelector<HTMLDivElement>('[data-testid="probe"]');
  if (!node) {
    throw new Error('OG image probe was not rendered');
  }
  return node;
}

async function flushWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderProbe(
  locale: string | null = 'ko',
  provider: Parameters<typeof useOgImage>[0]['provider'] = null,
) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root?.render(<OgImageProbe locale={locale} provider={provider} />);
  });
  await flushWork();
}

async function click(testId: 'track' | 'track-b' | 'latest') {
  const button = host?.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
  if (!button) {
    throw new Error(`${testId} button was not rendered`);
  }
  act(() => button.click());
  await flushWork();
}

async function advance(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
  await flushWork();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-16T00:00:00.000Z'));
  vi.clearAllMocks();
  mocks.router = { refresh: mocks.routerRefresh };
  mocks.lifecycleCallback = null;
  mocks.subscriptionOptions = null;
  mocks.getLatest.mockResolvedValue({});
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  latestState = null;
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('useOgImage', () => {
  it('recovers by polling queued to processing to ready without a lifecycle event', async () => {
    mocks.getGeneration
      .mockResolvedValueOnce({ generation: generation('generation-a', 'queued') })
      .mockResolvedValueOnce({ generation: generation('generation-a', 'processing') })
      .mockResolvedValueOnce({
        generation: generation('generation-a', 'ready', {
          assetId: 'asset-a',
          assetUrl: 'https://cdn.example.test/asset-a.webp',
        }),
      });

    await renderProbe();
    await click('track');

    expect(probe().dataset.status).toBe('queued');
    expect(probe().dataset.regenerating).toBe('true');
    expect(mocks.getGeneration).toHaveBeenCalledTimes(1);

    await advance(1_000);
    expect(probe().dataset.status).toBe('processing');
    expect(mocks.getGeneration).toHaveBeenCalledTimes(2);

    await advance(1_000);
    expect(probe().dataset.status).toBe('ready');
    expect(probe().dataset.src).toBe('https://cdn.example.test/asset-a.webp');
    expect(probe().dataset.regenerating).toBe('false');
    expect(mocks.routerRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.getLatest).toHaveBeenCalledTimes(1);
  });

  it('waits for a concrete locale target before bootstrapping or accepting events', async () => {
    await renderProbe(null);

    expect(mocks.getLatest).not.toHaveBeenCalled();
    expect(mocks.subscriptionOptions).toEqual({
      enabled: false,
      entityType: 'post',
      entityId: 'post-1',
      locale: null,
    });
    act(() => {
      mocks.lifecycleCallback?.({ kind: 'og.lifecycle', generationId: 'premature' });
    });
    await flushWork();
    expect(mocks.getLatest).not.toHaveBeenCalled();

    act(() => root?.render(<OgImageProbe locale="ko" />));
    await flushWork();

    expect(mocks.getLatest).toHaveBeenCalledTimes(1);
    expect(mocks.getLatest).toHaveBeenCalledWith({
      entityType: 'post',
      entityId: 'post-1',
      locale: 'ko',
    });
  });

  it('clears a stale latest-lookup error after a successful empty lookup', async () => {
    mocks.getLatest.mockResolvedValueOnce({ error: 'Temporary lookup failure' }).mockResolvedValueOnce({});

    await renderProbe();
    expect(probe().dataset.error).toBe('Failed to load latest OG generation');

    await click('latest');
    expect(probe().dataset.error).toBe('');
  });

  it('retries a rejected initial lookup when the browser comes back online', async () => {
    mocks.getLatest
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ generation: generation('generation-recovered', 'queued') });
    mocks.getGeneration.mockResolvedValue({
      generation: generation('generation-recovered', 'processing'),
    });

    await renderProbe();
    expect(probe().dataset.error).toBe('Failed to load latest OG generation');

    await advance(30_000);

    expect(mocks.getLatest).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await flushWork();

    expect(mocks.getLatest).toHaveBeenCalledTimes(2);
    expect(mocks.getGeneration).toHaveBeenCalledWith('generation-recovered');
    expect(probe().dataset.generationId).toBe('generation-recovered');
    expect(probe().dataset.status).toBe('processing');
    expect(probe().dataset.error).toBe('');
  });

  it('follows the replacement generation when the tracked request is superseded', async () => {
    mocks.getGeneration.mockImplementation(async (generationId: string) => {
      if (generationId === 'generation-a') {
        return {
          generation: generation('generation-a', 'superseded', {
            replacementGenerationId: 'generation-b',
          }),
        };
      }
      return {
        generation: generation('generation-b', 'ready', {
          assetUrl: 'https://cdn.example.test/asset-b.webp',
        }),
      };
    });

    await renderProbe();
    await click('track');
    await flushWork();

    expect(mocks.getGeneration.mock.calls.map(([id]) => id)).toEqual(['generation-a', 'generation-b']);
    expect(probe().dataset.generationId).toBe('generation-b');
    expect(probe().dataset.status).toBe('ready');
    expect(probe().dataset.src).toBe('https://cdn.example.test/asset-b.webp');
  });

  it('shows a replacement as queued while its first lookup transiently fails', async () => {
    let replacementAttempts = 0;
    mocks.getGeneration.mockImplementation(async (generationId: string) => {
      if (generationId === 'generation-a') {
        return {
          generation: generation('generation-a', 'superseded', {
            replacementGenerationId: 'generation-b',
          }),
        };
      }
      replacementAttempts += 1;
      if (replacementAttempts === 1) {
        throw new Error('replacement lookup failed');
      }
      return { generation: generation('generation-b', 'processing') };
    });

    await renderProbe();
    await click('track');
    await flushWork();

    expect(probe().dataset.generationId).toBe('generation-b');
    expect(probe().dataset.status).toBe('queued');
    expect(probe().dataset.regenerating).toBe('true');
    expect(probe().dataset.error).toBe('Failed to load OG generation');

    await advance(1_000);
    expect(probe().dataset.status).toBe('processing');
    expect(probe().dataset.error).toBe('');
  });

  it('uses lifecycle events only as a wake-up to query the latest target generation', async () => {
    mocks.getLatest.mockResolvedValue({
      generation: generation('generation-latest', 'processing'),
    });
    mocks.getGeneration.mockResolvedValue({
      generation: generation('generation-latest', 'ready', {
        assetUrl: 'https://cdn.example.test/latest.webp',
      }),
    });

    await renderProbe();
    expect(mocks.subscriptionOptions).toEqual({
      enabled: true,
      entityType: 'post',
      entityId: 'post-1',
      locale: 'ko',
    });

    act(() => {
      mocks.lifecycleCallback?.({ kind: 'og.lifecycle', generationId: 'stale-event' });
    });
    await flushWork();
    await flushWork();

    expect(mocks.getLatest).toHaveBeenCalledWith({
      entityType: 'post',
      entityId: 'post-1',
      locale: 'ko',
    });
    expect(mocks.getGeneration).toHaveBeenCalledWith('generation-latest');
    expect(probe().dataset.generationId).toBe('generation-latest');
    expect(probe().dataset.src).toBe('https://cdn.example.test/latest.webp');
  });

  it('omits the previous image for a newly pending target and applies the lifecycle-completed exact asset', async () => {
    mocks.getLatest.mockResolvedValueOnce({}).mockResolvedValueOnce({
      generation: generation('generation-target', 'queued'),
    });
    mocks.getGeneration
      .mockResolvedValueOnce({ generation: generation('generation-target', 'processing') })
      .mockResolvedValueOnce({
        generation: generation('generation-target', 'ready', {
          assetUrl: 'https://cdn.example.test/exact-target.webp',
        }),
      });

    await renderProbe();
    expect(probe().dataset.src).toBe('https://cdn.example.test/old.webp');

    act(() => {
      mocks.lifecycleCallback?.({ kind: 'og.lifecycle', generationId: 'generation-target' });
    });
    await flushWork();

    expect(probe().dataset.status).toBe('processing');
    expect(probe().dataset.src).toBe('');

    await advance(1_000);

    expect(probe().dataset.status).toBe('ready');
    expect(probe().dataset.src).toBe('https://cdn.example.test/exact-target.webp');
    expect(mocks.routerRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not let an older latest-target lookup replace a manually returned generation ID', async () => {
    const staleLookup = deferred<{ generation: ReturnType<typeof generation> }>();
    mocks.getLatest.mockReturnValue(staleLookup.promise);
    mocks.getGeneration.mockResolvedValue({
      generation: generation('generation-a', 'processing'),
    });

    await renderProbe();
    act(() => {
      mocks.lifecycleCallback?.({ kind: 'og.lifecycle', generationId: 'older-generation' });
    });
    await flushWork();
    await click('track');

    await act(async () => {
      staleLookup.resolve({ generation: generation('older-generation', 'ready') });
      await staleLookup.promise;
    });
    await flushWork();

    expect(probe().dataset.generationId).toBe('generation-a');
    expect(probe().dataset.status).toBe('processing');
    expect(mocks.getGeneration).toHaveBeenCalledWith('generation-a');
  });

  it('ignores an in-flight latest lookup after the viewed locale changes', async () => {
    const oldLocaleLookup = deferred<{ generation: ReturnType<typeof generation> }>();
    mocks.getLatest.mockReturnValueOnce(oldLocaleLookup.promise).mockResolvedValue({});

    await renderProbe('ko');

    act(() => root?.render(<OgImageProbe locale="ja" />));
    await flushWork();
    await act(async () => {
      oldLocaleLookup.resolve({
        generation: generation('generation-ko', 'ready', {
          assetUrl: 'https://cdn.example.test/ko.webp',
        }),
      });
      await oldLocaleLookup.promise;
    });
    await flushWork();

    expect(probe().dataset.generationId).toBe('');
    expect(probe().dataset.src).toBe('https://cdn.example.test/old.webp');
    expect(mocks.getGeneration).not.toHaveBeenCalled();
    expect(mocks.routerRefresh).not.toHaveBeenCalled();
  });

  it('resets a ready asset URL when switching to a target with the same initial URL', async () => {
    mocks.getGeneration.mockResolvedValue({
      generation: generation('generation-ko', 'ready', {
        assetUrl: 'https://cdn.example.test/generated-ko.webp',
      }),
    });

    await renderProbe('ko');
    await click('track');
    expect(probe().dataset.src).toBe('https://cdn.example.test/generated-ko.webp');

    act(() => root?.render(<OgImageProbe locale="ja" />));
    await flushWork();

    expect(probe().dataset.generationId).toBe('');
    expect(probe().dataset.src).toBe('https://cdn.example.test/old.webp');
  });

  it.each(['queued', 'processing', 'failed'] as const)(
    'recovers an existing %s generation when the panel mounts after its lifecycle event',
    async (status) => {
      const latest = generation('generation-existing', status, {
        ...(status === 'failed' ? { error: 'Existing server failure' } : {}),
      });
      mocks.getLatest.mockResolvedValue({ generation: latest });
      mocks.getGeneration.mockResolvedValue({ generation: latest });

      await renderProbe();
      await flushWork();

      expect(mocks.getLatest).toHaveBeenCalledWith({
        entityType: 'post',
        entityId: 'post-1',
        locale: 'ko',
      });
      expect(mocks.getGeneration).toHaveBeenCalledWith('generation-existing');
      expect(probe().dataset.generationId).toBe('generation-existing');
      expect(probe().dataset.status).toBe(status);
      if (status === 'failed') {
        expect(probe().dataset.error).toBe('OG generation failed');
      }
    },
  );

  it('discovers an automatic run created after mount when the browser becomes active again', async () => {
    mocks.getLatest
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ generation: generation('generation-after-mount', 'queued') });
    mocks.getGeneration.mockResolvedValue({
      generation: generation('generation-after-mount', 'processing'),
    });

    await renderProbe();
    expect(probe().dataset.generationId).toBe('');

    await advance(30_000);
    expect(mocks.getLatest).toHaveBeenCalledTimes(1);
    expect(probe().dataset.generationId).toBe('');

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await flushWork();

    expect(mocks.getLatest).toHaveBeenCalledTimes(2);
    expect(mocks.getGeneration).toHaveBeenCalledWith('generation-after-mount');
    expect(probe().dataset.generationId).toBe('generation-after-mount');
    expect(probe().dataset.status).toBe('processing');
  });

  it('uses lifecycle as the fast path and rechecks after provider reconnect', async () => {
    const statusListeners = new Set<(event: { status: string }) => void>();
    const provider = {
      on: vi.fn((_event: string, listener: (event: { status: string }) => void) => {
        statusListeners.add(listener);
      }),
      off: vi.fn((_event: string, listener: (event: { status: string }) => void) => {
        statusListeners.delete(listener);
      }),
    } as never;

    await renderProbe('ko', provider);
    expect(mocks.getLatest).toHaveBeenCalledTimes(1);

    await advance(30_000);
    expect(mocks.getLatest).toHaveBeenCalledTimes(1);

    act(() => {
      for (const listener of statusListeners) {
        listener({ status: 'connected' });
      }
    });
    await flushWork();

    expect(mocks.getLatest).toHaveBeenCalledTimes(2);
  });

  it('ignores an in-flight generation poll after tracking switches to a newer ID', async () => {
    const stalePoll = deferred<{ generation: ReturnType<typeof generation> }>();
    mocks.getGeneration.mockImplementation((generationId: string) => {
      if (generationId === 'generation-a') {
        return stalePoll.promise;
      }
      return Promise.resolve({ generation: generation('generation-b', 'processing') });
    });

    await renderProbe();
    await click('track');
    await click('track-b');

    await act(async () => {
      stalePoll.resolve({
        generation: generation('generation-a', 'ready', {
          assetUrl: 'https://cdn.example.test/stale.webp',
        }),
      });
      await stalePoll.promise;
    });
    await flushWork();

    expect(probe().dataset.generationId).toBe('generation-b');
    expect(probe().dataset.status).toBe('processing');
    expect(probe().dataset.src).toBe('');
    expect(mocks.routerRefresh).not.toHaveBeenCalled();
  });

  it('ignores a manual generation response after the viewed locale changes', async () => {
    await renderProbe('ko');
    const requestedTargetKey = latestState?.targetKey;
    const oldTrackGeneration = latestState?.trackGeneration;
    const oldTrackLatest = latestState?.trackLatest;
    if (!requestedTargetKey || !oldTrackGeneration || !oldTrackLatest) {
      throw new Error('initial OG target state was not created');
    }

    act(() => root?.render(<OgImageProbe locale="ja" />));
    await flushWork();

    let accepted = true;
    act(() => {
      accepted = latestState?.trackRequestedGeneration('generation-for-ko', requestedTargetKey) ?? true;
    });
    await flushWork();

    expect(accepted).toBe(false);
    expect(probe().dataset.generationId).toBe('');
    expect(mocks.getGeneration).not.toHaveBeenCalled();

    await act(async () => {
      expect(oldTrackGeneration('generation-for-ko')).toBe(false);
      await expect(oldTrackLatest()).resolves.toBe(false);
    });
    expect(mocks.getLatest).toHaveBeenCalledWith({
      entityType: 'post',
      entityId: 'post-1',
      locale: 'ja',
    });
  });

  it('polls every second for 30 seconds and every three seconds afterward', async () => {
    mocks.getGeneration.mockResolvedValue({
      generation: generation('generation-a', 'queued'),
    });

    await renderProbe();
    await click('track');
    expect(mocks.getGeneration).toHaveBeenCalledTimes(1);

    await advance(999);
    expect(mocks.getGeneration).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(mocks.getGeneration).toHaveBeenCalledTimes(2);

    vi.setSystemTime(new Date('2026-07-16T00:00:31.000Z'));
    await advance(1_000);
    expect(mocks.getGeneration).toHaveBeenCalledTimes(3);

    await advance(2_999);
    expect(mocks.getGeneration).toHaveBeenCalledTimes(3);
    await advance(1);
    expect(mocks.getGeneration).toHaveBeenCalledTimes(4);
  });

  it('keeps generation polling alive after a rejected browser request', async () => {
    mocks.getGeneration
      .mockRejectedValueOnce(new Error('transport disconnected'))
      .mockResolvedValueOnce({ generation: generation('generation-a', 'processing') });

    await renderProbe();
    await click('track');

    expect(probe().dataset.status).toBe('queued');
    expect(probe().dataset.regenerating).toBe('true');
    expect(probe().dataset.error).toBe('Failed to load OG generation');

    await advance(1_000);
    expect(probe().dataset.status).toBe('processing');
    expect(probe().dataset.error).toBe('');
  });

  it.each([
    ['failed', 'Renderer rejected this target', 'render_failed', 'OG generation failed (render_failed)'],
    ['cancelled', 'Generation cancelled after deletion', undefined, 'OG generation was cancelled'],
  ] as const)(
    'surfaces a bounded terminal %s reason without provider error text',
    async (status, error, errorCode, expected) => {
      mocks.getGeneration.mockResolvedValue({
        generation: generation('generation-a', status, { error, errorCode }),
      });

      await renderProbe();
      await click('track');

      expect(probe().dataset.status).toBe(status);
      expect(probe().dataset.error).toBe(expected);
      expect(probe().dataset.error).not.toContain(error);
      expect(probe().dataset.regenerating).toBe('false');
      // Terminal generation polling stops, and idle latest discovery has no
      // repeating timer. A lifecycle/browser/provider wake-up can still find a
      // later retry or replacement run.
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});
