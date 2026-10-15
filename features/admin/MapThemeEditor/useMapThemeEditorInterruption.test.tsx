// @vitest-environment jsdom
import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';

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
  it('blocks mutations while preserving content and the connection on a view downgrade', () => {
    const provider = createProvider();
    const container = document.createElement('div');
    const root = createRoot(container);
    function Probe() {
      const access = useMapThemeEditorInterruption(provider as never, 'theme-1');
      return (
        <div>
          <p>Readable map theme</p>
          <button type="button" disabled={access.blocked}>
            Edit
          </button>
          <output>{access.interruption}</output>
        </div>
      );
    }
    act(() => root.render(<Probe />));
    const content = container.querySelector('p');
    act(() => setProviderAccessLevel(provider, 'view'));
    expect(container.querySelector('button')?.disabled).toBe(true);
    expect(container.querySelector('p')).toBe(content);
    expect(container.querySelector('output')?.textContent).toBe('');
    expect(provider.disconnect).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
  it.each([
    {
      payload: { v: 3, kind: 'room.access_ended', reason: 'permission_revoked' },
      expectedInterruption: 'permission_revoked',
    },
    {
      payload: { v: 3, kind: 'room.access_ended', reason: 'session_expired' },
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
