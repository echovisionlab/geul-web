import { Editor, type Extensions, type JSONContent } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import { describe, expect, it } from 'vitest';
import {
  changeCurrentBlockAlignment,
  insertParagraphAfterSelectedBlock,
  joinCurrentTextBlockBackward,
  moveCurrentBlock,
  resolveNextTextAlignment,
  setCurrentBlockAlignment,
  splitCurrentTextBlock,
} from './block-commands';
import { createTiptapWireExtensions } from './wire-schema';
import { createTiptapTableExtensions } from './table';

const tableNodeNames = new Set(['table', 'tableRow', 'tableCell', 'tableHeader']);

const defaultContent: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'blockGroup',
      content: [
        {
          type: 'blockContainer',
          attrs: { id: 'first' },
          content: [
            {
              type: 'paragraph',
              attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
              content: [{ type: 'text', text: 'first' }],
            },
          ],
        },
        {
          type: 'blockContainer',
          attrs: { id: 'second' },
          content: [
            {
              type: 'paragraph',
              attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'center' },
              content: [{ type: 'text', text: 'second' }],
            },
          ],
        },
      ],
    },
  ],
};

function createEditor(content: JSONContent = defaultContent, extraExtensions: Extensions = []) {
  const editor = new Editor({
    element: null,
    extensions: [
      ...createTiptapWireExtensions().filter((extension) => !tableNodeNames.has(extension.name)),
      ...createTiptapTableExtensions(),
      ...extraExtensions,
    ],
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

function positionsOf(editor: Editor, nodeName: string) {
  const positions: number[] = [];
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === nodeName) {
      positions.push(position);
    }
  });
  return positions;
}

