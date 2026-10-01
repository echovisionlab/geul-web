// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { useMapThemeEditorInterruption } from './useMapThemeEditorInterruption';

type StatelessListener = (event: { payload: string }) => void;

function createProvider() {
  const statelessListeners = new Set<StatelessListener>();
  let authenticationFailedListener: ((event: { reason: string }) => void) | null = null;

  return {
    disconnect: vi.fn(),
    on: vi.fn((event: string, listener: StatelessListener | ((event: { reason: string }) => void)) => {
      if (event === 'stateless') {
        statelessListeners.add(listener as StatelessListener);
      } else if (event === 'authenticationFailed') {
        authenticationFailedListener = listener as (event: { reason: string }) => void;
      }
    }),
    off: vi.fn((event: string, listener: StatelessListener | ((event: { reason: string }) => void)) => {
      if (event === 'stateless') {
        statelessListeners.delete(listener as StatelessListener);
      } else if (event === 'authenticationFailed' && authenticationFailedListener === listener) {
        authenticationFailedListener = null;
      }
    }),
    emit(payload: unknown) {
      statelessListeners.forEach((listener) => listener({ payload: JSON.stringify(payload) }));
    },
  };
}

describe('useMapThemeEditorInterruption', () => {
  it.each([
    {
      payload: { kind: 'permission_revoked', reason: 'permission_revoked' },
      expectedInterruption: 'permission_revoked',
    },
    {
      payload: { kind: 'session_expired', reason: 'session_expired' },
      expectedInterruption: 'session_expired',
    },
  ] as const)(
    'disconnects and blocks mutation for access interruption $payload.kind',
    ({ payload, expectedInterruption }) => {
      const provider = createProvider();
      const container = document.createElement('div');
      const root = createRoot(container);
      const result: { current: ReturnType<typeof useMapThemeEditorInterruption> | null } = {
        current: null,
      };

      function Probe() {
        result.current = useMapThemeEditorInterruption(provider as never, 'theme-1');
        return null;
      }

      act(() => root.render(<Probe />));

      act(() => provider.emit(payload));

      expect(result.current?.blocked).toBe(true);
      expect(result.current?.interruption).toBe(expectedInterruption);
      expect(provider.disconnect).toHaveBeenCalledOnce();
      act(() => root.unmount());
    },
  );
});
