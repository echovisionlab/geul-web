// @vitest-environment jsdom

import { Editor, Node, type JSONContent } from '@tiptap/core';
import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
  type LocalizedRichTextDocument,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  getBlockRoomCollaborativeText,
  hydrateCanonicalBlockRoom,
  materializeCanonicalBlockRoom,
  type BlockRoomDocumentType,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { createBlockRoomProseMirrorBridge } from './block-room-prosemirror-bridge';
import {
  createPostBlockRoomTiptapController,
  createRichTextBlockRoomTiptapController,
} from './block-room-tiptap-controller';
import { blockRoomUndoDepth } from '@/lib/collab/interactive-mutation-undo';
import { createTiptapWireExtensions } from './wire-schema';
import { SHADER_STAGE_DEFINITIONS } from './shader/shader-program';

const BLOCK_ID = '019cce25-dbc0-7d12-9f1f-735b1a6c6b13';
const EMPTY_DOCUMENT_BLOCK_ID = '10000000-0000-4000-8000-000000000180';
const EMPTY_PARAGRAPH_IDS = [
  '10000000-0000-4000-8000-000000000181',
  '10000000-0000-4000-8000-000000000182',
  '10000000-0000-4000-8000-000000000183',
] as const;
const EMPTY_PARAGRAPH_ID_SET = new Set<string>(EMPTY_PARAGRAPH_IDS);
const FOLLOWING_PARAGRAPH_ID = '10000000-0000-4000-8000-000000000184';
const TABLE_ROW_ID = '10000000-0000-4000-8000-000000000185';
const TABLE_CELL_ID = '10000000-0000-4000-8000-000000000186';

interface TestJsonNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: JSONContent['marks'];
  content?: TestJsonNode[];
}

function paragraphText(document: TestJsonNode): string | undefined {
  return document.content?.[0]?.content?.[0]?.content?.[0]?.content?.[0]?.text;
}

function nodePosition(editor: Editor, type: string): number {
  let result = -1;
  editor.state.doc.descendants((node, position) => {
    if (result === -1 && node.type.name === type) {
      result = position;
      return false;
    }
    return true;
  });
  if (result < 0) {
    throw new Error(`Expected ${type} Block node.`);
  }
  return result;
}

function replaceNodeAttributes(editor: Editor, type: string, attributes: Record<string, unknown>): void {
  const position = nodePosition(editor, type);
  editor.view.dispatch(editor.state.tr.setNodeMarkup(position, undefined, attributes));
}

function typeText(editor: Editor, text: string): void {
  for (const character of text) {
    const { from, to } = editor.state.selection;
    const handled = editor.view.someProp('handleTextInput', (handler) =>
      handler(editor.view, from, to, character, () => editor.state.tr.insertText(character, from, to)),
    );
    if (!handled) {
      editor.view.dispatch(editor.state.tr.insertText(character, from, to));
    }
  }
}

function pressModZ(editor: Editor): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'z',
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
  });
  editor.view.dom.dispatchEvent(event);
  return event;
}

function executableTestExtensions() {
  const sourceNode = (name: 'p5Sketch' | 'threeScene') =>
    Node.create({
      name,
      group: 'blockContent',
      content: 'text*',
      addAttributes: () => ({
        title: { default: '' },
        mode: { default: 'edit' },
        previewHeight: { default: 360 },
        previewWidth: { default: '100' },
        textAlignment: { default: 'left' },
        ...(name === 'p5Sketch' ? { capabilities: { default: '' } } : { language: { default: 'typescript' } }),
      }),
      renderHTML: () => ['div', 0],
    });
  const stages = SHADER_STAGE_DEFINITIONS.map(([, name]) =>
    Node.create({
      name,
      content: 'text*',
      addAttributes: () => ({ channels: { default: null } }),
      renderHTML: () => ['pre', 0],
    }),
  );
  const shader = Node.create({
    name: 'shader',
    group: 'blockContent',
    content: SHADER_STAGE_DEFINITIONS.map(([, name]) => name).join(' '),
    addAttributes: () => ({
      title: { default: '' },
      mode: { default: 'edit' },
      previewHeight: { default: 360 },
      previewWidth: { default: '100' },
      textAlignment: { default: 'left' },
    }),
    renderHTML: () => ['div', 0],
  });
  return [sourceNode('p5Sketch'), sourceNode('threeScene'), shader, ...stages];
}

