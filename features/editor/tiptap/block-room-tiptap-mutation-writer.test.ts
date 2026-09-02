import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import {
  contentBlockCatalogFingerprint,
  type RichTextBlockKind,
} from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
  type LocalizedRichTextDocument,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  getBlockRoomCollaborativeText,
  hydrateCanonicalBlockRoom,
  materializeCanonicalBlockRoom,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { createBlockRoomProseMirrorBridge, type ProseMirrorBlockDescriptor } from './block-room-prosemirror-bridge';
import { applyTiptapBlockPayload } from './block-room-tiptap-mutation-writer';
import type { JsonObject, TiptapBlockSnapshot } from './block-room-tiptap-codec';
import { SHADER_STAGE_DEFINITIONS } from './shader/shader-program';

const IDS = {
  paragraph: '10000000-0000-4000-8000-000000000001',
  codeBlock: '10000000-0000-4000-8000-000000000002',
  p5Sketch: '10000000-0000-4000-8000-000000000003',
  threeScene: '10000000-0000-4000-8000-000000000004',
  shader: '10000000-0000-4000-8000-000000000005',
  table: '10000000-0000-4000-8000-000000000006',
} as const;

function emptyCollaborativeLeavesDocument(): LocalizedRichTextDocument {
  const shaderStages = SHADER_STAGE_DEFINITIONS.map((_, index) => ({ kind: index + 1, source: '' }));
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale: 'ko',
    base: {
      nodes: [
        { block: { id: IDS.paragraph, paragraph: { props: {} } }, placement: { index: 0 } },
        { block: { id: IDS.codeBlock, codeBlock: { props: {} } }, placement: { index: 1 } },
        { block: { id: IDS.p5Sketch, p5Sketch: { props: {} } }, placement: { index: 2 } },
        { block: { id: IDS.threeScene, threeScene: { props: {} } }, placement: { index: 3 } },
        { block: { id: IDS.shader, shader: { props: { stages: shaderStages } } }, placement: { index: 4 } },
        {
          block: {
            id: IDS.table,
            table: { props: {}, content: { rows: [{ cells: [{ header: false, props: {} }] }] } },
          },
          placement: { index: 5 },
        },
      ],
    },
    localeOverlay: {
      locale: 'ko',
      blocks: [
        { blockId: IDS.paragraph, paragraph: { props: {} } },
        { blockId: IDS.codeBlock, codeBlock: { props: {} } },
        { blockId: IDS.p5Sketch, p5Sketch: { props: {} } },
        { blockId: IDS.threeScene, threeScene: { props: {} } },
        { blockId: IDS.shader, shader: { props: {} } },
        {
          blockId: IDS.table,
          table: { props: {}, content: { rows: [{ cells: [{}] }] } },
        },
      ],
    },
  } as JsonValue);
}

