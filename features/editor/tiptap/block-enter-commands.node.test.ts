import { Editor, type JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { splitCurrentTextBlock } from './block-commands';
import { createTiptapWireExtensions } from './wire-schema';

function container(id: string, content: JSONContent, children?: JSONContent): JSONContent {
  return {
    type: 'blockContainer',
    attrs: { id },
    content: children ? [content, children] : [content],
  };
}

function documentWith(...blocks: JSONContent[]): JSONContent {
  return { type: 'doc', content: [{ type: 'blockGroup', content: blocks }] };
}

function mount(content: JSONContent) {
  const editor = new Editor({
    element: null,
    extensions: createTiptapWireExtensions(),
    content,
  });
  editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
  return {
    editor,
    destroy() {
      editor.destroy();
    },
  };
}

function nodePosition(editor: Editor, nodeName: string): number {
  let result = -1;
  editor.state.doc.descendants((node, position) => {
    if (result < 0 && node.type.name === nodeName) {
      result = position;
    }
  });
  return result;
}

function placeCursorAtEnd(editor: Editor, nodeName: string, text: string): void {
  editor.commands.setTextSelection(nodePosition(editor, nodeName) + text.length + 1);
}

describe('Tiptap text-block split commands without a view', () => {
  it.each([
    ['bulletListItem', {}, {}],
    ['numberedListItem', { start: 3 }, { start: 4 }],
    ['checkListItem', { checked: true }, { checked: false }],
  ])('continues a non-empty %s with a new item', (type, attrs, expectedNextAttrs) => {
    const mounted = mount(
      documentWith(
        container('list-item', {
          type,
          attrs,
          content: [{ type: 'text', text: 'Item' }],
        }),
      ),
    );
    placeCursorAtEnd(mounted.editor, type, 'Item');

    expect(splitCurrentTextBlock(mounted.editor)).toBe(true);

    const group = mounted.editor.state.doc.firstChild;
    expect(group?.child(0).attrs.id).toBe('list-item');
    expect(group?.child(1).attrs.id).not.toBe('list-item');
    expect(group?.child(1).firstChild?.type.name).toBe(type);
    expect(group?.child(1).firstChild?.attrs).toMatchObject(expectedNextAttrs);
    mounted.destroy();
  });

  it.each(['heading', 'quote', 'callout', 'bulletListItem', 'numberedListItem', 'checkListItem'])(
    'exits an empty %s to a paragraph without changing its block ID',
    (type) => {
      const mounted = mount(documentWith(container('empty-text-block', { type })));
      mounted.editor.commands.setTextSelection(nodePosition(mounted.editor, type) + 1);

      expect(splitCurrentTextBlock(mounted.editor)).toBe(true);

      const group = mounted.editor.state.doc.firstChild;
      expect(group?.childCount).toBe(1);
      expect(group?.child(0).attrs.id).toBe('empty-text-block');
      expect(group?.child(0).firstChild?.type.name).toBe('paragraph');
      mounted.destroy();
    },
  );

  it('continues a quote as a paragraph', () => {
    const mounted = mount(
      documentWith(
        container('quote', {
          type: 'quote',
          content: [{ type: 'text', text: 'Quoted' }],
        }),
      ),
    );
    placeCursorAtEnd(mounted.editor, 'quote', 'Quoted');

    expect(splitCurrentTextBlock(mounted.editor)).toBe(true);

    const group = mounted.editor.state.doc.firstChild;
    expect(group?.child(0).firstChild?.type.name).toBe('quote');
    expect(group?.child(1).firstChild?.type.name).toBe('paragraph');
    mounted.destroy();
  });

  it('keeps nested children attached to the original block when its text is split', () => {
    const childGroup: JSONContent = {
      type: 'blockGroup',
      content: [container('child', { type: 'paragraph', content: [{ type: 'text', text: 'Child' }] })],
    };
    const mounted = mount(
      documentWith(
        container('parent', { type: 'bulletListItem', content: [{ type: 'text', text: 'Parent' }] }, childGroup),
      ),
    );
    placeCursorAtEnd(mounted.editor, 'bulletListItem', 'Parent');

    expect(splitCurrentTextBlock(mounted.editor)).toBe(true);

    const group = mounted.editor.state.doc.firstChild;
    expect(group?.child(0).child(1).firstChild?.attrs.id).toBe('child');
    expect(group?.child(1).childCount).toBe(1);
    mounted.destroy();
  });
});
