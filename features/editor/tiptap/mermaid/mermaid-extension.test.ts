// @vitest-environment jsdom

import { Editor } from '@tiptap/core';
import { UndoRedo } from '@tiptap/extensions';
import { describe, expect, it } from 'vitest';
import { TranslationStructureLockExtension } from '@/lib/editor/extensions/TranslationStructureLockExtension';
import { createTiptapWireExtensions } from '../wire-schema';
import { replaceExecutableSource } from '../executable-source';
import { focusParagraphAfterSelectedBlock } from '../block-commands';
import { createMermaidExtension } from './mermaid-extension';

function mount(translation = false) {
  return new Editor({
    element: document.createElement('div'),
    extensions: [
      ...createTiptapWireExtensions(),
      UndoRedo,
      createMermaidExtension({
        authoringMode: { allowNeutralBlockEdits: !translation, allowLocalizedBlockEdits: true },
      }),
      ...(translation ? [TranslationStructureLockExtension] : []),
    ],
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'diagram' },
              content: [
                {
                  type: 'mermaid',
                  attrs: { title: 'Caption' },
                  content: [{ type: 'text', text: 'flowchart LR\n A --> B' }],
                },
              ],
            },
          ],
        },
      ],
    },
  });
}

describe('Mermaid authoring', () => {
  it('retains source text across undo/redo and HTML round-trip', () => {
    const editor = mount();
    const node = editor.state.doc.nodeAt(2)!;
    replaceExecutableSource({ editor, node, getPos: () => 2 }, 'flowchart LR\n A --> C');
    expect(editor.state.doc.nodeAt(2)?.textContent).toContain('A --> C');
    editor.commands.undo();
    expect(editor.state.doc.nodeAt(2)?.textContent).toContain('A --> B');
    editor.commands.redo();
    const html = editor.getHTML();
    editor.commands.setContent(html);
    expect(editor.state.doc.nodeAt(2)?.textContent).toBe('flowchart LR\n A --> C');
    expect(editor.state.doc.nodeAt(2)?.attrs.title).toBe('Caption');
    editor.destroy();
  });

  it('blocks source mutations and insertion for a translator while allowing the caption', () => {
    const editor = mount(true);
    editor.view.dispatch(editor.state.tr.insertText('changed', 3));
    expect(editor.state.doc.nodeAt(2)?.textContent).toBe('flowchart LR\n A --> B');
    expect(editor.commands.insertMermaid()).toBe(false);
    editor.view.dispatch(editor.state.tr.setNodeMarkup(2, undefined, { title: '번역' }));
    expect(editor.state.doc.nodeAt(2)?.attrs.title).toBe('번역');
    editor.destroy();
  });

  it('continues after the final diagram in one new paragraph and reuses it on the next exit', () => {
    const editor = mount();
    editor.commands.setNodeSelection(2);
    expect(focusParagraphAfterSelectedBlock(editor, true)).toBe(true);
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph');
    editor.commands.insertContent('Following text');
    const documentBefore = editor.getJSON();
    editor.commands.setNodeSelection(2);
    expect(focusParagraphAfterSelectedBlock(editor, true)).toBe(true);
    expect(editor.getJSON()).toEqual(documentBefore);
    expect(editor.state.selection.$from.parent.textContent).toBe('Following text');
    expect(editor.state.selection.$from.parentOffset).toBe(0);
    editor.destroy();
  });

  it('does not create a paragraph for an author without structural permission', () => {
    const editor = mount(true);
    editor.commands.setNodeSelection(2);
    const documentBefore = editor.getJSON();
    expect(focusParagraphAfterSelectedBlock(editor, false)).toBe(false);
    expect(editor.getJSON()).toEqual(documentBefore);
    editor.destroy();
  });

  it('blocks insertion when the editor is read-only', () => {
    const editor = mount();
    editor.setEditable(false);
    expect(editor.commands.insertMermaid()).toBe(false);
    editor.destroy();
  });
});