function postDocument(): LocalizedRichTextDocument {
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale: 'ko',
    base: {
      nodes: [{ block: { id: BLOCK_ID, paragraph: { props: {} } }, placement: { index: 0 } }],
    },
    localeOverlay: {
      locale: 'ko',
      blocks: [
        {
          blockId: BLOCK_ID,
          paragraph: { props: {}, content: [{ text: { text: '안녕' } }] },
        },
      ],
    },
  } as unknown as JsonValue);
}

function emptyRichTextDocument(profile: RichTextProfile): LocalizedRichTextDocument {
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile,
    locale: 'ko',
    base: { nodes: [] },
    localeOverlay: { locale: 'ko', blocks: [] },
  } as unknown as JsonValue);
}

function emptyParagraphLeavesDocument(): LocalizedRichTextDocument {
  const ids = [...EMPTY_PARAGRAPH_IDS, FOLLOWING_PARAGRAPH_ID];
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale: 'ko',
    base: {
      nodes: ids.map((id, index) => ({ block: { id, paragraph: { props: {} } }, placement: { index } })),
    },
    localeOverlay: {
      locale: 'ko',
      blocks: [
        ...EMPTY_PARAGRAPH_IDS.map((blockId, index) => ({
          blockId,
          paragraph: { props: {}, content: [{ text: { text: '', styles: { bold: index === 0 } } }] },
        })),
        {
          blockId: FOLLOWING_PARAGRAPH_ID,
          paragraph: { props: {}, content: [{ text: { text: 'unrelated' } }] },
        },
      ],
    },
  } as unknown as JsonValue);
}

function tableDocument(): LocalizedRichTextDocument {
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale: 'ko',
    base: {
      nodes: [
        {
          block: {
            id: BLOCK_ID,
            table: {
              props: { textAlignment: 'TEXT_ALIGNMENT_RIGHT' },
              content: {
                rows: [
                  {
                    id: TABLE_ROW_ID,
                    cells: [{ id: TABLE_CELL_ID, header: true, props: { textAlignment: 'TEXT_ALIGNMENT_CENTER' } }],
                  },
                ],
              },
            },
          },
          placement: { index: 0 },
        },
      ],
    },
    localeOverlay: {
      locale: 'ko',
      blocks: [
        {
          blockId: BLOCK_ID,
          table: {
            props: {},
            content: {
              rows: [
                {
                  rowId: TABLE_ROW_ID,
                  cells: [{ cellId: TABLE_CELL_ID, content: [{ text: { text: 'A' } }] }],
                },
              ],
            },
          },
        },
      ],
    },
  } as JsonValue);
}

