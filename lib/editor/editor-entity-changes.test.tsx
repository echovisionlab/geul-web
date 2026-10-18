// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setProviderDocumentRevision } from '@/lib/collab/provider-control-state';
import { publishEditorEntityChange, useEditorEntityChanges } from './editor-entity-changes';
import { AuthoritativeConfiguration } from './useAuthoritativeConfiguration';
import { getEditorWriteOrigin } from './editor-write-origin';

vi.mock('@/lib/contexts/EditorRuntimeContext', () => ({
  useOptionalEditorRuntimeContext: () => null,
}));

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

let root: Root;
let container: HTMLDivElement;
let onChange: ReturnType<typeof vi.fn<() => void>>;

function ChangeListener({
  document,
  provider,
  configuration,
}: {
  document: string;
  provider?: TestProvider | null;
  configuration?: AuthoritativeConfiguration<{ slug: string }>;
}) {
  useEditorEntityChanges(document, onChange, provider, undefined, configuration?.captureOwnChange);
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  onChange = vi.fn<() => void>();
  container = document.createElement('div');
  root = createRoot(container);
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  vi.useRealTimers();
  act(() => root.unmount());
  vi.unstubAllGlobals();
});

describe('editor entity-change listeners', () => {
  it('coalesces shared server hints for the exact entity key', () => {
    const provider = createProvider();
    act(() => root.render(<ChangeListener document="campaign:entity-1" provider={provider} />));

    const payloads = [
      '{not json',
      JSON.stringify({ v: 2, kind: 'entity.changed', entity: 'campaign:entity-1', scope: 'metadata' }),
      JSON.stringify({ v: 3, kind: 'entity.changed', entity: 'campaign:other', scope: 'metadata' }),
      JSON.stringify({ kind: 'content.updated', version: 1, document: 'campaign:entity-1' }),
    ];
    for (const payload of payloads) {
      act(() => provider.emit('stateless', { payload }));
    }
    expect(onChange).not.toHaveBeenCalled();

    act(() =>
      provider.emit('stateless', {
        payload: JSON.stringify({ v: 3, kind: 'entity.changed', entity: 'campaign:entity-1', scope: 'metadata' }),
      }),
    );
    expect(onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(250));
    expect(onChange).toHaveBeenCalledExactlyOnceWith();
  });

  it('refetches on provider sync and removes provider listeners on unmount', () => {
    const provider = createProvider();
    act(() => root.render(<ChangeListener document="release:entity-1" provider={provider} />));

    expect(provider.on).toHaveBeenCalledTimes(2);
    act(() => provider.emit('synced', { state: false }));
    expect(onChange).not.toHaveBeenCalled();
    act(() => provider.emit('synced', { state: true }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith();

    act(() => root.unmount());
    expect(provider.off).toHaveBeenCalledTimes(2);
    act(() => provider.emit('synced', { state: true }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith();
  });

  it('keeps same-origin BroadcastChannel hints working and closes both channels', () => {
    class FakeBroadcastChannel {
      static instances = new Set<FakeBroadcastChannel>();
      onmessage: ((event: MessageEvent<unknown>) => void) | null = null;

      constructor(readonly name: string) {
        FakeBroadcastChannel.instances.add(this);
      }

      postMessage(data: unknown) {
        for (const channel of FakeBroadcastChannel.instances) {
          if (channel !== this && channel.name === this.name) {
            channel.onmessage?.({ data } as MessageEvent<unknown>);
          }
        }
      }

      close() {
        FakeBroadcastChannel.instances.delete(this);
      }
    }
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    act(() => root.render(<ChangeListener document="email_template:entity-1" />));
    expect(FakeBroadcastChannel.instances.size).toBe(1);

    act(() => publishEditorEntityChange('email_template:other'));
    expect(onChange).not.toHaveBeenCalled();
    act(() => publishEditorEntityChange('email_template:entity-1'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith();
    expect(FakeBroadcastChannel.instances.size).toBe(1);

    act(() => root.unmount());
    expect(FakeBroadcastChannel.instances.size).toBe(0);
  });
});

it('collapses 100 notifications into one refetch, skips a held document revision and cancels on unmount', () => {
  const provider = createProvider();
  const held = '11111111-1111-4111-8111-111111111111';
  const next = '22222222-2222-4222-8222-222222222222';
  setProviderDocumentRevision(provider, held);
  act(() => root.render(<ChangeListener document="post:entity" provider={provider} />));
  const hint = (revision: string) =>
    provider.emit('stateless', {
      payload: JSON.stringify({ v: 3, kind: 'entity.changed', entity: 'post:entity', scope: 'document', revision }),
    });
  act(() => hint(held));
  act(() => vi.advanceTimersByTime(250));
  expect(onChange).not.toHaveBeenCalled();
  act(() => {
    for (let i = 0; i < 100; i += 1) {
      hint(next);
    }
  });
  act(() => vi.advanceTimersByTime(249));
  expect(onChange).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(onChange).toHaveBeenCalledOnce();
  act(() => hint(next));
  setProviderDocumentRevision(provider, next);
  act(() => vi.advanceTimersByTime(250));
  expect(onChange).toHaveBeenCalledOnce();
  act(() => hint(held));
  act(() => root.unmount());
  act(() => vi.advanceTimersByTime(250));
  expect(onChange).toHaveBeenCalledOnce();
});

it('refetches metadata and locale changes that keep the held document revision', () => {
  const provider = createProvider();
  const held = '11111111-1111-4111-8111-111111111111';
  setProviderDocumentRevision(provider, held);
  act(() => root.render(<ChangeListener document="post:entity" provider={provider} />));
  for (const [index, scope] of (['metadata', 'locale'] as const).entries()) {
    act(() =>
      provider.emit('stateless', {
        payload: JSON.stringify({ v: 3, kind: 'entity.changed', entity: 'post:entity', scope, revision: held }),
      }),
    );
    act(() => vi.advanceTimersByTime(250));
    expect(onChange).toHaveBeenCalledTimes(index + 1);
  }
});

it('drops queued and later refetches once access ends', () => {
  const provider = createProvider();
  act(() => root.render(<ChangeListener document="post:entity" provider={provider} />));
  const hint = () =>
    provider.emit('stateless', {
      payload: JSON.stringify({ v: 3, kind: 'entity.changed', entity: 'post:entity', scope: 'metadata' }),
    });
  act(() => hint());
  act(() =>
    provider.emit('stateless', {
      payload: JSON.stringify({ v: 3, kind: 'room.access_ended', reason: 'permission_revoked' }),
    }),
  );
  act(() => hint());
  act(() => provider.emit('synced', { state: true }));
  act(() => vi.advanceTimersByTime(250));
  expect(onChange).not.toHaveBeenCalled();
});

it('keeps a queued metadata refetch when a document notification in the same window becomes held', () => {
  const provider = createProvider();
  const held = '11111111-1111-4111-8111-111111111111';
  const next = '22222222-2222-4222-8222-222222222222';
  setProviderDocumentRevision(provider, held);
  act(() => root.render(<ChangeListener document="post:entity" provider={provider} />));
  const emit = (scope: string, revision: string) =>
    provider.emit('stateless', {
      payload: JSON.stringify({ v: 3, kind: 'entity.changed', entity: 'post:entity', scope, revision }),
    });
  act(() => emit('metadata', held));
  act(() => emit('document', next));
  setProviderDocumentRevision(provider, next);
  act(() => vi.advanceTimersByTime(250));
  expect(onChange).toHaveBeenCalledOnce();
});

it('scopes ended access to the revoked entity connection', () => {
  class FakeBroadcastChannel {
    static instances = new Set<FakeBroadcastChannel>();
    onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
    constructor(readonly name: string) {
      FakeBroadcastChannel.instances.add(this);
    }
    postMessage(data: unknown) {
      for (const channel of FakeBroadcastChannel.instances) {
        if (channel !== this && channel.name === this.name) {
          channel.onmessage?.({ data } as MessageEvent<unknown>);
        }
      }
    }
    close() {
      FakeBroadcastChannel.instances.delete(this);
    }
  }
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
  const provider = createProvider();
  act(() => root.render(<ChangeListener document="post:a" provider={provider} />));
  act(() =>
    provider.emit('stateless', {
      payload: JSON.stringify({ v: 3, kind: 'room.access_ended', reason: 'permission_revoked' }),
    }),
  );
  act(() => publishEditorEntityChange('post:a'));
  expect(onChange).not.toHaveBeenCalled();

  act(() => root.render(<ChangeListener document="post:b" />));
  act(() => publishEditorEntityChange('post:b'));
  expect(onChange).toHaveBeenCalledOnce();

  const reconnected = createProvider();
  act(() => root.render(<ChangeListener document="post:a" provider={reconnected} />));
  act(() => publishEditorEntityChange('post:a'));
  expect(onChange).toHaveBeenCalledTimes(2);
});

it('skips adopted local-origin server hints but refetches another tab of the same member', () => {
  const provider = createProvider();
  const document = `post:${crypto.randomUUID()}`;
  const configuration = new AuthoritativeConfiguration(document, { slug: 'initial' });
  act(() => root.render(<ChangeListener document={document} provider={provider} configuration={configuration} />));
  const write = configuration.beginWrite({ slug: 'local' });
  const hint = (origin: string) =>
    provider.emit('stateless', {
      payload: JSON.stringify({ v: 3, kind: 'entity.changed', entity: document, scope: 'metadata', origin }),
    });
  act(() => hint(write.origin));
  write.acknowledge({ slug: 'canonical' });
  act(() => vi.advanceTimersByTime(250));
  expect(onChange).not.toHaveBeenCalled();
  act(() => hint(write.origin));
  act(() => vi.advanceTimersByTime(250));
  expect(onChange).not.toHaveBeenCalled();
  act(() => hint(crypto.randomUUID()));
  act(() => vi.advanceTimersByTime(250));
  expect(onChange).toHaveBeenCalledOnce();
});

it('applies canonical origin proof to the saving tabs separate BroadcastChannel listener', () => {
  class FakeBroadcastChannel {
    static instances = new Set<FakeBroadcastChannel>();
    onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
    constructor(readonly name: string) {
      FakeBroadcastChannel.instances.add(this);
    }
    postMessage(data: unknown) {
      for (const channel of FakeBroadcastChannel.instances) {
        if (channel !== this && channel.name === this.name) {
          channel.onmessage?.({ data } as MessageEvent<unknown>);
        }
      }
    }
    close() {
      FakeBroadcastChannel.instances.delete(this);
    }
  }
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
  const document = `post:${crypto.randomUUID()}`;
  const configuration = new AuthoritativeConfiguration(document, { slug: 'initial' });
  act(() => root.render(<ChangeListener document={document} configuration={configuration} />));
  const write = configuration.beginWrite({ slug: 'local' });
  write.acknowledge({ slug: 'canonical' });
  act(() => publishEditorEntityChange(document, getEditorWriteOrigin()));
  expect(onChange).not.toHaveBeenCalled();
  act(() => publishEditorEntityChange(document, crypto.randomUUID()));
  expect(onChange).toHaveBeenCalledOnce();
  act(() => publishEditorEntityChange(document));
  expect(onChange).toHaveBeenCalledTimes(2);
});
