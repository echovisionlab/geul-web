'use client';

import { useEffect } from 'react';
import { hasPendingEditorSaves, subscribeToEditorSaveState } from './editor-save-registry';

/** Warns before a browser unload while any registered save is still awaiting acknowledgement. */
export function usePendingEditorUnload(document?: string) {
  useEffect(() => {
    const ownerWindow = window;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasPendingEditorSaves(document)) {
        return;
      }
      event.preventDefault();
      event.returnValue = '';
    };
    let listening = false;
    const updateListener = () => {
      const shouldListen = hasPendingEditorSaves(document);
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
