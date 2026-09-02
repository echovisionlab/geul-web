import type { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { createTiptapEditorGeneration } from './editor-generation';

describe('createTiptapEditorGeneration', () => {
  it('stops resolving its editor after that generation is destroyed', () => {
    let destroyed = false;
    const editor = {
      get isDestroyed() {
        return destroyed;
      },
    } as Editor;
    const generation = createTiptapEditorGeneration(editor);

    expect(generation.current()).toBe(editor);
    destroyed = true;
    expect(generation.current()).toBeNull();
  });
});
