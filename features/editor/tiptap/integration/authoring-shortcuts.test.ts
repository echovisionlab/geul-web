// @vitest-environment jsdom

import { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it } from 'vitest';
import type { EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import { createTiptapWireExtensions } from '../wire-schema';
import { createAuthoringShortcutGuard } from './authoring-shortcuts';

const mounted: Array<{ editor: Editor; element: HTMLElement }> = [];
const neutralMode: EditorAuthoringMode = {
  allowLocalizedBlockEdits: true,
  allowNeutralBlockEdits: true,
};

function createEditor() {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: [...createTiptapWireExtensions(), createAuthoringShortcutGuard(neutralMode)],
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'code' },
              content: [
                {
                  type: 'codeBlock',
                  attrs: { language: 'typescript', previewWidth: '64', textAlignment: 'right' },
                  content: [{ type: 'text', text: 'const code = true;' }],
                },
              ],
            },
            {
              type: 'blockContainer',
              attrs: { id: 'paragraph' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Paragraph' }] }],
            },
            {
              type: 'blockContainer',
              attrs: { id: 'after' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'After' }] }],
            },
          ],
        },
      ],
    },
  });
  mounted.push({ editor, element });
  const positions = new Map<string, number>();
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === 'blockContainer' && typeof node.attrs.id === 'string') {
      positions.set(node.attrs.id, position);
    }
  });
  return { editor, positions };
}

function pressMoveDown(editor: Editor) {
  const event = new KeyboardEvent('keydown', {
    key: 'ArrowDown',
    altKey: true,
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  editor.view.dom.dispatchEvent(event);
  return event;
}

afterEach(() => {
  for (const { editor, element } of mounted.splice(0)) {
    editor.destroy();
    element.remove();
  }
});

describe('authoring shortcut neutral structure guard', () => {
  it('consumes Code NodeSelection move without changing its locale document', () => {
    const { editor, positions } = createEditor();
    const codePosition = (positions.get('code') ?? -1) + 1;
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, codePosition)));
    const before = editor.state.doc.toJSON();

    const event = pressMoveDown(editor);

    expect(event.defaultPrevented).toBe(true);
    expect(editor.state.doc.toJSON()).toEqual(before);
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect(editor.state.selection.from).toBe(codePosition);
  });

  it('keeps the existing neutral move behavior for a non-Code block', () => {
    const { editor, positions } = createEditor();
    const paragraphPosition = positions.get('paragraph') ?? -1;
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, paragraphPosition)));

    const event = pressMoveDown(editor);

    expect(event.defaultPrevented).toBe(true);
    expect(editor.state.doc.textContent).toBe('const code = true;AfterParagraph');
  });
});
