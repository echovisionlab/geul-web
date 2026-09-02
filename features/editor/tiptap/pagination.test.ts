// @vitest-environment jsdom

import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';

import { createTiptapWireExtensions } from './wire-schema';
import {
  createTiptapPaginationExtension,
  PAGINATION_PAGE_SIZES,
  formatPaginationFooter,
  getPaginationLayout,
  isPaginationEnabled,
  resolvePaginationLayout,
} from './pagination';

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

  it('resolves page chrome for every supported orientation without persisting it', () => {
    const portrait = resolvePaginationLayout({
      enabled: true,
      pageSize: 'LETTER',
      orientation: 'portrait',
      headerText: 'Geul · Post',
      footerText: 'Preview',
    });
    const landscape = resolvePaginationLayout({
      enabled: true,
      pageSize: 'LETTER',
      orientation: 'landscape',
      headerText: 'Geul · Post',
      footerText: 'Preview',
    });

    expect(portrait).toEqual(expect.objectContaining({ width: 816, height: 1056 }));
    expect(landscape).toEqual(expect.objectContaining({ width: 1056, height: 816 }));
    expect(landscape.headerText).toBe('Geul · Post');
    expect(landscape.footerText).toBe('Preview');
    expect(formatPaginationFooter('', 2, 7)).toBe('2 / 7');
    expect(formatPaginationFooter('Preview', 2, 7)).toBe('Preview · 2 / 7');

    for (const pageSize of Object.keys(PAGINATION_PAGE_SIZES) as Array<keyof typeof PAGINATION_PAGE_SIZES>) {
      const preset = PAGINATION_PAGE_SIZES[pageSize];
      expect(resolvePaginationLayout({ enabled: true, pageSize, orientation: 'portrait' })).toEqual(
        expect.objectContaining({ width: preset.width, height: preset.height }),
      );
      expect(resolvePaginationLayout({ enabled: true, pageSize, orientation: 'landscape' })).toEqual(
        expect.objectContaining({ width: preset.height, height: preset.width }),
      );
    }
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
