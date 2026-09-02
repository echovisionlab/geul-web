// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import type { TranslationLifecycleRefetchHint } from '@/lib/translation/lifecycle';
import { useTranslationLifecycleSubscription } from './useTranslationLifecycleSubscription';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  constructor(public readonly url: string) {
    FakeEventSource.instances.push(this);
  }
}

class FakeProvider {
  private handlers = new Map<string, Set<(message?: { payload: string }) => void>>();

  on(event: string, handler: (message?: { payload: string }) => void) {
    const handlers = this.handlers.get(event) ?? new Set();
    handlers.add(handler);
    this.handlers.set(event, handlers);
  }

  off(event: string, handler: (message?: { payload: string }) => void) {
    this.handlers.get(event)?.delete(handler);
  }

  emitLifecycle(event: {
    jobId: string;
    entityType: TranslationLifecycleRefetchHint['entityType'] | 'series';
    entityId: string;
    targetLocale: string;
    timestampMs: number;
    error?: string;
  }) {
    this.emitStateless({
      version: 1,
      kind: 'translation.lifecycle',
      entityType: event.entityType,
      entityId: event.entityId,
      locale: event.targetLocale,
      correlationId: event.jobId,
      timestampMs: event.timestampMs,
      payload: {
        jobId: event.jobId,
        targetLocale: event.targetLocale,
        status: 'failed',
        error: event.error,
      },
    });
  }

  emitStateless(event: unknown) {
    const payload = JSON.stringify(event);

    for (const handler of this.handlers.get('stateless') ?? []) {
      handler({ payload });
    }
  }

  emitConnect() {
    for (const handler of this.handlers.get('connect') ?? []) {
      handler();
    }
  }
}

function TestHarness({
  onEvent,
  onReconnect,
  provider = null,
  entityType = 'post',
  entityId = 'post-1',
}: {
  onEvent: (event: TranslationLifecycleRefetchHint) => void;
  onReconnect?: () => void;
  provider?: HocuspocusProvider | null;
  entityType?: 'post' | 'post_series';
  entityId?: string;
}) {
  useTranslationLifecycleSubscription({
    provider,
    entityType,
    entityId,
    onEvent,
    onReconnect,
  });
  return null;
}

function RuntimeContextHarness({ provider, children }: { provider: FakeProvider; children: ReactNode }) {
  return (
    <EditorRuntimeProvider provider={provider as unknown as HocuspocusProvider} entityType="post" entityId="post-1">
      {children}
    </EditorRuntimeProvider>
  );
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;
const originalEventSource = globalThis.EventSource;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
  FakeEventSource.instances = [];
  globalThis.EventSource = originalEventSource;
});

describe('useTranslationLifecycleSubscription', () => {
  it('does not open a standalone lifecycle transport without a collab provider', () => {
    globalThis.EventSource = FakeEventSource as unknown as typeof EventSource;

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(<TestHarness onEvent={() => undefined} />);
    });

    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('uses provider stateless events when a collab provider is available', () => {
    const events: TranslationLifecycleRefetchHint[] = [];
    const provider = new FakeProvider();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <TestHarness provider={provider as unknown as HocuspocusProvider} onEvent={(event) => events.push(event)} />,
      );
    });

    act(() => {
      provider.emitLifecycle({
        jobId: 'job-provider-1',
        entityType: 'post',
        entityId: 'post-1',
        targetLocale: 'fr',
        timestampMs: 100,
      });
    });

    expect(events).toEqual([
      {
        jobId: 'job-provider-1',
        entityType: 'post',
        entityId: 'post-1',
        targetLocale: 'fr',
        timestampMs: 100,
      },
    ]);
  });

  it('maps the Post Series UI key to the canonical runtime series filter', () => {
    const events: TranslationLifecycleRefetchHint[] = [];
    const provider = new FakeProvider();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <TestHarness
          provider={provider as unknown as HocuspocusProvider}
          entityType="post_series"
          entityId="series-1"
          onEvent={(event) => events.push(event)}
        />,
      );
    });

    act(() => {
      provider.emitLifecycle({
        jobId: 'job-series-1',
        entityType: 'series',
        entityId: 'series-1',
        targetLocale: 'ko',
        timestampMs: 200,
      });
    });

    expect(events).toEqual([
      {
        jobId: 'job-series-1',
        entityType: 'post_series',
        entityId: 'series-1',
        targetLocale: 'ko',
        timestampMs: 200,
      },
    ]);
  });

  it('rejects removed transport source identity fields', () => {
    const events: TranslationLifecycleRefetchHint[] = [];
    const provider = new FakeProvider();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <TestHarness provider={provider as unknown as HocuspocusProvider} onEvent={(event) => events.push(event)} />,
      );
    });
    act(() => {
      provider.emitStateless({
        version: 1,
        kind: 'translation.lifecycle',
        entityType: 'post',
        entityId: 'post-1',
        locale: 'fr',
        correlationId: 'job-invalid-1',
        timestampMs: 100,
        payload: {
          jobId: 'job-invalid-1',
          targetLocale: 'fr',
          status: 'failed',
          sourceRevision: '42',
        },
      });
    });

    expect(events).toEqual([]);
  });

  it('refetches authoritative state when the runtime-context provider connects or reconnects', () => {
    let reconnectCount = 0;
    const provider = new FakeProvider();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <RuntimeContextHarness provider={provider}>
          <TestHarness onEvent={() => undefined} onReconnect={() => reconnectCount++} />
        </RuntimeContextHarness>,
      );
    });

    act(() => {
      provider.emitConnect();
      provider.emitConnect();
    });

    expect(reconnectCount).toBe(2);
  });
});
