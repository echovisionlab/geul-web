// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';
import { useEditorPermissionRevocation } from './useEditorPermissionRevocation';

it('upgrades an admitted viewer and locks a later downgrade without remount or interruption', () => {
  const provider = { on: () => undefined, off: () => undefined, disconnect: () => undefined };
  let mounts = 0;
  setProviderAccessLevel(provider, 'view');
  let state: ReturnType<typeof useEditorPermissionRevocation> | null = null;
  function Probe() {
    useEffect(() => {
      mounts += 1;
    }, []);
    state = useEditorPermissionRevocation(provider as never, 'post', 'post-1');
    return null;
  }
  const root = createRoot(document.createElement('div'));
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => root.render(<Probe />));
  expect(state).toMatchObject({ blocked: true, viewOnly: true, interruption: null });
  act(() => setProviderAccessLevel(provider, 'edit'));
  expect(state).toMatchObject({ blocked: false, viewOnly: false, interruption: null });
  act(() => setProviderAccessLevel(provider, 'view'));
  expect(state).toMatchObject({ blocked: true, viewOnly: true, interruption: null, revoked: false });
  expect(mounts).toBe(1);
  act(() => root.unmount());
});
