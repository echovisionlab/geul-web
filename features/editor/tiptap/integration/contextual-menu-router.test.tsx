// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import { describe, expect, it, vi } from 'vitest';
import koMessages from '@/messages/ko.json';
import { createSelectionBubbleMenuLabels } from '../menus';
import { createTiptapTableExtensions } from '../table';
import { createTiptapWireExtensions } from '../wire-schema';
import { BlockBoundaryNavigation } from './block-boundary-navigation';
import { TiptapContextualMenuRouter } from './contextual-menu-router';

vi.mock('next-intl', () => ({
  useLocale: () => 'ko',
  useTranslations: () => (key: string) =>
    koMessages.editorCommon.editor.table[key as keyof typeof koMessages.editorCommon.editor.table],
}));

Object.defineProperties(Range.prototype, {
  getBoundingClientRect: {
    configurable: true,
    value: () => document.body.getBoundingClientRect(),
  },
  getClientRects: {
    configurable: true,
    value: () => [document.body.getBoundingClientRect()],
  },
});

const tableNodeNames = new Set(['table', 'tableRow', 'tableCell', 'tableHeader']);
const selectionLabels = createSelectionBubbleMenuLabels(koMessages.editorCommon.editor, {
  save: koMessages.common.actions.save,
  cancel: koMessages.common.actions.cancel,
});

function createTableEditor() {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: [
      ...createTiptapWireExtensions().filter((extension) => !tableNodeNames.has(extension.name)),
      ...createTiptapTableExtensions(),
      BlockBoundaryNavigation,
    ],
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'table-selection-router' },
              content: [{ type: 'paragraph' }],
            },
          ],
        },
      ],
    },
  });
  editor.commands.setTextSelection(3);
  editor.commands.insertTable({ rows: 1, columns: 1 });
  let cellPosition = -1;
  editor.state.doc.descendants((node, position) => {
    if (cellPosition < 0 && node.type.spec.tableRole === 'cell') {
      cellPosition = position;
    }
  });
  if (cellPosition < 0) {
    throw new Error('Expected a table cell.');
  }
  const textStart = cellPosition + 2;
  editor.commands.insertContentAt(textStart, 'Hello');
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, textStart)));
  editor.view.focus();
  return { editor, element, textStart };
}

async function refresh() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Tiptap contextual menu router table selection boundary', () => {
  it('shows no menu for a caret, the generic menu for selected cell text, and the table menu only for explicit CellSelection', async () => {
    const mounted = createTableEditor();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MantineProvider env="test">
          <TiptapContextualMenuRouter editor={mounted.editor} selectionLabels={selectionLabels} />
        </MantineProvider>,
      );
      await refresh();
    });

    expect(mounted.editor.state.selection).toBeInstanceOf(TextSelection);
    expect(mounted.editor.state.selection.empty).toBe(true);
    expect(document.querySelector('[data-testid="tiptap-selection-menu"]')).toBeNull();
    expect(document.querySelector('[data-testid="tiptap-table-menu"]')).toBeNull();

    await act(async () => {
      mounted.editor.view.dispatch(
        mounted.editor.state.tr.setSelection(
          TextSelection.create(mounted.editor.state.doc, mounted.textStart, mounted.textStart + 2),
        ),
      );
      await refresh();
    });
    expect(mounted.editor.state.selection).toBeInstanceOf(TextSelection);
    expect(document.querySelector('[data-testid="tiptap-selection-menu"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="tiptap-table-menu"]')).toBeNull();

    await act(async () => {
      mounted.editor.view.dispatch(
        mounted.editor.state.tr.setSelection(TextSelection.create(mounted.editor.state.doc, mounted.textStart)),
      );
      await refresh();
    });
    expect(mounted.element.querySelector('[data-testid="tiptap-table-selector"]')).toBeNull();
    const documentBeforeSelection = mounted.editor.state.doc.toJSON();
    await act(async () => {
      mounted.editor.view.dom.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }),
      );
      await refresh();
    });
    expect(mounted.editor.state.selection).toBeInstanceOf(CellSelection);
    expect(mounted.editor.state.doc.toJSON()).toEqual(documentBeforeSelection);
    expect(document.querySelector('[data-testid="tiptap-selection-menu"]')).toBeNull();
    expect(document.querySelector('[data-testid="tiptap-table-menu"]')).not.toBeNull();

    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-testid="tiptap-table-layout-right"]')?.click();
      await refresh();
    });
    let tableAlignment: unknown;
    mounted.editor.state.doc.descendants((node) => {
      if (tableAlignment === undefined && node.type.spec.tableRole === 'table') {
        tableAlignment = node.attrs.textAlignment;
      }
    });
    expect(tableAlignment).toBe('right');
    expect(mounted.editor.state.selection).toBeInstanceOf(CellSelection);
    expect(document.querySelector('[data-testid="tiptap-selection-menu"]')).toBeNull();
    expect(document.querySelector('[data-testid="tiptap-table-menu"]')).not.toBeNull();

    const selectionBeforeEscape = mounted.editor.state.selection.toJSON();
    const documentBeforeEscape = mounted.editor.state.doc.toJSON();
    await act(async () => {
      document
        .querySelector<HTMLElement>('[data-testid="tiptap-table-menu"]')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await refresh();
    });
    expect(mounted.editor.state.selection.toJSON()).toEqual(selectionBeforeEscape);
    expect(mounted.editor.state.doc.toJSON()).toEqual(documentBeforeEscape);
    expect(document.querySelector('[data-testid="tiptap-table-menu"]')).toBeNull();

    await act(async () => root.unmount());
    mounted.editor.destroy();
    mounted.element.remove();
    container.remove();
  });

  it('keeps an explicit table selection but hides its neutral menu when structure authority is denied', async () => {
    const mounted = createTableEditor();
    mounted.editor.view.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }),
    );
    expect(mounted.editor.state.selection).toBeInstanceOf(CellSelection);
    const selection = mounted.editor.state.selection.toJSON();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MantineProvider env="test">
          <TiptapContextualMenuRouter
            editor={mounted.editor}
            selectionLabels={selectionLabels}
            allowTableMenu={false}
          />
        </MantineProvider>,
      );
      await refresh();
    });

    expect(mounted.editor.state.selection.toJSON()).toEqual(selection);
    expect(document.querySelector('[data-testid="tiptap-selection-menu"]')).toBeNull();
    expect(document.querySelector('[data-testid="tiptap-table-menu"]')).toBeNull();

    await act(async () => root.unmount());
    mounted.editor.destroy();
    mounted.element.remove();
    container.remove();
  });
});
