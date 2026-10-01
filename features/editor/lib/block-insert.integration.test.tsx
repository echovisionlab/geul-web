// @vitest-environment jsdom

import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createTiptapEditorMediaCommandPort } from './media-block-updates';
import { insertMirroredBlockAtPosition } from './block-insert';
import { createTiptapWireExtensions } from '../tiptap/wire-schema';

function createEditor(element: HTMLElement, id: string) {
  return new Editor({
    element,
    extensions: createTiptapWireExtensions(),
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'anchor' }] }],
            },
          ],
        },
      ],
    },
  });
}

describe('insertMirroredBlockAtPosition with Tiptap ports', () => {
  const elements: HTMLElement[] = [];

  afterEach(() => {
    elements.splice(0).forEach((element) => element.remove());
  });

  it('writes the exact file block ID to both editor documents', () => {
    const localizedElement = document.createElement('div');
    const sharedElement = document.createElement('div');
    document.body.append(localizedElement, sharedElement);
    elements.push(localizedElement, sharedElement);
    const localizedEditor = createEditor(localizedElement, 'anchor');
    const sharedEditor = createEditor(sharedElement, 'anchor');
    const pendingBlock = {
      type: 'file' as const,
      props: {
        fileId: crypto.randomUUID(),
        name: 'Field recording',
        alt: '',
        caption: '',
        width: '0',
        height: '0',
        previewWidth: '100',
        textAlignment: 'left',
      },
    };

    const result = insertMirroredBlockAtPosition(
      createTiptapEditorMediaCommandPort(localizedEditor),
      createTiptapEditorMediaCommandPort(sharedEditor),
      pendingBlock,
      { referenceBlockId: 'anchor' },
    );

    expect(result).toEqual({ ok: true, blockId: expect.any(String) });
    if (!result.ok) {
      throw new Error('expected mirrored insertion to succeed');
    }
    expect(createTiptapEditorMediaCommandPort(localizedEditor).getBlock(result.blockId)).toMatchObject({
      id: result.blockId,
      type: 'file',
    });
    expect(createTiptapEditorMediaCommandPort(sharedEditor).getBlock(result.blockId)).toMatchObject({
      id: result.blockId,
      type: 'file',
    });
    localizedEditor.destroy();
    sharedEditor.destroy();
  });
});
