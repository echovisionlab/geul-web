// @vitest-environment jsdom

import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { createTiptapWireExtensions } from '@/features/editor/tiptap/wire-schema';
import { ArrowConversionExtension } from './ArrowConversionExtension';

function createEditor(content: object) {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: [...createTiptapWireExtensions(), ArrowConversionExtension],
    content,
  });
  return {
    editor,
    destroy: () => {
      editor.destroy();
      element.remove();
    },
  };
}

function typeTextThroughInputRule(editor: Editor, text: string): boolean {
  let handled = false;
  editor.view.someProp('handleTextInput', (handler) => {
    handled =
      handler(editor.view, editor.state.selection.from, editor.state.selection.to, text, () =>
        editor.state.tr.insertText(text),
      ) === true;
    return handled;
  });
  return handled;
}

function moveCursorToBlockTextEnd(editor: Editor) {
  let position = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'paragraph' || node.type.name === 'codeBlock') {
      position = pos + 1 + node.content.size;
      return false;
    }
    return true;
  });
  expect(position).toBeGreaterThanOrEqual(0);
  editor.commands.setTextSelection(position);
}

function oneBlock(type: string, content: object[]) {
  return {
    type: 'doc',
    content: [
      {
        type: 'blockGroup',
        content: [{ type: 'blockContainer', attrs: { id: 'block' }, content: [{ type, content }] }],
      },
    ],
  };
}

describe('ArrowConversionExtension', () => {
  it('converts only a completed arrow pattern in ordinary text', () => {
    const mounted = createEditor(oneBlock('paragraph', [{ type: 'text', text: '-' }]));
    moveCursorToBlockTextEnd(mounted.editor);

    expect(typeTextThroughInputRule(mounted.editor, '>')).toBe(true);
    expect(mounted.editor.state.doc.textContent).toBe('→');
    mounted.destroy();
  });

  it('does not convert incomplete sequences or the <= prefix of <=>', () => {
    const mounted = createEditor(oneBlock('paragraph', [{ type: 'text', text: '<' }]));
    moveCursorToBlockTextEnd(mounted.editor);
    expect(typeTextThroughInputRule(mounted.editor, '=')).toBe(false);
    mounted.editor.view.dispatch(mounted.editor.state.tr.insertText('='));
    expect(typeTextThroughInputRule(mounted.editor, '>')).toBe(true);
    expect(mounted.editor.state.doc.textContent).toBe('⇔');
    mounted.destroy();
  });

  it.each([
    ['codeBlock', [{ type: 'text', text: '>' }]],
    ['paragraph', [{ type: 'text', text: '>', marks: [{ type: 'code' }] }]],
  ])('preserves raw source in %s', (type, content) => {
    const mounted = createEditor(oneBlock(type, content));
    moveCursorToBlockTextEnd(mounted.editor);

    expect(typeTextThroughInputRule(mounted.editor, '-')).toBe(false);
    expect(mounted.editor.state.doc.textContent).toBe('>');
    mounted.destroy();
  });
});
