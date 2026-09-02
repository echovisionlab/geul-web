// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOgGenerationRun } from './useOgGenerationRun';

const mocks = vi.hoisted(() => ({
  getRun: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

vi.mock('@/lib/actions/og-generation', () => ({
  getOgGenerationRunAction: (...args: unknown[]) => mocks.getRun(...args),
}));

let host: HTMLDivElement | null = null;
let root: Root | null = null;
let oldRequestSequence = 0;
let newRequestSequence = 0;

function run(
  status: 'queued' | 'processing' | 'ready' | 'partially_failed' | 'failed' | 'cancelled',
  counts: Partial<{
    generationCount: number;
    queuedCount: number;
    processingCount: number;
    readyCount: number;
    failedCount: number;
    supersededCount: number;
    cancelledCount: number;
  }> = {},
) {
  return {
    runId: 'run-global',
    status,
    generationCount: 12,
    queuedCount: 0,
    processingCount: 0,
    readyCount: 0,
    failedCount: 0,
    supersededCount: 0,
    cancelledCount: 0,
    failures: [],
    ...counts,
  };
}

function RunProbe() {
  const state = useOgGenerationRun();
  return (
    <div
      data-testid="probe"
      data-run-id={state.runId ?? ''}
      data-status={state.run?.status ?? ''}
      data-total={state.run?.generationCount ?? ''}
      data-queued={state.run?.queuedCount ?? ''}
      data-processing={state.run?.processingCount ?? ''}
      data-ready={state.run?.readyCount ?? ''}
      data-failed={state.run?.failedCount ?? ''}
      data-superseded={state.run?.supersededCount ?? ''}
      data-cancelled={state.run?.cancelledCount ?? ''}
      data-active={state.isActive ? 'true' : 'false'}
      data-error={state.error ?? ''}
    >
      <button type="button" onClick={() => state.trackRun(' run-global ')}>
        Track run
      </button>
      <button data-testid="track-new" type="button" onClick={() => state.trackRun('run-new')}>
        Track new run
      </button>
      <button
        data-testid="begin-old"
        type="button"
        onClick={() => {
          oldRequestSequence = state.beginRunRequest();
        }}
      >
        Begin old request
      </button>
      <button
        data-testid="begin-new"
        type="button"
        onClick={() => {
          newRequestSequence = state.beginRunRequest();
        }}
      >
        Begin new request
      </button>
      <button
        data-testid="settle-old"
        type="button"
        onClick={() => state.trackRequestedRun(oldRequestSequence, 'run-old')}
      >
        Settle old request
      </button>
      <button
        data-testid="settle-new"
        type="button"
        onClick={() => state.trackRequestedRun(newRequestSequence, 'run-new')}
      >
        Settle new request
      </button>
      <button
        data-testid="settle-new-empty"
        type="button"
        onClick={() => state.trackRequestedRun(newRequestSequence, undefined)}
      >
        Settle new request without a run
      </button>
    </div>
  );
}

function probe(): HTMLDivElement {
  const node = host?.querySelector<HTMLDivElement>('[data-testid="probe"]');
  if (!node) {
    throw new Error('OG generation run probe was not rendered');
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

async function renderAndTrack() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root?.render(<RunProbe />);
  });
  await flushWork();
  const button = host.querySelector<HTMLButtonElement>('button:not([data-testid])');
  if (!button) {
    throw new Error('Track run button was not rendered');
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
  oldRequestSequence = 0;
  newRequestSequence = 0;
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('useOgGenerationRun', () => {
  it('polls a global run through queued, processing, and ready with exact counts', async () => {
    mocks.getRun
      .mockResolvedValueOnce({ run: run('queued', { queuedCount: 12 }) })
      .mockResolvedValueOnce({
        run: run('processing', {
          queuedCount: 3,
          processingCount: 4,
          readyCount: 3,
          failedCount: 1,
          supersededCount: 1,
        }),
      })
      .mockResolvedValueOnce({
        run: run('ready', {
          readyCount: 12,
        }),
      });

    await renderAndTrack();
    expect(mocks.getRun).toHaveBeenCalledWith('run-global');
    expect(probe().dataset.status).toBe('queued');
    expect(probe().dataset.queued).toBe('12');
    expect(probe().dataset.active).toBe('true');

    await advance(1_000);
    expect(probe().dataset.status).toBe('processing');
    expect(probe().dataset.total).toBe('12');
    expect(probe().dataset.queued).toBe('3');
    expect(probe().dataset.processing).toBe('4');
    expect(probe().dataset.ready).toBe('3');
    expect(probe().dataset.failed).toBe('1');
    expect(probe().dataset.superseded).toBe('1');
    expect(probe().dataset.active).toBe('true');

    await advance(1_000);
    expect(probe().dataset.status).toBe('ready');
    expect(probe().dataset.ready).toBe('12');
    expect(probe().dataset.active).toBe('false');
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ['partially_failed', 10, 2],
    ['failed', 0, 12],
    ['cancelled', 3, 0],
  ] as const)('stops polling a terminal %s run', async (status, readyCount, failedCount) => {
    mocks.getRun.mockResolvedValue({
      run: run(status, {
        readyCount,
        failedCount,
        cancelledCount: status === 'cancelled' ? 9 : 0,
      }),
    });

    await renderAndTrack();

    expect(probe().dataset.status).toBe(status);
    expect(probe().dataset.ready).toBe(String(readyCount));
    expect(probe().dataset.failed).toBe(String(failedCount));
    expect(probe().dataset.active).toBe('false');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps polling after a transient query error and clears it on recovery', async () => {
    mocks.getRun
      .mockResolvedValueOnce({ error: 'API temporarily unavailable' })
      .mockResolvedValueOnce({ run: run('ready', { readyCount: 12 }) });

    await renderAndTrack();
    expect(probe().dataset.error).toBe('API temporarily unavailable');
    expect(probe().dataset.active).toBe('true');

    await advance(1_000);
    expect(probe().dataset.error).toBe('');
    expect(probe().dataset.status).toBe('ready');
    expect(probe().dataset.active).toBe('false');
  });

  it('keeps polling after the browser request rejects and clears it on recovery', async () => {
    mocks.getRun
      .mockRejectedValueOnce(new Error('network disconnected'))
      .mockResolvedValueOnce({ run: run('ready', { readyCount: 12 }) });

    await renderAndTrack();
    expect(probe().dataset.error).toBe('network disconnected');
    expect(probe().dataset.active).toBe('true');

    await advance(1_000);
    expect(probe().dataset.error).toBe('');
    expect(probe().dataset.status).toBe('ready');
    expect(probe().dataset.active).toBe('false');
  });

  it('ignores an older in-flight run response after tracking switches', async () => {
    const staleRun = deferred<{ run: ReturnType<typeof run> }>();
    mocks.getRun.mockImplementation((runId: string) => {
      if (runId === 'run-global') {
        return staleRun.promise;
      }
      return Promise.resolve({
        run: { ...run('processing', { processingCount: 2 }), runId: 'run-new' },
      });
    });

    await renderAndTrack();
    const trackNew = host?.querySelector<HTMLButtonElement>('[data-testid="track-new"]');
    act(() => trackNew?.click());
    await flushWork();

    await act(async () => {
      staleRun.resolve({ run: run('ready', { readyCount: 12 }) });
      await staleRun.promise;
    });
    await flushWork();

    expect(probe().dataset.runId).toBe('run-new');
    expect(probe().dataset.status).toBe('processing');
    expect(probe().dataset.ready).toBe('0');
  });

  it('does not let an older mutation response replace a newer successfully tracked run', async () => {
    mocks.getRun.mockImplementation((runId: string) =>
      Promise.resolve({
        run: {
          ...run('processing', { processingCount: 1 }),
          runId,
        },
      }),
    );

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root?.render(<RunProbe />));
    await flushWork();

    const click = (testId: string) => {
      act(() => host?.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)?.click());
    };
    click('begin-old');
    click('begin-new');
    click('settle-new');
    await flushWork();
    click('settle-old');
    await flushWork();

    expect(probe().dataset.runId).toBe('run-new');
    expect(probe().dataset.status).toBe('processing');
    expect(mocks.getRun).toHaveBeenCalledWith('run-new');
    expect(mocks.getRun).not.toHaveBeenCalledWith('run-old');
  });

  it('tracks an older successful run when the newer request produced no run', async () => {
    mocks.getRun.mockImplementation((runId: string) =>
      Promise.resolve({
        run: {
          ...run('processing', { processingCount: 1 }),
          runId,
        },
      }),
    );

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root?.render(<RunProbe />));
    await flushWork();

    const click = (testId: string) => {
      act(() => host?.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)?.click());
    };
    click('begin-old');
    click('begin-new');
    click('settle-new-empty');
    click('settle-old');
    await flushWork();

    expect(probe().dataset.runId).toBe('run-old');
    expect(probe().dataset.status).toBe('processing');
    expect(mocks.getRun).toHaveBeenCalledWith('run-old');
  });
});
