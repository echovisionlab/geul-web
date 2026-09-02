// @vitest-environment jsdom

import { Editor, type JSONContent } from '@tiptap/core';
import { Selection, TextSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTiptapWireExtensions } from '../wire-schema';
import {
  BlockMixedSelection,
  createBlockMixedSelectionBetween,
  handleMixedBlockSelection,
} from './block-mixed-selection';

const mounted: Array<{ editor: Editor; element: HTMLElement }> = [];

function block(id: string, content: JSONContent): JSONContent {
  return { type: 'blockContainer', attrs: { id }, content: [content] };
}

function createEditor(afterText = 'After') {
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
            block('before', { type: 'paragraph', content: [{ type: 'text', text: 'Before' }] }),
            block('video', { type: 'externalVideo', attrs: { url: 'https://youtu.be/dQw4w9WgXcQ' } }),
            block('audio-one', { type: 'file' }),
            block('audio-two', { type: 'file' }),
            block('after', {
              type: 'paragraph',
              ...(afterText ? { content: [{ type: 'text', text: afterText }] } : {}),
            }),
          ],
        },
      ],
    },
  });
  mounted.push({ editor, element });
  return editor;
}

function positions(editor: Editor, type: string): number[] {
  const result: number[] = [];
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === type) {
      result.push(position);
    }
  });
  return result;
}

function blockPositions(editor: Editor): Record<string, number> {
  const result: Record<string, number> = {};
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === 'blockContainer' && typeof node.attrs.id === 'string') {
      result[node.attrs.id] = position;
    }
  });
  return result;
}

afterEach(() => {
  for (const value of mounted.splice(0)) {
    value.editor.destroy();
    value.element.remove();
  }
});

