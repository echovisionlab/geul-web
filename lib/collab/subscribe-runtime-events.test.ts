// @vitest-environment jsdom

import type { EditorRuntimeEvent } from '@echovisionlab/geul-common/collaboration/runtime-events';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type StatelessHandler = (input: { payload: string }) => void;

function createProvider() {
  const handlers = new Set<StatelessHandler>();
  const provider = {
    on: vi.fn((event: string, handler: StatelessHandler) => {
      if (event === 'stateless') {
        handlers.add(handler);
      }
    }),
    off: vi.fn((event: string, handler: StatelessHandler) => {
      if (event === 'stateless') {
        handlers.delete(handler);
      }
    }),
  };
  return {
    provider: provider as unknown as HocuspocusProvider,
    handlers,
    emit: (payload: unknown) => {
      for (const handler of handlers) {
        handler({ payload: typeof payload === 'string' ? payload : JSON.stringify(payload) });
      }
    },
  };
}

function mediaEvent(entityId: string, sequence: number, locale?: string): EditorRuntimeEvent {
  return {
    version: 1,
    kind: 'media.processing.lifecycle',
    entityType: 'post',
    entityId,
    ...(locale === undefined ? {} : { locale }),
    correlationId: `job-${sequence}`,
    sequence,
    timestampMs: 1_700_000_000_000 + sequence,
    payload: { fileId: 'file-a', status: 'processing', percentage: sequence },
  } as EditorRuntimeEvent;
}

function readyEvent(entityId: string, sequence: number): EditorRuntimeEvent {
  const event = mediaEvent(entityId, sequence);
  return { ...event, payload: { fileId: 'file-a', status: 'ready', outputs: {} } } as EditorRuntimeEvent;
}

async function freshModule() {
  vi.resetModules();
  return import('./subscribe-runtime-events');
}

const RUNTIME_EVENTS_MODULE = '@echovisionlab/geul-common/collaboration/runtime-events';

/** Makes the parser chunk request fail while `failing()` is true (an unreachable chunk). */
function mockParserChunk(failing: () => boolean) {
  const requests = vi.fn();
  vi.doMock(RUNTIME_EVENTS_MODULE, async (importOriginal) => {
    requests();
    if (failing()) {
      throw new Error('Failed to fetch dynamically imported module');
    }
    return importOriginal();
  });
  return requests;
}

