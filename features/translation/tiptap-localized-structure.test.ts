import { describe, expect, it } from 'vitest';
import {
  localizedBlocksToTiptapDocument,
  mergeTiptapLocalizedStructure,
  projectTiptapSharedStructure,
  tiptapDocumentToLocalizedBlocks,
  type TiptapLocalizedBlock,
} from './tiptap-localized-structure';

function block(
  id: string,
  type: string,
  content: TiptapLocalizedBlock['content'] = [],
  props: Record<string, unknown> = {},
): TiptapLocalizedBlock {
  return { id, type, props, content, children: [] };
}

describe('Tiptap locale/shared structure projection', () => {
  it('round-trips block IDs, nested hierarchy, props, marks, and text', () => {
    const blocks: TiptapLocalizedBlock[] = [
      {
        ...block('parent', 'heading', [{ type: 'text', text: 'Heading', marks: [{ type: 'bold' }] }], { level: 2 }),
        children: [block('child', 'paragraph', [{ type: 'text', text: 'Child' }])],
      },
    ];

    expect(tiptapDocumentToLocalizedBlocks(localizedBlocksToTiptapDocument(blocks))).toEqual(blocks);
  });

  it('uses shared hierarchy and props while preserving localized text', () => {
    const shared = [block('first', 'paragraph', [], { textAlignment: 'center' }), block('second', 'paragraph')];
    const localized = [
      block('stale', 'paragraph', [{ type: 'text', text: 'Removed' }]),
      block('first', 'paragraph', [{ type: 'text', text: '번역' }], { textAlignment: 'left' }),
    ];

    expect(mergeTiptapLocalizedStructure(shared, localized)).toEqual([
      block('first', 'paragraph', [{ type: 'text', text: '번역' }], { textAlignment: 'center' }),
      block('second', 'paragraph'),
    ]);
  });

  it('keeps executable source shared and ordinary code text localized', () => {
    const shared = [
      block('code', 'codeBlock', [{ type: 'text', text: 'source code' }], {
        title: 'Source title',
        language: 'typescript',
      }),
      block('p5', 'p5Sketch', [{ type: 'text', text: 'shared sketch' }], {
        camera: true,
        microphone: false,
      }),
    ];
    const localized = [
      block('code', 'codeBlock', [{ type: 'text', text: 'localized code' }], {
        title: '번역된 제목',
        language: 'javascript',
      }),
      block('p5', 'p5Sketch', [{ type: 'text', text: 'stale sketch' }], {
        camera: false,
        microphone: true,
      }),
    ];

    expect(mergeTiptapLocalizedStructure(shared, localized)).toEqual([
      block('code', 'codeBlock', [{ type: 'text', text: 'localized code' }], {
        title: '번역된 제목',
        language: 'typescript',
      }),
      block('p5', 'p5Sketch', [{ type: 'text', text: 'shared sketch' }], {
        camera: true,
        microphone: false,
      }),
    ]);
    expect(projectTiptapSharedStructure(localized)).toEqual([
      block('code', 'codeBlock', [], { language: 'javascript' }),
      block('p5', 'p5Sketch', [{ type: 'text', text: 'stale sketch' }], {
        camera: false,
        microphone: true,
      }),
    ]);
  });

  it('keeps shared table shape and cell attrs while preserving localized cell text', () => {
    const sharedTable = block('table', 'table', [
      {
        type: 'tableRow',
        content: [
          { type: 'tableHeader', attrs: { colspan: 1 }, content: [{ type: 'tableParagraph' }] },
          { type: 'tableHeader', attrs: { colspan: 2 }, content: [{ type: 'tableParagraph' }] },
        ],
      },
    ]);
    const localizedTable = block('table', 'table', [
      {
        type: 'tableRow',
        content: [
          {
            type: 'tableCell',
            attrs: { colspan: 9 },
            content: [{ type: 'tableParagraph', content: [{ type: 'text', text: '장소' }] }],
          },
        ],
      },
    ]);

    expect(mergeTiptapLocalizedStructure([sharedTable], [localizedTable])[0]?.content).toEqual([
      {
        type: 'tableRow',
        content: [
          {
            type: 'tableHeader',
            attrs: { colspan: 1 },
            content: [{ type: 'tableParagraph', content: [{ type: 'text', text: '장소' }] }],
          },
          {
            type: 'tableHeader',
            attrs: { colspan: 2 },
            content: [{ type: 'tableParagraph', content: [] }],
          },
        ],
      },
    ]);

    expect(projectTiptapSharedStructure([localizedTable])[0]?.content).toEqual([
      {
        type: 'tableRow',
        content: [
          {
            type: 'tableCell',
            attrs: { colspan: 9 },
            content: [{ type: 'tableParagraph', content: [] }],
          },
        ],
      },
    ]);
  });

  it('fails closed for malformed documents instead of inventing block IDs', () => {
    expect(
      tiptapDocumentToLocalizedBlocks({
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [{ type: 'blockContainer', content: [{ type: 'paragraph' }] }],
          },
        ],
      }),
    ).toBeNull();
  });

  it('fails closed when stable block IDs are duplicated anywhere in the hierarchy', () => {
    expect(
      tiptapDocumentToLocalizedBlocks(
        localizedBlocksToTiptapDocument([
          {
            ...block('duplicate', 'paragraph'),
            children: [block('duplicate', 'paragraph')],
          },
        ]),
      ),
    ).toBeNull();
  });
});
