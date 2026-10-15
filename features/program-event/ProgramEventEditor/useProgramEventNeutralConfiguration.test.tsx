// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgramEventNeutralConfiguration } from '@/lib/actions/program-event';
import {
  mergeProgramEventTypeOption,
  resolveProgramEventObservedRelations,
  useProgramEventNeutralConfiguration,
} from './useProgramEventNeutralConfiguration';

type ProviderEvent = 'stateless' | 'synced';
type ProviderPayload = { payload?: string; state?: boolean };
type ProviderListener = (payload: ProviderPayload) => void;
type TestProvider = HocuspocusProvider & {
  on: ReturnType<typeof vi.fn<(event: ProviderEvent, listener: ProviderListener) => void>>;
  off: ReturnType<typeof vi.fn<(event: ProviderEvent, listener: ProviderListener) => void>>;
  emit: (event: ProviderEvent, payload: ProviderPayload) => void;
};

function createProvider(): TestProvider {
  const listeners = new Map<ProviderEvent, Set<ProviderListener>>();
  return {
    on: vi.fn((event: ProviderEvent, listener: ProviderListener) => {
      const entries = listeners.get(event) ?? new Set<ProviderListener>();
      entries.add(listener);
      listeners.set(event, entries);
    }),
    off: vi.fn((event: ProviderEvent, listener: ProviderListener) => {
      listeners.get(event)?.delete(listener);
    }),
    emit(event: ProviderEvent, payload: ProviderPayload) {
      for (const listener of listeners.get(event) ?? []) {
        listener(payload);
      }
    },
  } as unknown as TestProvider;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function configuration(overrides: Partial<ProgramEventNeutralConfiguration> = {}): ProgramEventNeutralConfiguration {
  return {
    slug: 'event',
    typeId: 'type-1',
    typeName: 'Existing Type',
    seriesId: null,
    seriesOrder: null,
    startsAt: null,
    endsAt: null,
    timezone: 'UTC',
    allDay: false,
    locationMode: 'tba',
    mapPlaceId: null,
    ticketUrl: null,
    streamUrl: null,
    externalUrl: null,
    artists: [{ id: 'artist-1', role: 'performer', sortOrder: 0 }],
    labels: [],
    clients: [],
    ...overrides,
  };
}

let root: Root;
let host: HTMLDivElement;
let current: ReturnType<typeof useProgramEventNeutralConfiguration>;

function HookHarness(props: Parameters<typeof useProgramEventNeutralConfiguration>[0]) {
  current = useProgramEventNeutralConfiguration(props);
  return null;
}

function emitHint(provider: TestProvider, document: string) {
  provider.emit('stateless', {
    payload: JSON.stringify({ v: 3, kind: 'entity.changed', entity: document.replaceAll('_', '-'), scope: 'metadata' }),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement('div');
  root = createRoot(host);
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  vi.useRealTimers();
  act(() => root.unmount());
});

describe('useProgramEventNeutralConfiguration', () => {
  it('rejects a read predating acknowledgement and keeps a newer same-field reversal protected', async () => {
    const staleRead = deferred<{ ok: true; configuration: ProgramEventNeutralConfiguration }>();
    const afterWriteRead = deferred<{ ok: true; configuration: ProgramEventNeutralConfiguration }>();
    const loadConfiguration = vi
      .fn()
      .mockReturnValueOnce(staleRead.promise)
      .mockReturnValueOnce(afterWriteRead.promise);
    const onAdopt = vi.fn();
    act(() =>
      root.render(
        <HookHarness
          eventId="event-1"
          initialConfiguration={configuration()}
          loadConfiguration={loadConfiguration}
          onAdopt={onAdopt}
        />,
      ),
    );
    act(() => current.setDraft('timezone', 'Asia/Tokyo'));
    const write = current.beginWrite({ timezone: 'Asia/Tokyo' });
    act(() => current.setDraft('timezone', 'UTC'));
    act(() => write.acknowledge({ timezone: 'Asia/Tokyo' }));
    await act(async () => {
      staleRead.resolve({ ok: true, configuration: configuration({ timezone: 'stale', allDay: true }) });
      await staleRead.promise;
    });
    expect(onAdopt).not.toHaveBeenCalled();
    await act(async () => {
      afterWriteRead.resolve({ ok: true, configuration: configuration({ timezone: 'Asia/Tokyo', allDay: true }) });
      await afterWriteRead.promise;
    });
    expect(onAdopt).toHaveBeenLastCalledWith(expect.objectContaining({ allDay: true }));
    expect(onAdopt.mock.lastCall?.[0]).not.toHaveProperty('timezone');
  });

  it('keeps the type label protected together with a locally selected type', async () => {
    const provider = createProvider();
    const loadConfiguration = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, configuration: configuration() })
      .mockResolvedValueOnce({
        ok: true,
        configuration: configuration({ typeId: 'peer-type', typeName: 'Peer Type', allDay: true }),
      });
    const onAdopt = vi.fn();
    act(() =>
      root.render(
        <HookHarness
          eventId="event-1"
          initialConfiguration={configuration()}
          loadConfiguration={loadConfiguration}
          provider={provider}
          onAdopt={onAdopt}
        />,
      ),
    );
    await act(async () => Promise.resolve());
    act(() => current.setDraft('typeId', 'local-type'));
    await act(async () => {
      emitHint(provider, 'program_event:event-1');
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(onAdopt.mock.lastCall?.[0]).not.toHaveProperty('typeId');
    expect(onAdopt.mock.lastCall?.[0]).not.toHaveProperty('typeName');
    expect(onAdopt).toHaveBeenLastCalledWith(expect.objectContaining({ allDay: true }));
  });

  it('refetches and adopts canonical peer configuration only for the matching Event', async () => {
    const provider = createProvider();
    const loadConfiguration = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, configuration: configuration() })
      .mockResolvedValueOnce({
        ok: true,
        configuration: configuration({
          typeId: 'type-new',
          typeName: 'New Type',
          timezone: 'Asia/Seoul',
          allDay: true,
          seriesOrder: 3,
        }),
      });
    const onAdopt = vi.fn();

    act(() =>
      root.render(
        <HookHarness
          eventId="event-1"
          initialConfiguration={configuration()}
          provider={provider}
          loadConfiguration={loadConfiguration}
          onAdopt={onAdopt}
        />,
      ),
    );
    await act(async () => Promise.resolve());
    expect(loadConfiguration).toHaveBeenCalledExactlyOnceWith('event-1');

    await act(async () => {
      emitHint(provider, 'program_event:other');
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(loadConfiguration).toHaveBeenCalledOnce();
    await act(async () => {
      emitHint(provider, 'program_event:event-1');
      await vi.advanceTimersByTimeAsync(250);
    });
    await act(async () => Promise.resolve());

    expect(loadConfiguration).toHaveBeenCalledTimes(2);
    expect(onAdopt).toHaveBeenLastCalledWith(
      expect.objectContaining({
        typeId: 'type-new',
        typeName: 'New Type',
        timezone: 'Asia/Seoul',
        allDay: true,
        seriesOrder: 3,
      }),
    );
  });

  it('protects a local scalar intent during peer refresh even when the draft matches canonical data', async () => {
    const provider = createProvider();
    const loadConfiguration = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, configuration: configuration() })
      .mockResolvedValueOnce({ ok: true, configuration: configuration({ timezone: 'Asia/Tokyo', allDay: true }) })
      .mockResolvedValueOnce({ ok: true, configuration: configuration({ timezone: 'Asia/Tokyo', allDay: true }) });
    const onAdopt = vi.fn();

    act(() =>
      root.render(
        <HookHarness
          eventId="event-1"
          initialConfiguration={configuration()}
          provider={provider}
          loadConfiguration={loadConfiguration}
          onAdopt={onAdopt}
        />,
      ),
    );
    await act(async () => Promise.resolve());
    act(() => current.setDraft('timezone', 'America/Los_Angeles'));
    await act(async () => {
      emitHint(provider, 'program_event:event-1');
      await vi.advanceTimersByTimeAsync(250);
    });
    await act(async () => Promise.resolve());

    expect(onAdopt).toHaveBeenLastCalledWith(expect.objectContaining({ allDay: true }));
    expect(onAdopt.mock.lastCall?.[0]).not.toHaveProperty('timezone');

    act(() => current.setDraft('timezone', 'Asia/Tokyo'));
    await act(async () => {
      emitHint(provider, 'program_event:event-1');
      await vi.advanceTimersByTimeAsync(250);
    });
    await act(async () => Promise.resolve());
    expect(onAdopt.mock.lastCall?.[0]).not.toHaveProperty('timezone');
  });

  it('isolates A to B to A scope identity from stale setters and reads', async () => {
    const provider = createProvider();
    const firstARead = deferred<{ ok: true; configuration: ProgramEventNeutralConfiguration }>();
    const loadConfiguration = vi
      .fn()
      .mockReturnValueOnce(firstARead.promise)
      .mockResolvedValueOnce({ ok: true, configuration: configuration({ timezone: 'Europe/Paris' }) })
      .mockResolvedValueOnce({ ok: true, configuration: configuration({ timezone: 'Asia/Seoul' }) })
      .mockResolvedValueOnce({ ok: true, configuration: configuration({ timezone: 'Asia/Tokyo' }) });
    const onAdopt = vi.fn();
    const render = (eventId: string) =>
      root.render(
        <HookHarness
          eventId={eventId}
          initialConfiguration={configuration()}
          provider={provider}
          loadConfiguration={loadConfiguration}
          onAdopt={onAdopt}
        />,
      );

    act(() => render('event-A'));
    await act(async () => Promise.resolve());
    const staleSetter = current.setDraft;
    const staleBeginWrite = current.beginWrite;

    act(() => render('event-B'));
    await act(async () => Promise.resolve());
    act(() => render('event-A'));
    await act(async () => Promise.resolve());

    act(() => staleSetter('timezone', 'stale-local-A'));
    const staleWrite = staleBeginWrite({ timezone: 'stale-local-A' });
    await act(async () => {
      emitHint(provider, 'program_event:event-A');
      await vi.advanceTimersByTimeAsync(250);
    });
    await act(async () => Promise.resolve());
    expect(onAdopt).toHaveBeenLastCalledWith(expect.objectContaining({ timezone: 'Asia/Tokyo' }));
    staleWrite.fail();

    await act(async () => {
      firstARead.resolve({ ok: true, configuration: configuration({ timezone: 'stale-server-A' }) });
      await firstARead.promise;
    });
    expect(onAdopt).toHaveBeenLastCalledWith(expect.objectContaining({ timezone: 'Asia/Tokyo' }));
  });

  it('keeps the earliest observed relation baseline already attached to a queued patch', () => {
    const observedArtists = [{ id: 'artist-before', role: 'performer', sortOrder: 4 }];
    const currentBaseline = {
      artists: [{ id: 'artist-peer', role: 'host', sortOrder: 9 }],
      labels: [{ id: 'label-peer', sortOrder: 2 }],
      clients: [],
    };

    expect(
      resolveProgramEventObservedRelations(
        {
          artists: [{ id: 'artist-next', sortOrder: 0 }],
          labels: [],
          observed: { artists: observedArtists },
        },
        currentBaseline,
      ),
    ).toEqual({ artists: observedArtists, labels: currentBaseline.labels });
  });

  it('adds a remotely selected type missing from the initial list without replacing existing options', () => {
    const loaded = [
      { id: 'type-1', name: 'Existing Type' },
      { id: 'type-2', name: 'Another Type' },
    ];

    expect(mergeProgramEventTypeOption(loaded, 'type-new', 'New Type')).toEqual([
      ...loaded,
      { id: 'type-new', name: 'New Type' },
    ]);
    expect(mergeProgramEventTypeOption(loaded, 'type-1', 'Updated Type')).toEqual([
      { id: 'type-1', name: 'Updated Type' },
      { id: 'type-2', name: 'Another Type' },
    ]);
  });
});