describe('mixed text and standalone Block selection', () => {
  it('extends and shrinks through one standalone Block per horizontal keypress', () => {
    const editor = createEditor();
    const [before, after] = positions(editor, 'paragraph');
    const blocks = blockPositions(editor);
    const anchor = before + 2;
    const beforeEnd = before + 1 + 'Before'.length;
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, anchor, beforeEnd)));

    expect(handleMixedBlockSelection(editor, 'right')).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(BlockMixedSelection);
    expect(editor.state.selection).toMatchObject({
      anchor,
      head: blocks.video + editor.state.doc.nodeAt(blocks.video)!.nodeSize,
    });

    expect(handleMixedBlockSelection(editor, 'right')).toBe(true);
    expect(editor.state.selection.head).toBe(
      blocks['audio-one'] + editor.state.doc.nodeAt(blocks['audio-one'])!.nodeSize,
    );

    expect(handleMixedBlockSelection(editor, 'right')).toBe(true);
    expect(editor.state.selection.head).toBe(
      blocks['audio-two'] + editor.state.doc.nodeAt(blocks['audio-two'])!.nodeSize,
    );

    expect(handleMixedBlockSelection(editor, 'right')).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(BlockMixedSelection);
    expect(editor.state.selection).toMatchObject({ anchor, head: after + 2 });
    expect(editor.view.dom.querySelectorAll('[data-node-range-selected="true"]')).toHaveLength(3);
    expect(
      Array.from(editor.view.dom.querySelectorAll('[data-node-range-selected="true"]')).map((node) =>
        node.getAttribute('data-content-type'),
      ),
    ).toEqual(['externalVideo', 'file', 'file']);

    expect(handleMixedBlockSelection(editor, 'left')).toBe(false);
    editor.view.dispatch(editor.state.tr.setSelection(BlockMixedSelection.create(editor.state.doc, anchor, after + 1)));
    expect(handleMixedBlockSelection(editor, 'left')).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(BlockMixedSelection);
    expect(editor.state.selection.head).toBe(
      blocks['audio-one'] + editor.state.doc.nodeAt(blocks['audio-one'])!.nodeSize,
    );
  });

  it('uses the same one-Block boundary for vertical extension at the visual text edge', () => {
    const editor = createEditor();
    const [before] = positions(editor, 'paragraph');
    const blocks = blockPositions(editor);
    const anchor = before + 1;
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, anchor)));
    vi.spyOn(editor.view, 'endOfTextblock').mockReturnValue(true);

    expect(handleMixedBlockSelection(editor, 'down')).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(BlockMixedSelection);
    expect(editor.state.selection).toMatchObject({
      anchor,
      head: blocks.video + editor.state.doc.nodeAt(blocks.video)!.nodeSize,
    });

    expect(handleMixedBlockSelection(editor, 'down')).toBe(true);
    expect(editor.state.selection.head).toBe(
      blocks['audio-one'] + editor.state.doc.nodeAt(blocks['audio-one'])!.nodeSize,
    );
  });

  it('enters the next text Block at its first grapheme without an invisible boundary step', () => {
    const grapheme = '👨‍👩‍👧‍👦';
    const editor = createEditor(`${grapheme}After`);
    const [before, after] = positions(editor, 'paragraph');
    const blocks = blockPositions(editor);
    const anchor = before + 2;
    const audioEnd = blocks['audio-two'] + editor.state.doc.nodeAt(blocks['audio-two'])!.nodeSize;
    editor.view.dispatch(editor.state.tr.setSelection(BlockMixedSelection.create(editor.state.doc, anchor, audioEnd)));

    expect(handleMixedBlockSelection(editor, 'right')).toBe(true);
    expect(editor.state.selection).toMatchObject({ anchor, head: after + 1 + grapheme.length });
  });

  it('keeps an empty Paragraph as a selectable line boundary', () => {
    const editor = createEditor('');
    const [before, after] = positions(editor, 'paragraph');
    const blocks = blockPositions(editor);
    const anchor = before + 2;
    const audioEnd = blocks['audio-two'] + editor.state.doc.nodeAt(blocks['audio-two'])!.nodeSize;
    editor.view.dispatch(editor.state.tr.setSelection(BlockMixedSelection.create(editor.state.doc, anchor, audioEnd)));

    expect(handleMixedBlockSelection(editor, 'right')).toBe(true);
    expect(editor.state.selection).toMatchObject({ anchor, head: after + 1 });
  });

  it('extends and shrinks a backward range through the same standalone Block boundaries', () => {
    const editor = createEditor();
    const [before, after] = positions(editor, 'paragraph');
    const blocks = blockPositions(editor);
    const anchor = after + 1;
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, anchor)));

    expect(handleMixedBlockSelection(editor, 'left')).toBe(true);
    expect(editor.state.selection).toMatchObject({ anchor, head: blocks['audio-two'] });
    expect(handleMixedBlockSelection(editor, 'left')).toBe(true);
    expect(editor.state.selection.head).toBe(blocks['audio-one']);
    expect(handleMixedBlockSelection(editor, 'left')).toBe(true);
    expect(editor.state.selection.head).toBe(blocks.video);
    expect(handleMixedBlockSelection(editor, 'left')).toBe(true);
    expect(editor.state.selection).toMatchObject({ anchor, head: before + 'Before'.length });

    expect(handleMixedBlockSelection(editor, 'right')).toBe(false);
    editor.view.dispatch(
      editor.state.tr.setSelection(BlockMixedSelection.create(editor.state.doc, anchor, before + 1 + 'Before'.length)),
    );
    expect(handleMixedBlockSelection(editor, 'right')).toBe(true);
    expect(editor.state.selection.head).toBe(blocks['audio-one']);
    expect(handleMixedBlockSelection(editor, 'right')).toBe(true);
    expect(editor.state.selection.head).toBe(blocks['audio-two']);
    expect(handleMixedBlockSelection(editor, 'right')).toBe(true);
    expect(editor.state.selection.head).toBe(
      blocks['audio-two'] + editor.state.doc.nodeAt(blocks['audio-two'])!.nodeSize,
    );
    expect(handleMixedBlockSelection(editor, 'right')).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(TextSelection);
    expect(editor.state.selection.empty).toBe(true);
  });

  it('keeps a partial text anchor when a DOM range ends inside a standalone NodeView', () => {
    const editor = createEditor();
    const [before] = positions(editor, 'paragraph');
    const [video] = positions(editor, 'externalVideo');
    const blocks = blockPositions(editor);
    const anchor = editor.state.doc.resolve(before + 3);
    const head = editor.state.doc.resolve(video);

    const selection = createBlockMixedSelectionBetween(editor.view, anchor, head);

    expect(selection).toBeInstanceOf(BlockMixedSelection);
    expect(selection).toMatchObject({
      anchor: anchor.pos,
      head: blocks.video + editor.state.doc.nodeAt(blocks.video)!.nodeSize,
    });
  });

  it('keeps a mouse-shaped text-to-text range mixed when it fully crosses standalone blocks', () => {
    const editor = createEditor();
    const [before, after] = positions(editor, 'paragraph');
    const selection = createBlockMixedSelectionBetween(
      editor.view,
      editor.state.doc.resolve(before + 3),
      editor.state.doc.resolve(after + 2),
    );

    expect(selection).toBeInstanceOf(BlockMixedSelection);
    editor.view.dispatch(editor.state.tr.setSelection(selection!));
    expect(editor.view.dom.querySelectorAll('[data-node-range-selected="true"]')).toHaveLength(3);
  });

  it('maps through document edits and serializes through the registered Selection contract', () => {
    const editor = createEditor();
    const [before] = positions(editor, 'paragraph');
    const blocks = blockPositions(editor);
    const selection = BlockMixedSelection.create(
      editor.state.doc,
      before + 2,
      blocks.video + editor.state.doc.nodeAt(blocks.video)!.nodeSize,
    );
    editor.view.dispatch(editor.state.tr.setSelection(selection));

    editor.view.dispatch(editor.state.tr.insertText('X', before + 1));

    expect(editor.state.selection).toBeInstanceOf(BlockMixedSelection);
    expect(editor.state.selection).toMatchObject({ anchor: before + 3, head: selection.head + 1 });
    expect(Selection.fromJSON(editor.state.doc, editor.state.selection.toJSON())).toEqual(editor.state.selection);
  });

  it('deletes the selected text tail and complete standalone block without leaving an invalid container', () => {
    const editor = createEditor();
    const [before] = positions(editor, 'paragraph');
    const blocks = blockPositions(editor);
    editor.view.dispatch(
      editor.state.tr.setSelection(
        BlockMixedSelection.create(
          editor.state.doc,
          before + 1 + 3,
          blocks.video + editor.state.doc.nodeAt(blocks.video)!.nodeSize,
        ),
      ),
    );

    expect(editor.commands.deleteSelection()).toBe(true);

    expect(editor.getJSON()).toMatchObject({
      content: [
        {
          content: [
            { attrs: { id: 'before' }, content: [{ type: 'paragraph', content: [{ text: 'Bef' }] }] },
            { attrs: { id: 'audio-one' } },
            { attrs: { id: 'audio-two' } },
            { attrs: { id: 'after' } },
          ],
        },
      ],
    });
  });
});
