// @vitest-environment jsdom

import { Editor, type JSONContent } from '@tiptap/core';
import { NodeSelection, Plugin, TextSelection } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTiptapTableExtensions } from '../table';
import { createTiptapWireExtensions } from '../wire-schema';
import { BlockBoundaryNavigation, handleBlockBoundaryArrow } from './block-boundary-navigation';

const tableNodeNames = new Set(['table', 'tableRow', 'tableCell', 'tableHeader']);
const mounted: Array<{ editor: Editor; element: HTMLElement }> = [];

function block(id: string, content: JSONContent): JSONContent {
  return { type: 'blockContainer', attrs: { id }, content: [content] };
}

function createEditor(blocks: JSONContent[]) {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: [
      ...createTiptapWireExtensions().filter((extension) => !tableNodeNames.has(extension.name)),
      ...createTiptapTableExtensions(),
      BlockBoundaryNavigation,
    ],
    content: { type: 'doc', content: [{ type: 'blockGroup', content: blocks }] },
  });
  mounted.push({ editor, element });
  return editor;
}

function disableSelectionScrolling(editor: Editor) {
  vi.spyOn(editor.view as unknown as { scrollToSelection: () => void }, 'scrollToSelection').mockImplementation(
    () => undefined,
  );
}

function findPosition(editor: Editor, type: string, occurrence = 0): number {
  let index = 0;
  let result = -1;
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === type) {
      if (index === occurrence) {
        result = position;
        return false;
      }
      index += 1;
    }
    return result < 0;
  });
  if (result < 0) {
    throw new Error(`Missing ${type} occurrence ${occurrence}`);
  }
  return result;
}

afterEach(() => {
  for (const value of mounted.splice(0)) {
    value.editor.destroy();
    value.element.remove();
  }
});

