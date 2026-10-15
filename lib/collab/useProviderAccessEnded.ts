'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { getProviderAccessEnded, subscribeToCollaborationAccessEnded } from './provider-control-state';

export function useProviderAccessEnded(provider: object | null) {
  const subscribe = useCallback(
    (listener: () => void) =>
      subscribeToCollaborationAccessEnded((_reason, ended) => {
        if (ended === provider) {
          listener();
        }
      }),
    [provider],
  );
  const snapshot = useCallback(() => getProviderAccessEnded(provider), [provider]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
