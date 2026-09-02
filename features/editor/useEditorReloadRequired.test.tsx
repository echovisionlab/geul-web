// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { createHocuspocusProviderFixture, type HocuspocusProviderFixture } from './hocuspocusProvider.test-fixture';
import { useEditorReloadRequired } from './useEditorReloadRequired';

let container: HTMLDivElement;
let root: Root;
let latest: ReturnType<typeof useEditorReloadRequired> | null = null;
let fixtures: HocuspocusProviderFixture[];

function providerFixture(name = `reload-${fixtures.length + 1}`) {
  const fixture = createHocuspocusProviderFixture(name);
  const disconnect = vi.spyOn(fixture.provider, 'disconnect').mockImplementation(() => undefined);
  fixtures.push(fixture);
  return { ...fixture, disconnect };
}

function Reader({
  provider,
  relatedProvider = null,
}: {
  provider: HocuspocusProvider;
  relatedProvider?: HocuspocusProvider | null;
}) {
  const value = useEditorReloadRequired(provider, relatedProvider);
  useEffect(() => {
    latest = value;
  }, [value]);
  return null;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  latest = null;
  fixtures = [];
});

afterEach(() => {
  act(() => root.unmount());
  fixtures.forEach((fixture) => fixture.destroy());
  container.remove();
});

describe('useEditorReloadRequired', () => {
  it('blocks and disconnects only for the exact reload-required signal', () => {
    const fixture = providerFixture();
    act(() => root.render(<Reader provider={fixture.provider} />));

    act(() =>
      fixture.emit('stateless', {
        payload: JSON.stringify({ kind: 'reload_required' }),
      }),
    );
    expect(latest?.reloadRequired).toBe(false);

    act(() =>
      fixture.emit('stateless', {
        payload: JSON.stringify({ kind: 'reload_required', reason: 'reload_required' }),
      }),
    );
    expect(latest?.reloadRequired).toBe(true);
    expect(fixture.provider.disconnect).toHaveBeenCalledOnce();
  });

  it('listens to the shared provider while a locale provider is active and disconnects both', () => {
    const shared = providerFixture();
    const locale = providerFixture();
    act(() => root.render(<Reader provider={shared.provider} relatedProvider={locale.provider} />));

    act(() =>
      shared.emit('stateless', {
        payload: JSON.stringify({ kind: 'reload_required', reason: 'reload_required' }),
      }),
    );

    expect(latest?.reloadRequired).toBe(true);
    expect(shared.provider.disconnect).toHaveBeenCalledOnce();
    expect(locale.provider.disconnect).toHaveBeenCalledOnce();
  });

  it.each(['{', 'null', '[]', '{"kind":"reload_required","reason":false}'])(
    'ignores malformed stateless payload: %s',
    (payload) => {
      const fixture = providerFixture();
      act(() => root.render(<Reader provider={fixture.provider} />));

      act(() => fixture.emit('stateless', { payload }));

      expect(latest?.reloadRequired).toBe(false);
      expect(fixture.provider.disconnect).not.toHaveBeenCalled();
    },
  );
});
