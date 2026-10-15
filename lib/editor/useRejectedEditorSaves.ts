'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { getRejectedEditorSaves, subscribeToEditorSaveState, type RejectedEditorSave } from './editor-save-registry';

/** Refused edits of one editor document, kept current with the save registry. */
export function useRejectedEditorSaves(document: string | undefined): RejectedEditorSave[] {
  const subscribe = useCallback((listener: () => void) => subscribeToEditorSaveState(document, listener), [document]);
  // A string snapshot keeps useSyncExternalStore stable; the list is rebuilt only when it changes.
  const snapshot = useCallback(
    () =>
      document
        ? JSON.stringify(
            getRejectedEditorSaves(document).map(({ patch, reason, rejectedAt }) => [patch, reason, rejectedAt]),
          )
        : '[]',
    [document],
  );
  const key = useSyncExternalStore(subscribe, snapshot, () => '[]');
  return useMemo(() => (document && key !== '[]' ? getRejectedEditorSaves(document) : []), [document, key]);
}