describe('subscribeToProviderRuntimeEvents', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock(RUNTIME_EVENTS_MODULE);
    vi.useRealTimers();
  });

  it('returns a no-op without a provider', async () => {
    const { subscribeToProviderRuntimeEvents } = await freshModule();
    const unsubscribe = subscribeToProviderRuntimeEvents(null, vi.fn());
    expect(unsubscribe).toBeTypeOf('function');
    unsubscribe();
  });

  it('delivers events received before the Common parser loads, in order, through the filters', async () => {
    const { subscribeToProviderRuntimeEvents } = await freshModule();
    const runtime = createProvider();
    const onEvent = vi.fn();
    subscribeToProviderRuntimeEvents(runtime.provider, onEvent, {
      entityType: 'post',
      entityId: 'post-1',
      locale: 'ko',
    });

    runtime.emit(mediaEvent('post-1', 1, 'ko'));
    runtime.emit(mediaEvent('post-2', 2, 'ko'));
    runtime.emit('not json');
    runtime.emit({ version: 1, kind: 'unknown.kind' });
    runtime.emit(mediaEvent('post-1', 3, ' ko '));
    runtime.emit(mediaEvent('post-1', 4, 'en'));
    expect(onEvent).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(2));
    expect(onEvent.mock.calls.map(([event]) => event.sequence)).toEqual([1, 3]);
    expect(onEvent.mock.calls[0]?.[0]).toEqual(mediaEvent('post-1', 1, 'ko'));
  });

  it('delivers synchronously once the parser has loaded', async () => {
    const { subscribeToProviderRuntimeEvents } = await freshModule();
    const first = createProvider();
    subscribeToProviderRuntimeEvents(first.provider, vi.fn());
    const preload = vi.fn();
    first.emit(mediaEvent('post-1', 1));
    const warm = subscribeToProviderRuntimeEvents(first.provider, preload);
    await vi.waitFor(() => expect(preload).not.toHaveBeenCalled());
    warm();

    const runtime = createProvider();
    const onEvent = vi.fn();
    subscribeToProviderRuntimeEvents(runtime.provider, onEvent);
    await vi.waitFor(async () => {
      runtime.emit(mediaEvent('post-1', 5));
      expect(onEvent).toHaveBeenCalled();
    });
    onEvent.mockClear();
    runtime.emit(mediaEvent('post-1', 6));
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0]?.[0].sequence).toBe(6);
  });

  it('drops buffered events after unsubscribe', async () => {
    const { subscribeToProviderRuntimeEvents } = await freshModule();
    const runtime = createProvider();
    const onEvent = vi.fn();
    const unsubscribe = subscribeToProviderRuntimeEvents(runtime.provider, onEvent);
    runtime.emit(mediaEvent('post-1', 1));
    unsubscribe();
    expect(runtime.provider.off).toHaveBeenCalledWith('stateless', expect.any(Function));

    const other = createProvider();
    const otherListener = vi.fn();
    subscribeToProviderRuntimeEvents(other.provider, otherListener);
    other.emit(mediaEvent('post-1', 2));
    await vi.waitFor(() => expect(otherListener).toHaveBeenCalledTimes(1));
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('keeps events queued while the parser chunk fails and delivers them in order after a retry', async () => {
    let failing = true;
    const requests = mockParserChunk(() => failing);
    vi.useFakeTimers();
    const { subscribeToProviderRuntimeEvents } = await freshModule();
    const runtime = createProvider();
    const onEvent = vi.fn();
    const onResync = vi.fn();
    subscribeToProviderRuntimeEvents(runtime.provider, onEvent, { onResync });

    runtime.emit(mediaEvent('post-1', 1));
    runtime.emit(readyEvent('post-1', 2));
    await vi.advanceTimersByTimeAsync(0);
    expect(requests).toHaveBeenCalled();
    expect(onEvent).not.toHaveBeenCalled();

    // The network recovers before the next backoff step; nothing was dropped meanwhile.
    failing = false;
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(2));
    expect(onEvent.mock.calls.map(([event]) => [event.sequence, (event.payload as { status: string }).status])).toEqual(
      [
        [1, 'processing'],
        [2, 'ready'],
      ],
    );
    expect(onResync).not.toHaveBeenCalled();

    // Delivery is synchronous once the parser has loaded.
    runtime.emit(mediaEvent('post-1', 3));
    expect(onEvent).toHaveBeenCalledTimes(3);
  });

  it('asks the consumer to resync when retries are exhausted, and retries on the next event and online', async () => {
    let failing = true;
    const requests = mockParserChunk(() => failing);
    vi.useFakeTimers();
    const { subscribeToProviderRuntimeEvents } = await freshModule();
    const runtime = createProvider();
    const onEvent = vi.fn();
    const onResync = vi.fn();
    subscribeToProviderRuntimeEvents(runtime.provider, onEvent, { onResync });

    runtime.emit(readyEvent('post-1', 1));
    await vi.advanceTimersByTimeAsync(60_000);
    // Retries are spaced out (no tight loop) and end in a resync instead of a silent drop.
    const attempts = requests.mock.calls.length;
    expect(attempts).toBeGreaterThan(1);
    expect(attempts).toBeLessThan(10);
    expect(onResync).toHaveBeenCalledTimes(1);
    expect(onEvent).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(requests).toHaveBeenCalledTimes(attempts);

    // The next event starts another round; going online retries at once.
    runtime.emit(mediaEvent('post-1', 2));
    await vi.advanceTimersByTimeAsync(0);
    expect(requests.mock.calls.length).toBeGreaterThan(attempts);
    failing = false;
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(1));
    expect(onEvent.mock.calls[0]?.[0].sequence).toBe(2);
  });
});
