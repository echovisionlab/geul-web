// @vitest-environment jsdom

import { Editor } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it } from 'vitest';
import { createTiptapWireExtensions } from '../wire-schema';
import { resolveTiptapAIContext } from './tiptap-ai';

const editors: Editor[] = [];
const elements: HTMLDivElement[] = [];

function block(id: string, content: Record<string, unknown>) {
  return { type: 'blockContainer', attrs: { id }, content: [content] };
}

function createEditor() {
  const element = document.createElement('div');
  document.body.append(element);
  elements.push(element);
  const editor = new Editor({
    element,
    extensions: createTiptapWireExtensions(),
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            block('one', {
              type: 'paragraph',
              attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
              content: [{ type: 'text', text: 'First selected paragraph' }],
            }),
            block('two', {
              type: 'heading',
              attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left', level: 2 },
              content: [{ type: 'text', text: 'Second heading' }],
            }),
            block('media', { type: 'file' }),
          ],
        },
      ],
    },
  });
  editors.push(editor);
  return editor;
}

function position(editor: Editor, id: string): number {
  let result = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'blockContainer' && node.attrs.id === id) {
      result = pos;
    }
  });
  if (result < 0) {
    throw new Error(`Missing ${id}`);
  }
  return result;
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  elements.splice(0).forEach((element) => element.remove());
});

describe('Tiptap AI DCDP context', () => {
  it('exposes only stable Block handles for a text selection', () => {
    const editor = createEditor();
    const first = position(editor, 'one');
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, first + 2, first + 7)));

    const context = resolveTiptapAIContext(editor);

    expect(context).toMatchObject({
      isSupported: true,
      mode: 'modify',
      currentBlockId: 'one',
      selectedBlockIds: ['one'],
    });
    expect(context).not.toHaveProperty('selectedHtml');
    expect(context).not.toHaveProperty('sourceBlocksHtml');
    expect(context).not.toHaveProperty('selection');
  });

  it('uses the active Block handle for generation without serializing document content', () => {
    const editor = createEditor();
    const first = position(editor, 'one');
    editor.commands.setTextSelection(first + 2);

    expect(resolveTiptapAIContext(editor)).toMatchObject({
      isSupported: true,
      mode: 'generate',
      currentBlockId: 'one',
      selectedBlockIds: [],
    });
  });

  it('refuses a selection that includes an unsupported file block', () => {
    const editor = createEditor();
    const file = position(editor, 'media');
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, file + 1)));

    expect(resolveTiptapAIContext(editor).isSupported).toBe(false);
  });

  it('refuses non-editable Tiptap state before opening the menu', () => {
    const editor = createEditor();
    editor.setEditable(false);

    expect(resolveTiptapAIContext(editor).isSupported).toBe(false);
  });
});
