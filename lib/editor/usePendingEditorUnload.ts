'use client';

import { useEffect } from 'react';
import {
  hasParkedEditsAtRisk,
  hasPendingEditorSaves,
  hasRejectedEditorSaves,
  subscribeToEditorSaveState,
} from './editor-save-registry';

let unloadGuardSuspended = false;

/**
 * Lets this page unload without the unsaved-edits prompt: the caller has made every unsaved edit
 * durable (journals and tab backups) or the editor chose to discard them. Lasts for the page.
 */
export function suspendEditorUnloadGuard(): void {
  unloadGuardSuspended = true;
}

/** Warns before a browser unload while any registered save awaits acknowledgement or review. */
export function usePendingEditorUnload(document?: string) {
  useEffect(() => {
    const ownerWindow = window;
    const hasUnsaved = () =>
      hasPendingEditorSaves(document) || hasRejectedEditorSaves(document) || hasParkedEditsAtRisk(document);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (unloadGuardSuspended || !hasUnsaved()) {
        return;
      }
      event.preventDefault();
      event.returnValue = '';
    };
    let listening = false;
    const updateListener = () => {
      const shouldListen = hasUnsaved();
      if (shouldListen === listening) {
        return;
      }
      listening = shouldListen;
      if (listening) {
        ownerWindow.addEventListener('beforeunload', beforeUnload);
      } else {
        ownerWindow.removeEventListener('beforeunload', beforeUnload);
      }
    };

    updateListener();
    const unsubscribe = subscribeToEditorSaveState(document, updateListener);
    return () => {
      unsubscribe();
      if (listening) {
        ownerWindow.removeEventListener('beforeunload', beforeUnload);
      }
    };
  }, [document]);
}
