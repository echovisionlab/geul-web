import type { Editor } from '@tiptap/core';

export interface TiptapEditorGeneration {
  current: () => Editor | null;
}

/**
 * Represents one React-owned Tiptap editor generation.
 *
 * Resolve the current editor inside each synchronous operation. React may
 * destroy this generation while deferred collaboration or picker work waits.
 */
export function createTiptapEditorGeneration(editor: Editor): TiptapEditorGeneration {
  return {
    current() {
      return editor.isDestroyed ? null : editor;
    },
  };
}