describe('Tiptap block commands without a view', () => {
  it('replaces a selected paragraph range when creating the next block', () => {
    const mounted = createEditor();
    const [paragraph] = positionsOf(mounted.editor, 'paragraph');
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(
        TextSelection.create(mounted.editor.state.doc, paragraph + 2, paragraph + 4),
      ),
    );

    expect(splitCurrentTextBlock(mounted.editor)).toBe(true);
    const group = mounted.editor.state.doc.firstChild;
    expect(group?.child(0).textContent).toBe('f');
    expect(group?.child(1).textContent).toBe('st');
    mounted.destroy();
  });

  it('does not create a Paragraph after a selected Block in read-only mode', () => {
    const mounted = createEditor({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'media' },
              content: [{ type: 'file', attrs: { name: 'attachment.pdf', mimeType: 'application/pdf' } }],
            },
          ],
        },
      ],
    });
    const [file] = positionsOf(mounted.editor, 'file');
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(NodeSelection.create(mounted.editor.state.doc, file)),
    );
    mounted.editor.setEditable(false);
    const before = mounted.editor.state.doc.toJSON();

    expect(insertParagraphAfterSelectedBlock(mounted.editor)).toBe(false);
    expect(mounted.editor.state.doc.toJSON()).toEqual(before);
    mounted.destroy();
  });

  it('joins a non-empty paragraph into the preceding text block without changing that block type or ID', () => {
    const mounted = createEditor({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'heading' },
              content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Hell' }] }],
            },
            {
              type: 'blockContainer',
              attrs: { id: 'paragraph' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'o' }] }],
            },
          ],
        },
      ],
    });
    const [paragraph] = positionsOf(mounted.editor, 'paragraph');
    mounted.editor.commands.setTextSelection(paragraph + 1);

    expect(joinCurrentTextBlockBackward(mounted.editor)).toBe(true);

    const block = mounted.editor.state.doc.firstChild?.firstChild;
    expect(block?.attrs.id).toBe('heading');
    expect(block?.firstChild?.type.name).toBe('heading');
    expect(block?.firstChild?.attrs.level).toBe(2);
    expect(block?.textContent).toBe('Hello');
    expect(mounted.editor.state.selection.$from.parentOffset).toBe(4);
    mounted.destroy();
  });

  it('preserves preceding nested children when removing an empty paragraph boundary', () => {
    const mounted = createEditor({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'parent' },
              content: [
                { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Parent' }] },
                {
                  type: 'blockGroup',
                  content: [
                    {
                      type: 'blockContainer',
                      attrs: { id: 'child' },
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Child' }] }],
                    },
                  ],
                },
              ],
            },
            {
              type: 'blockContainer',
              attrs: { id: 'empty' },
              content: [{ type: 'paragraph' }],
            },
          ],
        },
      ],
    });
    const paragraphs = positionsOf(mounted.editor, 'paragraph');
    mounted.editor.commands.setTextSelection(paragraphs[1] + 1);

    expect(joinCurrentTextBlockBackward(mounted.editor)).toBe(true);

    const parent = mounted.editor.state.doc.firstChild?.firstChild;
    expect(mounted.editor.state.doc.firstChild?.childCount).toBe(1);
    expect(parent?.attrs.id).toBe('parent');
    expect(parent?.childCount).toBe(2);
    expect(parent?.child(1).firstChild?.attrs.id).toBe('child');
    expect(mounted.editor.state.selection.$from.parent.type.name).toBe('heading');
    expect(mounted.editor.state.selection.$from.parentOffset).toBe(6);
    mounted.destroy();
  });

  it('joins a non-empty paragraph block backward without changing the previous block ID', () => {
    const mounted = createEditor();
    const paragraphs = positionsOf(mounted.editor, 'paragraph');
    mounted.editor.commands.setTextSelection(paragraphs[1] + 1);

    expect(joinCurrentTextBlockBackward(mounted.editor)).toBe(true);
    const group = mounted.editor.state.doc.firstChild;
    expect(group?.childCount).toBe(1);
    expect(group?.child(0).attrs.id).toBe('first');
    expect(group?.child(0).textContent).toBe('firstsecond');
    expect(mounted.editor.state.selection.$from.parentOffset).toBe(5);
    mounted.destroy();
  });

  it.each([
    ['left', 'forward', 'center'],
    ['center', 'forward', 'right'],
    ['right', 'forward', 'right'],
    ['right', 'backward', 'center'],
    ['center', 'backward', 'left'],
    ['left', 'backward', 'left'],
    ['justify', 'forward', 'center'],
    [undefined, 'backward', 'left'],
  ] as const)(
    'moves %s alignment %s to %s, clamping at the ends and treating unsupported values as left',
    (current, direction, expected) => {
      expect(resolveNextTextAlignment(current, direction)).toBe(expected);
    },
  );

  it('updates only the selected block content alignment', () => {
    const mounted = createEditor();
    mounted.editor.commands.setTextSelection(3);

    expect(changeCurrentBlockAlignment(mounted.editor, 'forward')).toBe(true);
    const blockGroup = mounted.editor.state.doc.firstChild;
    expect(blockGroup?.child(0).firstChild?.attrs.textAlignment).toBe('center');
    expect(blockGroup?.child(1).firstChild?.attrs.textAlignment).toBe('center');
    mounted.destroy();
  });

  it('aligns every block content intersected by a text selection', () => {
    const mounted = createEditor();
    const paragraphs = positionsOf(mounted.editor, 'paragraph');
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(
        TextSelection.create(mounted.editor.state.doc, paragraphs[0] + 1, paragraphs[1] + 2),
      ),
    );

    expect(setCurrentBlockAlignment(mounted.editor, 'right')).toBe(true);
    expect(
      Array.from(
        { length: 2 },
        (_, index) => mounted.editor.state.doc.firstChild?.child(index).firstChild?.attrs.textAlignment,
      ),
    ).toEqual(['right', 'right']);
    mounted.destroy();
  });

  it('resolves both content and block-container node selections', () => {
    const mounted = createEditor();
    const [firstBlock] = positionsOf(mounted.editor, 'blockContainer');
    const [firstParagraph] = positionsOf(mounted.editor, 'paragraph');

    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(NodeSelection.create(mounted.editor.state.doc, firstParagraph)),
    );
    expect(setCurrentBlockAlignment(mounted.editor, 'center')).toBe(true);

    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(NodeSelection.create(mounted.editor.state.doc, firstBlock)),
    );
    expect(moveCurrentBlock(mounted.editor, 'down')).toBe(true);
    expect(mounted.editor.state.selection).toBeInstanceOf(NodeSelection);
    expect((mounted.editor.state.selection as NodeSelection).node.type.name).toBe('blockContainer');
    expect(mounted.editor.state.doc.firstChild?.child(1).attrs.id).toBe('first');
    mounted.destroy();
  });

  it('aligns all cells in a cell selection without changing their containing block ID', () => {
    const mounted = createEditor({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'table-block' },
              content: [
                {
                  type: 'table',
                  content: [
                    {
                      type: 'tableRow',
                      content: [
                        {
                          type: 'tableCell',
                          content: [{ type: 'tableParagraph', content: [{ type: 'text', text: 'one' }] }],
                        },
                        {
                          type: 'tableCell',
                          content: [{ type: 'tableParagraph', content: [{ type: 'text', text: 'two' }] }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const cells = positionsOf(mounted.editor, 'tableCell');
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(CellSelection.create(mounted.editor.state.doc, cells[0], cells[1])),
    );

    expect(setCurrentBlockAlignment(mounted.editor, 'right')).toBe(true);
    expect(
      positionsOf(mounted.editor, 'tableCell').map(
        (position) => mounted.editor.state.doc.nodeAt(position)?.attrs.textAlignment,
      ),
    ).toEqual(['right', 'right']);
    expect(mounted.editor.state.doc.firstChild?.firstChild?.attrs.id).toBe('table-block');
    expect(moveCurrentBlock(mounted.editor, 'down')).toBe(false);
    mounted.destroy();
  });

  it('aligns the current table cell from a text cursor', () => {
    const mounted = createEditor({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'table-block' },
              content: [
                {
                  type: 'table',
                  content: [
                    {
                      type: 'tableRow',
                      content: [
                        {
                          type: 'tableCell',
                          content: [{ type: 'tableParagraph', content: [{ type: 'text', text: 'one' }] }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const [paragraph] = positionsOf(mounted.editor, 'tableParagraph');
    mounted.editor.commands.setTextSelection(paragraph + 1);

    expect(changeCurrentBlockAlignment(mounted.editor, 'forward')).toBe(true);
    const [cell] = positionsOf(mounted.editor, 'tableCell');
    expect(mounted.editor.state.doc.nodeAt(cell)?.attrs.textAlignment).toBe('center');
    mounted.destroy();
  });

  it('returns false without mutation when selected content does not support alignment', () => {
    const mounted = createEditor({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'quote' },
              content: [{ type: 'quote', content: [{ type: 'text', text: 'quote' }] }],
            },
          ],
        },
      ],
    });
    const before = mounted.editor.state.doc;
    mounted.editor.commands.setTextSelection(3);

    expect(setCurrentBlockAlignment(mounted.editor, 'right')).toBe(false);
    expect(mounted.editor.state.doc.eq(before)).toBe(true);
    mounted.destroy();
  });

  it('moves the current block among its siblings and stops at the group boundary', () => {
    const mounted = createEditor();
    mounted.editor.commands.setTextSelection(3);

    expect(moveCurrentBlock(mounted.editor, 'up')).toBe(false);
    expect(moveCurrentBlock(mounted.editor, 'down')).toBe(true);
    const blockGroup = mounted.editor.state.doc.firstChild;
    expect([blockGroup?.child(0).attrs.id, blockGroup?.child(1).attrs.id]).toEqual(['second', 'first']);
    expect(moveCurrentBlock(mounted.editor, 'down')).toBe(false);
    mounted.destroy();
  });

  it('moves a nested block only within its own block group', () => {
    const mounted = createEditor({
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'parent' },
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'parent' }] },
                {
                  type: 'blockGroup',
                  content: [
                    {
                      type: 'blockContainer',
                      attrs: { id: 'nested-first' },
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'nested first' }] }],
                    },
                    {
                      type: 'blockContainer',
                      attrs: { id: 'nested-second' },
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'nested second' }] }],
                    },
                  ],
                },
              ],
            },
            {
              type: 'blockContainer',
              attrs: { id: 'outer-sibling' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'outer' }] }],
            },
          ],
        },
      ],
    });
    const nestedSecond = positionsOf(mounted.editor, 'blockContainer').find(
      (position) => mounted.editor.state.doc.nodeAt(position)?.attrs.id === 'nested-second',
    );
    expect(nestedSecond).toBeTypeOf('number');
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(NodeSelection.create(mounted.editor.state.doc, nestedSecond!)),
    );

    expect(moveCurrentBlock(mounted.editor, 'up')).toBe(true);
    const outerGroup = mounted.editor.state.doc.firstChild;
    const nestedGroup = outerGroup?.child(0).child(1);
    expect([nestedGroup?.child(0).attrs.id, nestedGroup?.child(1).attrs.id]).toEqual(['nested-second', 'nested-first']);
    expect([outerGroup?.child(0).attrs.id, outerGroup?.child(1).attrs.id]).toEqual(['parent', 'outer-sibling']);
    mounted.destroy();
  });
});
