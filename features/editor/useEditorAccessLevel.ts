'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { AccessLevel } from '@echovisionlab/geul-common/collaboration/protocol';
import { getProviderAccessLevel, subscribeToProviderAccessLevel } from '@/lib/collab/provider-control-state';

/**
 * The open room's access level. `view` means the editor was downgraded while the page stayed open
 * (Notion keeps such a page readable): every edit control must stop accepting input.
 */
export function useEditorAccessLevel(...providers: Array<object | null | undefined>): AccessLevel {
  const subscribe = useCallback((listener: () => void) => subscribeToProviderAccessLevel(() => listener()), []);
  const snapshot = () => (providers.some((provider) => getProviderAccessLevel(provider) === 'view') ? 'view' : 'edit');
  return useSyncExternalStore(subscribe, snapshot, () => 'edit');
}
