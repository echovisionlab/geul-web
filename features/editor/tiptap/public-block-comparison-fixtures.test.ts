// @vitest-environment jsdom
import { Editor, Node } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { materializeLocalizedRichTextTree } from '@/features/editor/contract/localized-rich-text';
import { createPublicBlockComparisonDocument } from './public-block-comparison-fixtures';
import { createTiptapPlaygroundRoom } from './TiptapPlayground.story-fixtures';
import { createTiptapWireExtensions } from './wire-schema';
import { createTiptapTableExtensions } from './table';

describe('public block comparison', () => {
  it('projects authored column headings in both table specimens while preserving the empty body state', () => {
    const room = createTiptapPlaygroundRoom(createPublicBlockComparisonDocument());
    try {
      const tables = room.controller.initialContent.content?.[0]?.content?.flatMap(
        (block) => block.content?.filter((node) => node.type === 'table') ?? [],
      );
      expect(tables).toHaveLength(2);
      for (const table of tables!) {
        const header = table.content?.[0]?.content;
        expect(header?.map((cell) => cell.type)).toEqual(['tableHeader', 'tableHeader']);
        expect(header?.map((cell) => cell.content?.[0]?.content?.[0]?.text)).toEqual(['열 1', '열 2']);
      }
      const bodies = tables!.map((table) => table.content?.slice(1).flatMap((row) => row.content ?? []) ?? []);
      expect(bodies[0]!.every((cell) => cell.content?.[0]?.content?.[0]?.text?.startsWith('표 내용'))).toBe(true);
      expect(bodies[1]).toHaveLength(4);
      expect(bodies[1]!.every((cell) => (cell.content?.[0]?.content?.length ?? 0) === 0)).toBe(true);

      const publishedTables = materializeLocalizedRichTextTree(room.controller.getLocalizedDocumentSnapshot()).filter(
        (block) => block.kind === 'table',
      );
      expect(publishedTables).toHaveLength(2);
      for (const table of publishedTables) {
        expect(table.base.content?.headerRows).toBe(1);
        expect(table.base.content?.rows[0]?.cells.every((cell) => cell.header)).toBe(true);
        expect(table.locale.content?.rows[0]?.cells.every((cell) => cell.content.length > 0)).toBe(true);
      }
      expect(
        publishedTables[1]?.locale.content?.rows
          .slice(1)
          .every((row) => row.cells.every((cell) => cell.content.length === 0)),
      ).toBe(true);
    } finally {
      room.awareness.destroy();
      room.document.destroy();
    }
  });

  it('keeps stored table proportions through projection, resizing and preview', () => {
    const source = createPublicBlockComparisonDocument();
    source.base!.nodes = source.base!.nodes.filter((node) => node.block?.value.case === 'table');
    source.base!.nodes.forEach((node, index) => {
      node.placement!.index = index;
    });
    const ids = new Set(source.base!.nodes.map((node) => node.block!.id));
    source.localeOverlay!.blocks = source.localeOverlay!.blocks.filter((block) => ids.has(block.blockId));
    const room = createTiptapPlaygroundRoom(source);
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [
        ...createTiptapWireExtensions().filter(
          (extension) => !['table', 'tableRow', 'tableCell', 'tableHeader'].includes(extension.name),
        ),
        ...createTiptapTableExtensions(),
        room.controller.extension,
      ],
      content: room.controller.initialContent,
    });
    const disconnect = room.controller.connect(editor);
    try {
      const positions: number[] = [];
      editor.state.doc.descendants((node, position) => {
        if (node.type.name === 'tableHeader' || node.type.name === 'tableCell') {
          positions.push(position);
        }
      });
      expect(positions.slice(0, 2).map((position) => editor.state.doc.nodeAt(position)?.attrs.colwidth)).toEqual([
        [40],
        [60],
      ]);
      let transaction = editor.state.tr;
      positions.forEach(
        (position, index) =>
          (transaction = transaction.setNodeMarkup(position, undefined, {
            ...editor.state.doc.nodeAt(position)!.attrs,
            colwidth: [index % 2 === 0 ? 30 : 70],
          })),
      );
      editor.view.dispatch(transaction);
      const table = materializeLocalizedRichTextTree(room.controller.getLocalizedDocumentSnapshot())[0];
      expect(table?.kind === 'table' ? table.base.content?.columnWidths : undefined).toEqual([30, 70]);
    } finally {
      disconnect();
      editor.destroy();
      room.awareness.destroy();
      room.document.destroy();
    }
  });

  it('persists a newly inserted empty table before any cell is typed', () => {
    const room = createTiptapPlaygroundRoom();
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [
        ...createTiptapWireExtensions().filter(
          (extension) => !['table', 'tableRow', 'tableCell', 'tableHeader'].includes(extension.name),
        ),
        ...createTiptapTableExtensions(),
        Node.create({ name: 'mermaid', group: 'blockContent', content: 'text*', renderHTML: () => ['div', 0] }),
        room.controller.extension,
      ],
      content: room.controller.initialContent,
    });
    const disconnect = room.controller.connect(editor);
    try {
      expect(editor.chain().focus('end').insertTable({ rows: 3, columns: 3, withHeaderRow: true }).run()).toBe(true);
      const blocks = materializeLocalizedRichTextTree(room.controller.getLocalizedDocumentSnapshot());
      expect(blocks[0]?.kind).toBe('heading');
      const table = blocks.find((block) => block.kind === 'table');
      expect(table?.kind).toBe('table');
      if (table?.kind === 'table') {
        expect(table.base.content?.rows).toHaveLength(3);
        expect(table.locale.content?.rows.every((row) => row.cells.every((cell) => cell.content.length === 0))).toBe(
          true,
        );
      }
    } finally {
      disconnect();
      editor.destroy();
      room.awareness.destroy();
      room.document.destroy();
    }
  });
});