describe('independent block selection boundaries', () => {
  it('moves text caret to math, code, table, its first cell, then back to text without selecting rendered content', () => {
    const editor = createEditor([
      block('before', { type: 'paragraph', content: [{ type: 'text', text: 'before' }] }),
      block('math', { type: 'math', attrs: { latex: 'x^2' } }),
      block('code', { type: 'codeBlock', attrs: { language: 'typescript' }, content: [{ type: 'text', text: 'x' }] }),
      block('table', {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'cell' }] }] },
            ],
          },
        ],
      }),
      block('after', { type: 'paragraph', content: [{ type: 'text', text: 'after' }] }),
    ]);
    disableSelectionScrolling(editor);
    const before = editor.state.doc.toJSON();
    const firstParagraph = findPosition(editor, 'paragraph');
    editor.commands.setTextSelection(firstParagraph + 1 + 'before'.length);
    vi.spyOn(editor.view, 'endOfTextblock').mockReturnValue(true);

    expect(handleBlockBoundaryArrow(editor, 'down')).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect((editor.state.selection as NodeSelection).node.type.name).toBe('math');

    expect(handleBlockBoundaryArrow(editor, 'down')).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect((editor.state.selection as NodeSelection).node.type.name).toBe('codeBlock');

    expect(handleBlockBoundaryArrow(editor, 'down')).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(CellSelection);
    expect((editor.state.selection as CellSelection).isRowSelection()).toBe(true);
    expect((editor.state.selection as CellSelection).isColSelection()).toBe(true);

    editor.registerPlugin(new Plugin({}));

    expect(handleBlockBoundaryArrow(editor, 'down')).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(TextSelection);
    expect(editor.state.selection.from).toBe(findPosition(editor, 'paragraph', 1) + 1);

    expect(handleBlockBoundaryArrow(editor, 'down')).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(CellSelection);

    expect(handleBlockBoundaryArrow(editor, 'down')).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(TextSelection);
    expect(editor.state.selection.from).toBe(findPosition(editor, 'paragraph', 2) + 1);
    expect(editor.state.doc.toJSON()).toEqual(before);
  });

  it('enters the first table cell when ArrowUp selected the table from the block below', () => {
    const editor = createEditor([
      block('table', {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'first' }] }] },
            ],
          },
        ],
      }),
      block('map', { type: 'map' }),
    ]);
    disableSelectionScrolling(editor);
    editor.view.dispatch(
      editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, findPosition(editor, 'map'))),
    );

    expect(handleBlockBoundaryArrow(editor, 'up')).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(CellSelection);

    expect(handleBlockBoundaryArrow(editor, 'up')).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(TextSelection);
    expect(editor.state.selection.from).toBe(findPosition(editor, 'paragraph') + 1);
  });

  it('does not turn inline math or ordinary adjacent text into a block boundary', () => {
    const editor = createEditor([
      block('inline', {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'value ' },
          { type: 'mathInline', attrs: { latex: 'x' } },
        ],
      }),
      block('text', { type: 'paragraph', content: [{ type: 'text', text: 'plain' }] }),
    ]);
    const paragraph = findPosition(editor, 'paragraph');
    editor.commands.setTextSelection(paragraph + 1 + editor.state.doc.nodeAt(paragraph)!.content.size);
    vi.spyOn(editor.view, 'endOfTextblock').mockReturnValue(false);

    expect(handleBlockBoundaryArrow(editor, 'down')).toBe(false);
    expect(editor.state.selection).toBeInstanceOf(TextSelection);
  });

  it('navigates through an external-video preview as an exact block boundary', () => {
    const editor = createEditor([
      block('before', { type: 'paragraph', content: [{ type: 'text', text: 'before' }] }),
      block('video', {
        type: 'externalVideo',
        attrs: {
          url: 'https://youtu.be/dQw4w9WgXcQ?t=60',
          label: 'Field recording',
          sourceContent: [
            {
              type: 'text',
              text: 'Field recording',
              marks: [{ type: 'link', attrs: { href: 'https://youtu.be/dQw4w9WgXcQ?t=60' } }],
            },
          ],
        },
      }),
      block('after', { type: 'paragraph', content: [{ type: 'text', text: 'after' }] }),
    ]);
    disableSelectionScrolling(editor);
    const before = findPosition(editor, 'paragraph');
    editor.commands.setTextSelection(before + 1 + 'before'.length);
    vi.spyOn(editor.view, 'endOfTextblock').mockReturnValue(true);

    expect(handleBlockBoundaryArrow(editor, 'down')).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect((editor.state.selection as NodeSelection).node.type.name).toBe('externalVideo');

    expect(handleBlockBoundaryArrow(editor, 'down')).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(TextSelection);
    expect(editor.state.selection.$from.parent.textContent).toBe('after');
    expect(editor.state.selection.$from.parentOffset).toBe(0);
  });

  it('selects the table boundary before leaving the last row for the immediately adjacent block', () => {
    const editor = createEditor([
      block('table', {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'first' }] }] },
            ],
          },
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'last' }] }] },
            ],
          },
        ],
      }),
      block('map', { type: 'map' }),
      block('file', { type: 'file' }),
    ]);
    disableSelectionScrolling(editor);
    vi.spyOn(editor.view, 'endOfTextblock').mockReturnValue(false);
    const lastParagraph = findPosition(editor, 'paragraph', 1);
    editor.commands.setTextSelection(lastParagraph + 1 + 'last'.length);

    expect(handleBlockBoundaryArrow(editor, 'down')).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(CellSelection);
    expect((editor.state.selection as CellSelection).isRowSelection()).toBe(true);
    expect((editor.state.selection as CellSelection).isColSelection()).toBe(true);

    expect(handleBlockBoundaryArrow(editor, 'down')).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect((editor.state.selection as NodeSelection).node.type.name).toBe('map');
  });

  it('selects the table boundary from the first row on ArrowUp regardless of horizontal caret offset', () => {
    const editor = createEditor([
      block('before', { type: 'paragraph', content: [{ type: 'text', text: 'before' }] }),
      block('table', {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'record' }] }] },
            ],
          },
        ],
      }),
    ]);
    disableSelectionScrolling(editor);
    vi.spyOn(editor.view, 'endOfTextblock').mockReturnValue(false);
    const headerParagraph = findPosition(editor, 'paragraph', 1);
    editor.commands.setTextSelection(headerParagraph + 1 + 'record'.length);

    const event = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
    editor.view.dom.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(CellSelection);
    expect((editor.state.selection as CellSelection).isRowSelection()).toBe(true);
    expect((editor.state.selection as CellSelection).isColSelection()).toBe(true);
  });

  it('rejects a delayed stale browser text selection that follows a table boundary selection', async () => {
    const editor = createEditor([
      block('table', {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'record' }] }] },
            ],
          },
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'rehearsal' }] }] },
            ],
          },
        ],
      }),
    ]);
    disableSelectionScrolling(editor);
    const firstParagraph = findPosition(editor, 'paragraph');
    const staleParagraph = findPosition(editor, 'paragraph', 1);
    editor.commands.setTextSelection(firstParagraph + 1 + 'record'.length);

    expect(handleBlockBoundaryArrow(editor, 'up')).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(CellSelection);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(editor.state.selection).toBeInstanceOf(CellSelection);

    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, staleParagraph + 1, staleParagraph + 1 + 'rehearsal'.length),
      ),
    );

    expect(editor.state.selection).toBeInstanceOf(CellSelection);
    expect((editor.state.selection as CellSelection).isRowSelection()).toBe(true);
    expect((editor.state.selection as CellSelection).isColSelection()).toBe(true);
  });

  it('allows an explicit pointer interaction to leave a protected table boundary selection', () => {
    const editor = createEditor([
      block('table', {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'record' }] }] },
            ],
          },
        ],
      }),
    ]);
    disableSelectionScrolling(editor);
    const paragraph = findPosition(editor, 'paragraph');
    editor.commands.setTextSelection(paragraph + 1 + 'record'.length);

    expect(handleBlockBoundaryArrow(editor, 'up')).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(CellSelection);

    editor.view.dom.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, paragraph + 1)));

    expect(editor.state.selection).toBeInstanceOf(TextSelection);
  });

  it('protects a cell selection restored by a table mutation after toolbar pointer input', async () => {
    const editor = createEditor([
      block('table', {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'record' }] }] },
            ],
          },
        ],
      }),
    ]);
    disableSelectionScrolling(editor);
    const paragraph = findPosition(editor, 'paragraph');
    editor.commands.setTextSelection(paragraph + 1 + 'record'.length);
    expect(handleBlockBoundaryArrow(editor, 'up')).toBe(true);

    editor.view.dom.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(editor.commands.setTableAlignment('right')).toBe(true);
    editor.commands.focus();
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(editor.state.selection).toBeInstanceOf(CellSelection);
    expect(editor.getAttributes('table').textAlignment).toBe('right');
  });
});
