// @vitest-environment jsdom

import { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import { createTiptapWireExtensions } from '../wire-schema';

function mountEditor() {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
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
              attrs: { id: '10000000-0000-4000-8000-000000000001' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Before' }] }],
            },
            {
              type: 'blockContainer',
              attrs: { id: '10000000-0000-4000-8000-000000000002' },
              content: [{ type: 'paragraph' }],
            },
            {
              type: 'blockContainer',
              attrs: { id: '10000000-0000-4000-8000-000000000003' },
              content: [{ type: 'paragraph' }],
            },
            {
              type: 'blockContainer',
              attrs: { id: '10000000-0000-4000-8000-000000000004' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'After' }] }],
            },
          ],
        },
      ],
    },
  });
  return {
    editor,
    element,
    destroy() {
      editor.destroy();
      element.remove();
    },
  };
}

function paragraphContentPositions(editor: Editor): number[] {
  const positions: number[] = [];
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === 'paragraph') {
      positions.push(position + 1);
    }
  });
  return positions;
}

function selectedEmptyParagraphs(element: HTMLElement): HTMLElement[] {
  return Array.from(element.querySelectorAll<HTMLElement>('[data-empty-paragraph-range-selected="true"]'));
}

describe('empty Paragraph range selection', () => {
  it('marks every empty Paragraph crossed by a forward multi-block TextSelection', () => {
    const mounted = mountEditor();
    const [before, , , after] = paragraphContentPositions(mounted.editor);

    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(TextSelection.create(mounted.editor.state.doc, before + 2, after + 2)),
    );

    expect(selectedEmptyParagraphs(mounted.element)).toHaveLength(2);
    mounted.destroy();
  });

  it('keeps the same empty-line markers when Shift selection is extended backward', () => {
    const mounted = mountEditor();
    const [before, , , after] = paragraphContentPositions(mounted.editor);

    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(TextSelection.create(mounted.editor.state.doc, after + 2, before + 2)),
    );

    expect(selectedEmptyParagraphs(mounted.element)).toHaveLength(2);
    mounted.destroy();
  });

  it('does not paint an empty Paragraph for a collapsed caret', () => {
    const mounted = mountEditor();
    const [, empty] = paragraphContentPositions(mounted.editor);

    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(TextSelection.create(mounted.editor.state.doc, empty)),
    );

    expect(selectedEmptyParagraphs(mounted.element)).toHaveLength(0);
    mounted.destroy();
  });
});