function allKindsDocument(): LocalizedRichTextDocument {
  const ids = Array.from(
    { length: 16 },
    (_, index) => `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  );
  const shaderStages = [
    'common',
    'vertex',
    'bufferA',
    'bufferB',
    'bufferC',
    'bufferD',
    'cubemap',
    'sound',
    'image',
  ].map((kind, index) => ({
    kind: index + 1,
    source: `${kind}-source`,
    channels: Array.from({ length: 4 }, () => ({
      kind: 1,
      file: { activeFileId: '20000000-0000-4000-8000-000000000002' },
      faces: Array.from({ length: 6 }, () => ({
        activeFileId: '20000000-0000-4000-8000-000000000003',
      })),
    })),
  }));
  const tableRowId = '10000000-0000-4000-8000-000000000187';
  const tableCellId = '10000000-0000-4000-8000-000000000188';
  const base = [
    { paragraph: { props: { textAlignment: 2 } } },
    { heading: { props: { level: 2 } } },
    { bulletListItem: { props: {} } },
    { numberedListItem: { props: { start: 3 } } },
    { checkListItem: { props: { checked: true } } },
    { quote: { props: {} } },
    { codeBlock: { props: { language: 11 } } },
    { divider: { props: {} } },
    {
      table: {
        props: {},
        content: { rows: [{ id: tableRowId, cells: [{ id: tableCellId, header: false, props: {} }] }] },
      },
    },
    { p5Sketch: { props: { source: 'p5-source', capabilities: [1] } } },
    { threeScene: { props: { source: 'three-source', language: 2 } } },
    { shader: { props: { stages: shaderStages } } },
    { math: { props: { latex: 'x^2' } } },
    {
      map: {
        props: {
          mapPlaceIds: ['20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000011'],
          aspectRatio: 1,
        },
      },
    },
    {
      file: {
        props: {
          attachment: { activeFileId: '20000000-0000-4000-8000-000000000001' },
          name: 'file',
        },
      },
    },
    { callout: { props: { icon: '⚠️', backgroundColor: 'yellow' } } },
  ];
  const locale = [
    { paragraph: { props: {}, content: [{ text: { text: 'p' } }] } },
    { heading: { props: {}, content: [{ text: { text: 'h' } }] } },
    { bulletListItem: { props: {}, content: [{ text: { text: 'b' } }] } },
    { numberedListItem: { props: {}, content: [{ text: { text: 'n' } }] } },
    { checkListItem: { props: {}, content: [{ text: { text: 'c' } }] } },
    { quote: { props: {}, content: [{ text: { text: 'q' } }] } },
    { codeBlock: { props: { title: 'code' }, content: 'const value = 1;' } },
    { divider: { props: {} } },
    {
      table: {
        props: {},
        content: {
          rows: [{ rowId: tableRowId, cells: [{ cellId: tableCellId, content: [{ text: { text: 'cell' } }] }] }],
        },
      },
    },
    { p5Sketch: { props: { title: 'p5' } } },
    { threeScene: { props: { title: 'three' } } },
    { shader: { props: { title: 'shader' } } },
    { math: { props: {} } },
    { map: { props: {} } },
    { file: { props: { alt: 'alt', caption: 'caption' } } },
    { callout: { props: {}, content: [{ text: { text: 'notice' } }] } },
  ];
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale: 'ko',
    base: {
      nodes: base.map((block, index) => ({ block: { id: ids[index], ...block }, placement: { index } })),
    },
    localeOverlay: {
      locale: 'ko',
      blocks: locale.map((block, index) => ({ blockId: ids[index], ...block })),
    },
  } as unknown as JsonValue);
}

function textFromRoom(room: Y.Doc, documentType: BlockRoomDocumentType = 'post'): string {
  const document = materializeCanonicalBlockRoom(room, documentType);
  if (document.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
    throw new Error('Expected rich-text document.');
  }
  const value = document.localeOverlay?.blocks[0]?.value;
  return value?.case === 'paragraph' && value.value.content[0]?.value.case === 'text'
    ? value.value.content[0].value.value.text
    : '';
}

describe('PostBlockRoomTiptapController', () => {
  it.each([
    ['Post', 'post', RichTextProfile.POST],
    ['Work', 'work', RichTextProfile.WORK],
    ['Program Event', 'program-event', RichTextProfile.PROGRAM_EVENT],
  ] as const)(
    'mounts an empty %s room with one writable Paragraph and persists its first edit',
    (_, documentType, profile) => {
      const room = new Y.Doc();
      hydrateCanonicalBlockRoom(room, documentType, 'ko', emptyRichTextDocument(profile), []);
      const bridge = createBlockRoomProseMirrorBridge({
        document: room,
        documentType,
        locale: 'ko',
        createId: () => EMPTY_DOCUMENT_BLOCK_ID,
      });
      const controller = createRichTextBlockRoomTiptapController(bridge);
      const initial = controller.initialContent as TestJsonNode;
      const initialBlocks = initial.content?.[0]?.content ?? [];

      expect(initialBlocks).toHaveLength(1);
      expect(initialBlocks[0]).toMatchObject({
        type: 'blockContainer',
        attrs: { id: EMPTY_DOCUMENT_BLOCK_ID },
        content: [{ type: 'paragraph' }],
      });
      expect(materializeCanonicalBlockRoom(room, documentType).base?.nodes).toHaveLength(0);

      const editor = new Editor({
        element: document.createElement('div'),
        extensions: [...createTiptapWireExtensions(), controller.extension],
        content: initial,
      });
      const disconnect = controller.connect(editor);
      const paragraphPosition = nodePosition(editor, 'paragraph');
      editor.commands.setTextSelection(paragraphPosition + 1);
      typeText(editor, 'A');

      expect(textFromRoom(room, documentType)).toBe('A');
      const persisted = materializeCanonicalBlockRoom(room, documentType);
      if (persisted.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
        throw new Error('Expected rich-text document.');
      }
      expect(persisted.base?.nodes[0]?.block?.id).toBe(EMPTY_DOCUMENT_BLOCK_ID);
      editor.commands.deleteRange({ from: paragraphPosition + 1, to: paragraphPosition + 2 });
      expect(textFromRoom(room, documentType)).toBe('');

      disconnect();
      editor.destroy();
    },
  );

  it('keeps consecutive authored empty Paragraph leaves during an unrelated edit', () => {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(room, 'post', 'ko', emptyParagraphLeavesDocument(), []);
    const bridge = createBlockRoomProseMirrorBridge({ document: room, documentType: 'post', locale: 'ko' });
    const before = materializeCanonicalBlockRoom(room, 'post');
    const replaceCollection = vi.spyOn(bridge, 'replaceCollection');
    const deleteCollectionItem = vi.spyOn(bridge, 'deleteCollectionItem');
    const controller = createPostBlockRoomTiptapController(bridge);
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), controller.extension],
      content: controller.initialContent,
    });
    const disconnect = controller.connect(editor);

    const group = editor.state.doc.firstChild;
    expect(group?.childCount).toBe(4);
    expect(group?.content.content.map((container) => container.attrs.id)).toEqual([
      ...EMPTY_PARAGRAPH_IDS,
      FOLLOWING_PARAGRAPH_ID,
    ]);
    for (const container of group?.content.content.slice(0, 3) ?? []) {
      expect(container.firstChild?.type.name).toBe('paragraph');
      expect(container.firstChild?.content.size).toBe(0);
    }

    const positions: number[] = [];
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'paragraph') {
        positions.push(position);
      }
    });
    editor.view.dispatch(editor.state.tr.insertText('!', positions.at(-1)! + 1 + 'unrelated'.length));

    const after = materializeCanonicalBlockRoom(room, 'post');
    if (
      before.$typeName !== 'api.content.v1.LocalizedRichTextDocument' ||
      after.$typeName !== 'api.content.v1.LocalizedRichTextDocument'
    ) {
      throw new Error('Expected Post document.');
    }
    expect(after.base?.nodes.map((node) => node.block?.id)).toEqual([...EMPTY_PARAGRAPH_IDS, FOLLOWING_PARAGRAPH_ID]);
    expect(after.localeOverlay?.blocks.slice(0, 3)).toEqual(before.localeOverlay?.blocks.slice(0, 3));
    const following = after.localeOverlay?.blocks[3]?.value;
    expect(following?.case).toBe('paragraph');
    const followingText = following?.case === 'paragraph' ? following.value.content[0]?.value : undefined;
    expect(followingText?.case === 'text' ? followingText.value.text : undefined).toBe('unrelated!');
    for (const operation of [replaceCollection, deleteCollectionItem]) {
      expect(operation.mock.calls.filter(([target]) => EMPTY_PARAGRAPH_ID_SET.has(target.blockId))).toEqual([]);
    }

    disconnect();
    editor.destroy();
    room.destroy();
  });

  it('persists a ProseMirror text transaction through the typed collaborative text leaf', () => {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(room, 'post', 'ko', postDocument(), []);
    const bridge = createBlockRoomProseMirrorBridge({
      document: room,
      documentType: 'post',
      locale: 'ko',
      origin: 'post-tiptap',
    });
    const controller = createPostBlockRoomTiptapController(bridge);
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), controller.extension],
      content: controller.initialContent,
    });
    const disconnect = controller.connect(editor);

    let textEnd = -1;
    editor.state.doc.descendants((node, position) => {
      if (node.isText) {
        textEnd = position + node.nodeSize;
        return false;
      }
      return true;
    });
    editor.view.dispatch(editor.state.tr.insertText('하세요', textEnd));

    expect(textFromRoom(room)).toBe('안녕하세요');
    expect(controller.getLocalizedDocumentSnapshot()).toMatchObject({
      locale: 'ko',
      localeOverlay: { locale: 'ko' },
    });
    expect(blockRoomUndoDepth(room)).toBe(1);
    expect(pressModZ(editor).defaultPrevented).toBe(true);
    expect(textFromRoom(room)).toBe('안녕');
    disconnect();
    editor.destroy();
  });

  it('persists link text and inline math through their granular collaborative leaves', () => {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(room, 'post', 'ko', postDocument(), []);
    const bridge = createBlockRoomProseMirrorBridge({ document: room, documentType: 'post', locale: 'ko' });
    const controller = createPostBlockRoomTiptapController(bridge);
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), controller.extension],
      content: controller.initialContent,
    });
    const disconnect = controller.connect(editor);
    const initial = editor.getJSON() as TestJsonNode;
    const paragraph = initial.content?.[0]?.content?.[0]?.content?.[0];
    if (!paragraph) {
      throw new Error('Expected Paragraph projection.');
    }
    paragraph.content = [
      { type: 'text', text: 'prefix ' },
      { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
      { type: 'mathInline', content: [{ type: 'text', text: 'x+y' }] },
    ];
    editor.commands.setContent(initial);

    const replaceCollection = vi.spyOn(bridge, 'replaceCollection');
    const next = editor.getJSON() as TestJsonNode;
    const nextParagraph = next.content?.[0]?.content?.[0]?.content?.[0];
    if (!nextParagraph?.content?.[1]?.marks || !nextParagraph.content[2]) {
      throw new Error('Expected inline link and math projection.');
    }
    nextParagraph.content[1].text = 'link updated';
    nextParagraph.content[2].content = [{ type: 'text', text: 'x+y+z' }];
    editor.commands.setContent(next);

    const text = (path: string) =>
      getBlockRoomCollaborativeText(room, { id: BLOCK_ID, family: 'rich_text', locale: true, path }).toString();
    expect(text('content[1].link.content[0].text')).toBe('link updated');
    expect(text('content[2].mathInline.source')).toBe('x+y+z');
    expect(replaceCollection).not.toHaveBeenCalled();

    disconnect();
    editor.destroy();
    room.destroy();
  });

  it('persists a block-start heading shortcut and restores the prior Paragraph with Mod-Z', () => {
    const room = new Y.Doc();
    const source = postDocument();
    const sourceBlock = source.localeOverlay?.blocks[0]?.value;
    if (sourceBlock?.case !== 'paragraph') {
      throw new Error('Expected Paragraph source fixture.');
    }
    sourceBlock.value.content = [];
    hydrateCanonicalBlockRoom(room, 'post', 'ko', source, []);
    const bridge = createBlockRoomProseMirrorBridge({
      document: room,
      documentType: 'post',
      locale: 'ko',
      origin: 'post-tiptap',
    });
    const controller = createPostBlockRoomTiptapController(bridge);
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), controller.extension],
      content: controller.initialContent,
    });
    const disconnect = controller.connect(editor);
    editor.commands.setTextSelection(nodePosition(editor, 'paragraph') + 1);

    typeText(editor, '## ');

    let materialized = materializeCanonicalBlockRoom(room, 'post');
    if (materialized.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
      throw new Error('Expected Post document.');
    }
    expect(materialized.base?.nodes[0]?.block?.value).toMatchObject({
      case: 'heading',
      value: { props: { level: 2 } },
    });
    expect(pressModZ(editor).defaultPrevented).toBe(true);

    materialized = materializeCanonicalBlockRoom(room, 'post');
    if (materialized.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
      throw new Error('Expected Post document.');
    }
    expect(materialized.base?.nodes[0]?.block?.value.case).toBe('paragraph');
    expect(textFromRoom(room)).toBe('');
    disconnect();
    editor.destroy();
  });

  it('projects a remote Block-room text transaction back into ProseMirror', async () => {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(room, 'post', 'ko', postDocument(), []);
    const bridge = createBlockRoomProseMirrorBridge({ document: room, documentType: 'post', locale: 'ko' });
    const controller = createPostBlockRoomTiptapController(bridge);
    let observedText = '';
    const stopObserved = bridge.observe((blocks) => {
      observedText = JSON.stringify(blocks[0]?.localePayload?.content ?? '');
    });
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), controller.extension],
      content: controller.initialContent,
    });
    const disconnect = controller.connect(editor);

    await vi.waitFor(() => expect(controller.connected).toBe(true));
    const text = getBlockRoomCollaborativeText(room, {
      id: BLOCK_ID,
      family: 'rich_text',
      locale: true,
      path: 'content[0].text.text',
    });
    room.transact(() => text.insert(text.length, '!'), 'remote-peer');
    expect(bridge.readBlocks()[0]?.localePayload).toMatchObject({
      content: [{ text: { text: '안녕!' } }],
    });
    expect(observedText).toContain('안녕!');
    expect(paragraphText(controller.initialContent as TestJsonNode)).toBe('안녕!');
    await vi.waitFor(() => {
      expect(paragraphText(editor.getJSON() as TestJsonNode)).toBe('안녕!');
    });
    disconnect();
    stopObserved();
    editor.destroy();
  });

  it('discards a queued room projection after the connected editor is destroyed', async () => {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(room, 'post', 'ko', postDocument(), []);
    const bridge = createBlockRoomProseMirrorBridge({ document: room, documentType: 'post', locale: 'ko' });
    const controller = createPostBlockRoomTiptapController(bridge);
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), controller.extension],
      content: controller.initialContent,
    });
    const disconnect = controller.connect(editor);
    const text = getBlockRoomCollaborativeText(room, {
      id: BLOCK_ID,
      family: 'rich_text',
      locale: true,
      path: 'content[0].text.text',
    });

    room.transact(() => text.insert(text.length, '!'), 'remote-peer');
    editor.destroy();

    await Promise.resolve();
    expect(controller.getLocalizedDocumentSnapshot()).toMatchObject({
      locale: 'ko',
      localeOverlay: { locale: 'ko' },
    });
    disconnect();
  });

  it('normalizes generated enum attributes and persists table cell text through typed collections', () => {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(room, 'post', 'ko', tableDocument(), []);
    const bridge = createBlockRoomProseMirrorBridge({ document: room, documentType: 'post', locale: 'ko' });
    const controller = createPostBlockRoomTiptapController(bridge);
    const initial = controller.initialContent as TestJsonNode;
    const table = initial.content?.[0]?.content?.[0]?.content?.[0];
    const cell = table?.content?.[0]?.content?.[0];
    expect(table?.attrs?.textAlignment).toBe('right');
    expect(cell?.attrs?.textAlignment).toBe('center');

    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), controller.extension],
      content: initial,
    });
    const disconnect = controller.connect(editor);
    const next = editor.getJSON() as TestJsonNode;
    const nextTable = next.content?.[0]?.content?.[0]?.content?.[0];
    const nextCell = nextTable?.content?.[0]?.content?.[0];
    if (!nextTable?.attrs || !nextCell?.attrs || !nextCell.content?.[0]) {
      throw new Error('Expected generated table projection.');
    }
    nextTable.attrs.textAlignment = 'center';
    nextCell.attrs.textAlignment = 'right';
    nextCell.content[0].content = [{ type: 'text', text: 'B' }];
    editor.commands.setContent(next);

    const materialized = materializeCanonicalBlockRoom(room, 'post');
    if (materialized.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
      throw new Error('Expected Post document.');
    }
    const base = materialized.base?.nodes[0]?.block?.value;
    const locale = materialized.localeOverlay?.blocks[0]?.value;
    expect(base?.case === 'table' ? base.value.props?.textAlignment : undefined).toBe(2);
    expect(base?.case === 'table' ? base.value.content?.rows[0]?.cells[0]?.props?.textAlignment : undefined).toBe(3);
    const cellValue = locale?.case === 'table' ? locale.value.content?.rows[0]?.cells[0]?.content[0]?.value : undefined;
    expect(cellValue?.case === 'text' ? cellValue.value.text : undefined).toBe('B');
    disconnect();
    editor.destroy();
  });

  it('projects every generated Post rich-text kind without dropping executable or attachment payloads', () => {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(room, 'post', 'ko', allKindsDocument(), []);
    const allKindsBridge = createBlockRoomProseMirrorBridge({ document: room, documentType: 'post', locale: 'ko' });
    const controller = createPostBlockRoomTiptapController(allKindsBridge);
    const blocks = (controller.initialContent as TestJsonNode).content?.[0]?.content ?? [];
    expect(blocks.map((block) => block.content?.[0]?.type)).toEqual([
      'paragraph',
      'heading',
      'bulletListItem',
      'numberedListItem',
      'checkListItem',
      'quote',
      'codeBlock',
      'divider',
      'table',
      'p5Sketch',
      'threeScene',
      'shader',
      'math',
      'map',
      'file',
      'callout',
    ]);
    expect(blocks[0]?.content?.[0]?.attrs?.textAlignment).toBe('center');
    expect(blocks[9]?.content?.[0]?.content?.[0]?.text).toBe('p5-source');
    expect(blocks[10]?.content?.[0]?.content?.[0]?.text).toBe('three-source');
    expect(blocks[11]?.content?.[0]?.content).toHaveLength(9);
    expect(blocks[14]?.content?.[0]?.attrs?.fileId).toBe('20000000-0000-4000-8000-000000000001');
    expect(blocks[15]?.content?.[0]?.attrs).toMatchObject({ icon: '⚠️', backgroundColor: 'yellow' });
  });

  it('persists executable source leaves for the exhaustive Post document without whole-node replacement', () => {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(room, 'post', 'ko', allKindsDocument(), []);
    const controller = createPostBlockRoomTiptapController(
      createBlockRoomProseMirrorBridge({ document: room, documentType: 'post', locale: 'ko' }),
    );
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), ...executableTestExtensions(), controller.extension],
      content: controller.initialContent,
    });
    const disconnect = controller.connect(editor);
    const next = editor.getJSON() as TestJsonNode;
    const blocks = next.content?.[0]?.content ?? [];
    const p5 = blocks[9]?.content?.[0];
    const shaderImage = blocks[11]?.content?.[0]?.content?.[8];
    if (!p5 || !shaderImage) {
      throw new Error('Expected executable Block projection.');
    }
    p5.content = [{ type: 'text', text: 'p5-next' }];
    shaderImage.content = [{ type: 'text', text: 'image-next' }];
    editor.commands.setContent(next);

    const materialized = materializeCanonicalBlockRoom(room, 'post');
    if (materialized.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
      throw new Error('Expected Post document.');
    }
    const p5Value = materialized.base?.nodes[9]?.block?.value;
    const shaderValue = materialized.base?.nodes[11]?.block?.value;
    expect(p5Value?.case === 'p5Sketch' ? p5Value.value.props?.source : undefined).toBe('p5-next');
    expect(shaderValue?.case === 'shader' ? shaderValue.value.props?.stages[8]?.source : undefined).toBe('image-next');
    disconnect();
    editor.destroy();
  });

  it('routes normalized Map and File captions through catalog collaborative text leaves', () => {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(room, 'post', 'ko', allKindsDocument(), []);
    const bridge = createBlockRoomProseMirrorBridge({ document: room, documentType: 'post', locale: 'ko' });
    const controller = createPostBlockRoomTiptapController(bridge);
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), ...executableTestExtensions(), controller.extension],
      content: controller.initialContent,
    });
    const disconnect = controller.connect(editor);
    const map = bridge.readBlocks().find((block) => block.adapter.kind === 'map');
    const file = bridge.readBlocks().find((block) => block.adapter.kind === 'file');
    if (!map || !file) {
      throw new Error('Expected generated Map and File Blocks.');
    }

    const mapPosition = nodePosition(editor, 'map');
    const initialMapAttributes = editor.state.doc.nodeAt(mapPosition)?.attrs;
    replaceNodeAttributes(editor, 'map', {
      ...initialMapAttributes,
      caption: '첫 번째 지도 설명',
    });
    const mapCaption = {
      id: map.id,
      family: 'rich_text' as const,
      locale: true as const,
      path: 'props.caption',
    };
    expect(getBlockRoomCollaborativeText(room, mapCaption).toString()).toBe('첫 번째 지도 설명');
    expect(() => bridge.getAtomicValue({ blockId: map.id, scope: 'locale', path: 'props.caption' })).toThrow(
      'collaborative_text:props.caption',
    );

    const filePosition = nodePosition(editor, 'file');
    const initialFileAttributes = editor.state.doc.nodeAt(filePosition)?.attrs;
    replaceNodeAttributes(editor, 'file', {
      ...initialFileAttributes,
      caption: '파일 설명',
    });
    expect(
      getBlockRoomCollaborativeText(room, {
        id: file.id,
        family: 'rich_text',
        locale: true,
        path: 'props.caption',
      }).toString(),
    ).toBe('파일 설명');

    replaceNodeAttributes(editor, 'map', {
      ...editor.state.doc.nodeAt(nodePosition(editor, 'map'))?.attrs,
      caption: '첫 번째 지도 설명',
    });
    expect(getBlockRoomCollaborativeText(room, mapCaption).toString()).toBe('첫 번째 지도 설명');

    replaceNodeAttributes(editor, 'map', {
      ...editor.state.doc.nodeAt(nodePosition(editor, 'map'))?.attrs,
      caption: '',
    });
    expect(getBlockRoomCollaborativeText(room, mapCaption).toString()).toBe('');
    const materialized = materializeCanonicalBlockRoom(room, 'post');
    if (materialized.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
      throw new Error('Expected Post document.');
    }
    const localizedMap = materialized.localeOverlay?.blocks.find((block) => block.blockId === map.id)?.value;
    expect(localizedMap?.case === 'map' ? localizedMap.value.props?.caption : undefined).toBe('');

    disconnect();
    editor.destroy();
  });
});