function inlineDocument(): LocalizedRichTextDocument {
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale: 'ko',
    base: {
      nodes: [
        { block: { id: IDS.paragraph, paragraph: { props: {} } }, placement: { index: 0 } },
        {
          block: {
            id: IDS.table,
            table: { props: {}, content: { rows: [{ cells: [{ header: false, props: {} }] }] } },
          },
          placement: { index: 1 },
        },
      ],
    },
    localeOverlay: {
      locale: 'ko',
      blocks: [
        {
          blockId: IDS.paragraph,
          paragraph: {
            props: {},
            content: [
              { text: { text: 'prefix' } },
              {
                link: {
                  href: 'https://example.com',
                  content: [{ text: 'left' }, { text: 'right', styles: { bold: true } }],
                },
              },
              { mathInline: { source: 'x+y' } },
              { hardBreak: {} },
              { text: { text: 'suffix' } },
            ],
          },
        },
        {
          blockId: IDS.table,
          table: {
            props: {},
            content: {
              rows: [
                {
                  cells: [
                    {
                      content: [
                        {
                          link: {
                            href: 'https://example.com/table',
                            content: [{ text: 'cell link' }],
                          },
                        },
                        { mathInline: { source: 'a+b' } },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
      ],
    },
  } as JsonValue);
}

function blockInput(block: ProseMirrorBlockDescriptor, position: number): TiptapBlockSnapshot {
  return {
    id: block.id,
    nodeType: block.adapter.nodeType,
    protoCase: block.adapter.protoCase,
    kind: block.adapter.kind,
    index: position,
    attrs: {},
    content: [],
    children: [],
  };
}

function applyPayload(
  bridge: ReturnType<typeof createBlockRoomProseMirrorBridge>,
  kind: RichTextBlockKind,
  payload: { base: JsonObject; locale: JsonObject },
): void {
  const blocks = bridge.readBlocks();
  const position = blocks.findIndex((block) => block.adapter.kind === kind);
  const block = blocks[position];
  if (!block || position < 0) {
    throw new Error(`Expected ${kind} Block.`);
  }
  applyTiptapBlockPayload(bridge, blockInput(block, position), { ...block, parentId: null, position }, payload);
}

describe('Block-room Tiptap mutation writer', () => {
  it('creates absent generated collaborative text leaves before applying their first edit', () => {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(room, 'post', 'ko', emptyCollaborativeLeavesDocument(), []);
    const bridge = createBlockRoomProseMirrorBridge({ document: room, documentType: 'post', locale: 'ko' });
    const shaderStages = SHADER_STAGE_DEFINITIONS.map((_, index) => ({ kind: index + 1, source: `shader-${index}` }));

    applyPayload(bridge, 'paragraph', {
      base: { props: {} },
      locale: { props: {}, content: [{ text: { text: 'inline' } }] },
    });
    applyPayload(bridge, 'code-block', {
      base: { props: {} },
      locale: { props: {}, content: 'code' },
    });
    applyPayload(bridge, 'p5-sketch', {
      base: { props: { source: 'p5' } },
      locale: { props: {} },
    });
    applyPayload(bridge, 'three-scene', {
      base: { props: { source: 'three' } },
      locale: { props: {} },
    });
    applyPayload(bridge, 'shader', {
      base: { props: { stages: shaderStages } },
      locale: { props: {} },
    });
    applyPayload(bridge, 'table', {
      base: { props: {}, content: { rows: [{ cells: [{ header: false, props: {} }] }] } },
      locale: { props: {}, content: { rows: [{ cells: [{ content: [{ text: { text: 'table' } }] }] }] } },
    });

    const text = (id: string, scope: 'base' | 'locale', path: string) =>
      getBlockRoomCollaborativeText(room, {
        id,
        family: 'rich_text',
        ...(scope === 'locale' ? { locale: true as const } : {}),
        path,
      }).toString();
    expect(text(IDS.paragraph, 'locale', 'content[0].text.text')).toBe('inline');
    expect(text(IDS.codeBlock, 'locale', 'content')).toBe('code');
    expect(text(IDS.p5Sketch, 'base', 'props.source')).toBe('p5');
    expect(text(IDS.threeScene, 'base', 'props.source')).toBe('three');
    expect(text(IDS.shader, 'base', 'props.stages[0].source')).toBe('shader-0');
    expect(text(IDS.table, 'locale', 'content.rows[0].cells[0].content[0].text.text')).toBe('table');

    const materialized = materializeCanonicalBlockRoom(room, 'post');
    if (materialized.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
      throw new Error('Expected Post document.');
    }
    const paragraph = materialized.localeOverlay?.blocks[0]?.value;
    const table = materialized.localeOverlay?.blocks[5]?.value;
    expect(paragraph?.case === 'paragraph' ? paragraph.value.content : undefined).toHaveLength(1);
    expect(table?.case === 'table' ? table.value.content?.rows[0]?.cells[0]?.content : undefined).toHaveLength(1);
    expect(() =>
      bridge.setAtomicValue(
        {
          blockId: IDS.paragraph,
          scope: 'locale',
          path: 'content[0].text.text',
        },
        'not-atomic',
      ),
    ).toThrow('collaborative_text');
  });

  it('diffs link children and inline math in place, including table-cell inline content', () => {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(room, 'post', 'ko', inlineDocument(), []);
    const bridge = createBlockRoomProseMirrorBridge({ document: room, documentType: 'post', locale: 'ko' });
    const replaceCollection = vi.spyOn(bridge, 'replaceCollection');

    applyPayload(bridge, 'paragraph', {
      base: { props: {} },
      locale: {
        props: {},
        content: [
          { text: { text: 'prefix' } },
          {
            link: {
              href: 'https://example.com/changed',
              content: [{ text: 'left updated' }, { text: 'right', styles: { bold: true } }],
            },
          },
          { mathInline: { source: 'x+y+z' } },
          { hardBreak: {} },
          { text: { text: 'suffix' } },
        ],
      },
    });
    applyPayload(bridge, 'table', {
      base: { props: {}, content: { rows: [{ cells: [{ header: false, props: {} }] }] } },
      locale: {
        props: {},
        content: {
          rows: [
            {
              cells: [
                {
                  content: [
                    {
                      link: {
                        href: 'https://example.com/table',
                        content: [{ text: 'cell link updated' }],
                      },
                    },
                    { mathInline: { source: 'a+b+c' } },
                  ],
                },
              ],
            },
          ],
        },
      },
    });

    const text = (id: string, path: string) =>
      getBlockRoomCollaborativeText(room, { id, family: 'rich_text', locale: true, path }).toString();
    expect(text(IDS.paragraph, 'content[1].link.content[0].text')).toBe('left updated');
    expect(text(IDS.paragraph, 'content[2].mathInline.source')).toBe('x+y+z');
    expect(text(IDS.table, 'content.rows[0].cells[0].content[0].link.content[0].text')).toBe('cell link updated');
    expect(text(IDS.table, 'content.rows[0].cells[0].content[1].mathInline.source')).toBe('a+b+c');
    expect(replaceCollection).not.toHaveBeenCalled();
  });

  it('converges concurrent edits to distinct link children without duplicating the inline collection', () => {
    const first = new Y.Doc();
    hydrateCanonicalBlockRoom(first, 'post', 'ko', inlineDocument(), []);
    const second = new Y.Doc();
    Y.applyUpdate(second, Y.encodeStateAsUpdate(first));
    const firstBridge = createBlockRoomProseMirrorBridge({ document: first, documentType: 'post', locale: 'ko' });
    const secondBridge = createBlockRoomProseMirrorBridge({ document: second, documentType: 'post', locale: 'ko' });
    const firstReplace = vi.spyOn(firstBridge, 'replaceCollection');
    const secondReplace = vi.spyOn(secondBridge, 'replaceCollection');

    applyPayload(firstBridge, 'paragraph', {
      base: { props: {} },
      locale: {
        props: {},
        content: [
          { text: { text: 'prefix' } },
          {
            link: {
              href: 'https://example.com',
              content: [{ text: 'first left' }, { text: 'right', styles: { bold: true } }],
            },
          },
          { mathInline: { source: 'x+y' } },
          { hardBreak: {} },
          { text: { text: 'suffix' } },
        ],
      },
    });
    applyPayload(secondBridge, 'paragraph', {
      base: { props: {} },
      locale: {
        props: {},
        content: [
          { text: { text: 'prefix' } },
          {
            link: {
              href: 'https://example.com',
              content: [{ text: 'left' }, { text: 'second right', styles: { bold: true } }],
            },
          },
          { mathInline: { source: 'x+y' } },
          { hardBreak: {} },
          { text: { text: 'suffix' } },
        ],
      },
    });

    Y.applyUpdate(second, Y.encodeStateAsUpdate(first, Y.encodeStateVector(second)));
    Y.applyUpdate(first, Y.encodeStateAsUpdate(second, Y.encodeStateVector(first)));

    for (const room of [first, second]) {
      const text = (path: string) =>
        getBlockRoomCollaborativeText(room, { id: IDS.paragraph, family: 'rich_text', locale: true, path }).toString();
      expect(text('content[1].link.content[0].text')).toBe('first left');
      expect(text('content[1].link.content[1].text')).toBe('second right');
      const document = materializeCanonicalBlockRoom(room, 'post');
      const paragraph =
        document.$typeName === 'api.content.v1.LocalizedRichTextDocument'
          ? document.localeOverlay?.blocks[0]?.value
          : undefined;
      expect(paragraph?.case === 'paragraph' ? paragraph.value.content : undefined).toHaveLength(5);
    }
    expect(firstReplace).not.toHaveBeenCalled();
    expect(secondReplace).not.toHaveBeenCalled();
  });

  it('replaces only the changed link-child window when a link child topology changes', () => {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(room, 'post', 'ko', inlineDocument(), []);
    const bridge = createBlockRoomProseMirrorBridge({ document: room, documentType: 'post', locale: 'ko' });
    const deleteCollectionItem = vi.spyOn(bridge, 'deleteCollectionItem');
    const insertCollectionItem = vi.spyOn(bridge, 'insertCollectionItem');

    applyPayload(bridge, 'paragraph', {
      base: { props: {} },
      locale: {
        props: {},
        content: [
          { text: { text: 'prefix' } },
          {
            link: {
              href: 'https://example.com',
              content: [
                { text: 'left' },
                { text: 'middle', styles: { italic: true } },
                { text: 'right', styles: { bold: true } },
              ],
            },
          },
          { mathInline: { source: 'x+y' } },
          { hardBreak: {} },
          { text: { text: 'suffix' } },
        ],
      },
    });

    expect(deleteCollectionItem.mock.calls.filter(([target]) => target.path === 'content')).toEqual([]);
    expect(insertCollectionItem.mock.calls).toEqual([
      [
        {
          blockId: IDS.paragraph,
          scope: 'locale',
          path: 'content[1].link.content',
        },
        1,
        { text: 'middle', styles: { italic: true } },
      ],
    ]);
  });
});
