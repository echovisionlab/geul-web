// @vitest-environment jsdom

import { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import { createTiptapWireExtensions } from '../wire-schema';
import { createAuthoringShortcutGuard, openCurrentBlockMenu } from './authoring-shortcuts';

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
  it.each(['F10', 'ContextMenu'])(
    'opens the current block menu with %s without mutating source or selection',
    (key) => {
      const { editor, positions } = createEditor();
      const position = positions.get('paragraph')!;
      editor.commands.setTextSelection(position + 2);
      const blockDom = editor.view.nodeDOM(position) as HTMLElement;
      const handle = document.createElement('button');
      handle.dataset.testid = 'tiptap-block-drag-handle';
      handle.dataset.dragHandle = '';
      handle.tabIndex = -1;
      handle.contentEditable = 'false';
      blockDom.prepend(handle);
      const open = vi.fn();
      handle.addEventListener('click', open);
      const selection = editor.state.selection.toJSON();
      const content = editor.state.doc.toJSON();
      const event = new KeyboardEvent('keydown', { key, shiftKey: key === 'F10', bubbles: true, cancelable: true });
      editor.view.dom.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(handle).toHaveFocus();
      expect(open).toHaveBeenCalledOnce();
      expect(editor.state.selection.toJSON()).toEqual(selection);
      expect(editor.state.doc.toJSON()).toEqual(content);
    },
  );

  it('does not claim an unavailable block menu or an editor that is read-only', () => {
    const { editor, positions } = createEditor();
    editor.commands.setTextSelection(positions.get('paragraph')! + 2);
    expect(openCurrentBlockMenu(editor)).toBe(false);
    editor.setEditable(false);
    expect(openCurrentBlockMenu(editor)).toBe(false);
  });

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
