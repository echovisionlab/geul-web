// @vitest-environment jsdom
import { createRoot } from 'react-dom/client';
import { act, useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AuthoringExtension, AuthoringExtensionsProvider } from './AuthoringExtensionsContext';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('embedded authoring extension availability', () => {
  it('preserves production extensions by default and never mounts unavailable service controllers', () => {
    const connect = vi.fn();
    function ServiceController() {
      useEffect(connect, []);
      return <button type="button">Manage translations</button>;
    }
    const host = document.createElement('div');
    const root = createRoot(host);
    act(() =>
      root.render(
        <AuthoringExtension kind="translations">
          <ServiceController />
        </AuthoringExtension>,
      ),
    );
    expect(connect).toHaveBeenCalledOnce();
    expect(host.querySelector('button')).not.toBeNull();
    act(() =>
      root.render(
        <AuthoringExtensionsProvider available={{ translations: false }}>
          <AuthoringExtension kind="translations">
            <ServiceController />
          </AuthoringExtension>
          <AuthoringExtension kind="sharing">
            <span>Sharing remains available</span>
          </AuthoringExtension>
        </AuthoringExtensionsProvider>,
      ),
    );
    expect(host.querySelector('button')).toBeNull();
    expect(connect).toHaveBeenCalledOnce();
    expect(host.textContent).toBe('Sharing remains available');
    act(() => root.unmount());
  });
});
