// @vitest-environment jsdom

import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';

import { createTiptapWireExtensions } from './wire-schema';
import { createTiptapPaginationExtension, getPaginationLayout, isPaginationEnabled } from './pagination';

function createEditor() {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: [...createTiptapWireExtensions(), createTiptapPaginationExtension()],
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'paragraph' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pagination' }] }],
            },
          ],
        },
      ],
    },
  });
  return {
    editor,
    destroy: () => {
      editor.destroy();
      element.remove();
    },
  };
}

describe('Tiptap pagination', () => {
  it('toggles presentation state without changing the collaborative document or undo history', () => {
    const mounted = createEditor();
    const documentBefore = mounted.editor.getJSON();
    const transactions: Array<{ docChanged: boolean; addToHistory: unknown }> = [];
    mounted.editor.on('transaction', ({ transaction }) => {
      transactions.push({
        docChanged: transaction.docChanged,
        addToHistory: transaction.getMeta('addToHistory'),
      });
    });

    expect(mounted.editor.commands.setPagination(true)).toBe(true);
    expect(isPaginationEnabled(mounted.editor)).toBe(true);
    expect(getPaginationLayout(mounted.editor)).toEqual(
      expect.objectContaining({
        pageSize: 'A4',
        orientation: 'portrait',
        width: 794,
        height: 1123,
        gap: 12,
        headerText: '',
        footerText: '',
      }),
    );
    expect(mounted.editor.getJSON()).toEqual(documentBefore);
    expect(transactions.at(-1)).toEqual({ docChanged: false, addToHistory: false });

    expect(
      mounted.editor.commands.setPagination({
        enabled: true,
        pageSize: 'A5',
        orientation: 'landscape',
      }),
    ).toBe(true);
    expect(getPaginationLayout(mounted.editor)).toEqual(
      expect.objectContaining({
        pageSize: 'A5',
        orientation: 'landscape',
        width: 794,
        height: 559,
      }),
    );
    expect(mounted.editor.getJSON()).toEqual(documentBefore);
    expect(transactions.at(-1)).toEqual({ docChanged: false, addToHistory: false });

    expect(mounted.editor.commands.togglePagination()).toBe(true);
    expect(isPaginationEnabled(mounted.editor)).toBe(false);
    expect(mounted.editor.getJSON()).toEqual(documentBefore);
    mounted.destroy();
  });

  it('keeps repeated chrome in plugin state only', () => {
    const mounted = createEditor();
    const documentBefore = mounted.editor.getJSON();

    mounted.editor.commands.setPagination({
      enabled: true,
      pageSize: 'A3',
      orientation: 'landscape',
      headerText: 'Work · 한강의 시간',
      footerText: 'Print preview',
    });

    expect(getPaginationLayout(mounted.editor)).toEqual(
      expect.objectContaining({
        headerText: 'Work · 한강의 시간',
        footerText: 'Print preview',
      }),
    );
    expect(mounted.editor.getJSON()).toEqual(documentBefore);
    expect(JSON.stringify(mounted.editor.getJSON())).not.toContain('Print preview');
    mounted.destroy();
  });
});
