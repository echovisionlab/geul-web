// @vitest-environment jsdom

import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { prosemirrorJSONToYXmlFragment } from 'y-prosemirror';
import { createTiptapEditorMediaCommandPort } from './media-block-updates';
import { insertMirroredBlockAtPosition } from './block-insert';
import { createTiptapWireExtensions } from '../tiptap/wire-schema';
import { createCollaborationExtension } from '../tiptap/collaboration';

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

function createCollaborativeEditor(element: HTMLElement, fragment: Y.XmlFragment) {
  return new Editor({
    element,
    extensions: [...createTiptapWireExtensions(), createCollaborationExtension({ fragment })],
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

  it('resolves an async insert after its anchor was concurrently deleted', () => {
    const anchorId = crypto.randomUUID();
    const yDoc = new Y.Doc();
    const fragment = yDoc.getXmlFragment('document-store');
    const schemaEditorElement = document.createElement('div');
    document.body.append(schemaEditorElement);
    elements.push(schemaEditorElement);
    const schemaEditor = createEditor(schemaEditorElement, anchorId);
    prosemirrorJSONToYXmlFragment(schemaEditor.schema, schemaEditor.getJSON(), fragment);
    schemaEditor.destroy();

    const firstElement = document.createElement('div');
    const secondElement = document.createElement('div');
    document.body.append(firstElement, secondElement);
    elements.push(firstElement, secondElement);
    const first = createCollaborativeEditor(firstElement, fragment);
    const second = createCollaborativeEditor(secondElement, fragment);
    const firstPort = createTiptapEditorMediaCommandPort(first);
    const secondPort = createTiptapEditorMediaCommandPort(second);
    const savedPosition = firstPort.captureInsertPosition(anchorId);

    expect(savedPosition?.encodedRelativePosition).toBeInstanceOf(Uint8Array);
    expect(secondPort.deleteBlock(anchorId)).toBe(true);
    const result = firstPort.insertBlock(
      {
        id: crypto.randomUUID(),
        type: 'file',
        props: {
          fileId: crypto.randomUUID(),
          name: 'Verified file',
          alt: '',
          caption: '',
          width: '0',
          height: '0',
          previewWidth: '100',
          textAlignment: 'left',
        },
      },
      savedPosition,
    );

    expect(result).toMatchObject({ ok: true });
    first.destroy();
    second.destroy();
    yDoc.destroy();
  });
});
