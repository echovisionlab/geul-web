'use client';

import { useCallback } from 'react';

/**
 * Builds the Map Theme reload handler for the guarded collaboration callback.
 * The connection validates that the signal belongs to a canonical map-theme room
 * before invoking this handler.
 */
export function useMapThemeReloadRequired(stagePendingIntents: () => void) {
  return useCallback(
    (reloadCanonical: () => boolean) => {
      stagePendingIntents();
      return reloadCanonical();
    },
    [stagePendingIntents],
  );
}
