'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { Editor } from '@tiptap/core';

/** Reacts to `editor.setEditable(...)`, which does not recreate React NodeViews. */
export function useTiptapEditorEditable(editor: Editor): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      editor.on('update', onStoreChange);
      return () => {
        editor.off('update', onStoreChange);
      };
    },
    [editor],
  );
  const getSnapshot = useCallback(() => editor.isEditable, [editor]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
