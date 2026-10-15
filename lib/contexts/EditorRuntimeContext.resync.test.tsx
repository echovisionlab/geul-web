// @vitest-environment jsdom

import { act } from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.doUnmock('@/lib/collab/runtime-event-parser');
  vi.useRealTimers();
});

it('asks every runtime event subscriber to resync when the event parser cannot load', async () => {
  vi.resetModules();
  // The parser chunk is unreachable (for example, removed by a deployment).
  vi.doMock('@/lib/collab/runtime-event-parser', () => {
    throw new Error('Failed to fetch dynamically imported module');
  });
  vi.useFakeTimers();
  const { EditorRuntimeProvider } = await import('./EditorRuntimeContext');
  const { useEditorRuntimeEvents } = await import('@/lib/hooks/useEditorRuntimeEvents');

  let stateless: ((input: { payload: string }) => void) | undefined;
  const provider = {
    on: vi.fn((event: string, handler: (input: { payload: string }) => void) => {
      if (event === 'stateless') {
        stateless = handler;
      }
    }),
    off: vi.fn(),
  } as unknown as HocuspocusProvider;
  const onEvent = vi.fn();
  const onResync = vi.fn();
  function Subscriber() {
    useEditorRuntimeEvents(null, onEvent, { entityType: 'post', entityId: 'post-1', onResync });
    return null;
  }

  const host = document.createElement('div');
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <EditorRuntimeProvider provider={provider} entityType="page" entityId="post-1">
        <Subscriber />
      </EditorRuntimeProvider>,
    );
  });
  act(() => stateless?.({ payload: JSON.stringify({ version: 1, kind: 'media.processing.lifecycle' }) }));
  await act(() => vi.advanceTimersByTimeAsync(60_000));

  expect(onResync).toHaveBeenCalledTimes(1);
  expect(onEvent).not.toHaveBeenCalled();
  act(() => root.unmount());
});
