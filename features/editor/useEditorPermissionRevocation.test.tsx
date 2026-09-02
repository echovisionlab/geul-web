// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHocuspocusProviderFixture, type HocuspocusProviderFixture } from './hocuspocusProvider.test-fixture';
import { useEditorPermissionRevocation } from './useEditorPermissionRevocation';

let root: Root;
let container: HTMLDivElement;
let fixtures: HocuspocusProviderFixture[];

function createProvider(name = `permission-${fixtures.length + 1}`) {
  const fixture = createHocuspocusProviderFixture(name);
  const disconnect = vi.spyOn(fixture.provider, 'disconnect').mockImplementation(() => undefined);
  fixtures.push(fixture);
  return { ...fixture, disconnect };
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  fixtures = [];
});

afterEach(() => {
  act(() => root.unmount());
  fixtures.forEach((fixture) => fixture.destroy());
  container.remove();
});

function Probe({
  provider,
  relatedProvider = null,
}: {
  provider: ReturnType<typeof createProvider>;
  relatedProvider?: ReturnType<typeof createProvider> | null;
}) {
  const state = useEditorPermissionRevocation(provider.provider, 'post', 'post-1', relatedProvider?.provider ?? null);
  useEffect(() => {
    container.dataset.revoked = String(state.revoked);
    container.dataset.sessionExpired = String(state.sessionExpired);
    container.dataset.blocked = String(state.blocked);
  }, [state.blocked, state.revoked, state.sessionExpired]);
  return null;
}

describe('useEditorPermissionRevocation', () => {
  it('disconnects and locks on the exact permission revoke signal', () => {
    const provider = createProvider();
    act(() => root.render(<Probe provider={provider} />));

    act(() =>
      provider.emit('stateless', {
        payload: JSON.stringify({ kind: 'permission_revoked', reason: 'permission_revoked' }),
      }),
    );

    expect(provider.disconnect).toHaveBeenCalledOnce();
    expect(container.dataset.revoked).toBe('true');
    expect(container.dataset.blocked).toBe('true');
  });

  it('observes the shared provider and disconnects both Post rooms', () => {
    const shared = createProvider();
    const locale = createProvider();
    act(() => root.render(<Probe provider={shared} relatedProvider={locale} />));

    act(() =>
      shared.emit('stateless', {
        payload: JSON.stringify({ kind: 'permission_revoked', reason: 'permission_revoked' }),
      }),
    );

    expect(shared.disconnect).toHaveBeenCalledOnce();
    expect(locale.disconnect).toHaveBeenCalledOnce();
    expect(container.dataset.revoked).toBe('true');
  });

  it.each(['stateless', 'authenticationFailed'] as const)(
    'disconnects and locks on exact session expiry from %s',
    (source) => {
      const provider = createProvider();
      act(() => root.render(<Probe provider={provider} />));

      act(() => {
        if (source === 'stateless') {
          provider.emit('stateless', {
            payload: JSON.stringify({ kind: 'session_expired', reason: 'session_expired' }),
          });
        } else {
          provider.emit('authenticationFailed', { reason: 'session_expired' });
        }
      });

      expect(provider.disconnect).toHaveBeenCalledOnce();
      expect(container.dataset.sessionExpired).toBe('true');
      expect(container.dataset.revoked).toBe('false');
      expect(container.dataset.blocked).toBe('true');
    },
  );

  it('does not label an ambiguous authentication failure as session expiry', () => {
    const provider = createProvider();
    act(() => root.render(<Probe provider={provider} />));

    act(() => provider.emit('authenticationFailed', { reason: 'Permission denied' }));

    expect(provider.disconnect).not.toHaveBeenCalled();
    expect(container.dataset.blocked).toBe('false');
  });

  it.each(['{', 'null', '[]', '{"kind":"session_expired","reason":1}'])(
    'ignores malformed stateless payload: %s',
    (payload) => {
      const provider = createProvider();
      act(() => root.render(<Probe provider={provider} />));

      act(() => provider.emit('stateless', { payload }));

      expect(provider.disconnect).not.toHaveBeenCalled();
      expect(container.dataset.blocked).toBe('false');
    },
  );

  it.each([
    { kind: 'permission_revoked', reason: 'permission_denied' },
    { kind: 'runtime.error', reason: 'permission_revoked' },
    { kind: 'permission_revoked' },
  ])('ignores non-contract signals: %o', (payload) => {
    const provider = createProvider();
    act(() => root.render(<Probe provider={provider} />));

    act(() =>
      provider.emit('stateless', {
        payload: JSON.stringify(payload),
      }),
    );

    expect(provider.disconnect).not.toHaveBeenCalled();
    expect(container.dataset.revoked).toBe('false');
  });
});
