// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publishEditorEntityChange, useEditorEntityChanges } from './editor-entity-changes';

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

function ChangeListener({ document, provider }: { document: string; provider?: TestProvider | null }) {
  useEditorEntityChanges(document, onChange, provider);
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  onChange = vi.fn<() => void>();
  container = document.createElement('div');
  root = createRoot(container);
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
});

describe('editor entity-change listeners', () => {
  it('accepts only version 1 server hints for the exact entity key', () => {
    const provider = createProvider();
    act(() => root.render(<ChangeListener document="campaign:entity-1" provider={provider} />));

    const payloads = [
      '{not json',
      JSON.stringify({ kind: 'editor.entity_changed', version: 2, document: 'campaign:entity-1' }),
      JSON.stringify({ kind: 'editor.entity_changed', version: 1, document: 'campaign:other' }),
      JSON.stringify({ kind: 'content.updated', version: 1, document: 'campaign:entity-1' }),
    ];
    for (const payload of payloads) {
      act(() => provider.emit('stateless', { payload }));
    }
    expect(onChange).not.toHaveBeenCalled();

    act(() =>
      provider.emit('stateless', {
        payload: JSON.stringify({ kind: 'editor.entity_changed', version: 1, document: 'campaign:entity-1' }),
      }),
    );
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
