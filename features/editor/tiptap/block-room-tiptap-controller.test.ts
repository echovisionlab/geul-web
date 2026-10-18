// @vitest-environment jsdom

import { Editor, Extension, Node, type JSONContent } from '@tiptap/core';
import { isLocalAuthorTransaction } from '@/lib/collab/local-author-origin';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection, Plugin } from '@tiptap/pm/state';
import { fromJson, toJson, type JsonValue } from '@bufbuild/protobuf';
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
import type { HocuspocusProvider } from '@hocuspocus/provider';
import type { BlockRoomDurabilityState } from '@/lib/collab/block-room-durability';
import { BlockRoomProtocolClient } from '@/lib/collab/block-room-protocol';
import { hasPendingEditorSaves } from '@/lib/editor/editor-save-registry';
import { createCollaborativeDocumentSaveTracker } from '@/lib/editor/collaborative-document-save';
import { persistCollaborativeDocumentNow } from '@/lib/collab/persist-now';
import { createBlockRoomProseMirrorBridge } from './block-room-prosemirror-bridge';
import {
  createPostBlockRoomTiptapController,
  createRichTextBlockRoomTiptapController,
} from './block-room-tiptap-controller';
import {
  stopCapturingBlockRoomUndo,
  blockRoomUndoDepth,
  redoBlockRoom,
  undoBlockRoom,
} from '@/lib/collab/interactive-mutation-undo';
import { createTiptapWireExtensions } from './wire-schema';
import { allKindsDocument, authoredMathLatex } from './block-room-tiptap-controller.fixtures';
import { SHADER_STAGE_DEFINITIONS } from './shader/shader-program';
import { createTiptapPlaygroundRoom } from './TiptapPlayground.story-fixtures';
import { setShaderNodeMode } from './shader/ShaderNode';

// These controller cases exercise Unicode text directly, without Emoji node lookups.
// Keep the real editor and lazy loader; official Emoji data has its own tests.
vi.mock('./emoji/emoji-data', () => ({
  createTiptapEmojiData: () =>
    ({
      items: [],
      find: () => undefined,
      shortcodeFor: () => undefined,
      regex: () => /(?!)/g,
    }) satisfies import('./emoji/emoji-runtime').TiptapEmojiData,
}));

vi.mock('@/lib/collab/persist-now', () => ({
  persistCollaborativeDocumentNow: vi.fn().mockResolvedValue(undefined),
}));

const persistNow = vi.mocked(persistCollaborativeDocumentNow);

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

// Backslashes and braces must survive every projection unchanged.
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

function currentDurabilityState(document: Y.Doc): BlockRoomDurabilityState {
  const update = Y.decodeUpdate(Y.encodeStateAsUpdate(document));
  return {
    stateVector: Y.encodeStateVector(document),
    deleted: Object.fromEntries(
      [...update.ds.clients.entries()].map(([client, ranges]) => [
        String(client),
        ranges.map(({ clock, len }) => ({ clock, len })),
      ]),
    ),
  };
}

function createReadyPostProtocol(document: Y.Doc, entityId: string): BlockRoomProtocolClient {
  const source = postDocument();
  const payload = JSON.stringify({
    kind: 'room.bootstrap',
    v: 3,
    bootstrapChallenge: 'post-save-boundary',
    documentName: `post:${entityId}:ko`,
    documentType: 'post',
    document: toJson(LocalizedRichTextDocumentSchema, source),
    documentRevision: '22222222-2222-4222-8222-222222222222',
    sourceLocale: 'ko',
    locale: 'ko',
    localeExists: true,
    presentLocaleValues: [],
    sourceMetadata: { locale: 'ko' },
    localeMetadata: { locale: 'ko' },
    documentMetadata: {},
    metadataSequence: 0,
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    serverInstanceId: 'post-save-boundary-server',
    roomEpoch: '33333333-3333-4333-8333-333333333333',
    yjsBootstrapUpdate: Buffer.from(Y.encodeStateAsUpdate(document)).toString('base64'),
  });
  const protocol = new BlockRoomProtocolClient({
    documentType: 'post',
    entityId,
    locale: 'ko',
    document,
    sendStateless: vi.fn(),
    setResumeToken: vi.fn(),
    onBootstrap: vi.fn(),
    onReady: vi.fn(),
    onReloadRequired: vi.fn(),
  });
  protocol.handleStateless(payload);
  protocol.handleProviderSynced();
  protocol.handleStateless(
    JSON.stringify({
      kind: 'room.ready',
      v: 3,
      bootstrapChallenge: 'post-save-boundary',
    }),
  );
  return protocol;
}

function persistedMessage(documentName: string, document: Y.Doc): string {
  const state = currentDurabilityState(document);
  return JSON.stringify({
    kind: 'room.persisted',
    v: 3,
    documentName,
    stateVector: Buffer.from(state.stateVector).toString('base64'),
    deleted: state.deleted,
  });
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

  it('keeps the selected Shader when switching to source mode beside a Mermaid block', async () => {
    const room = createTiptapPlaygroundRoom();
    const mermaid = Node.create({
      name: 'mermaid',
      group: 'blockContent',
      content: 'text*',
      atom: true,
      addAttributes: () => ({ title: { default: '' } }),
      renderHTML: () => ['div', 0],
    });
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), ...executableTestExtensions(), mermaid, room.controller.extension],
      content: room.controller.initialContent,
    });
    const disconnect = room.controller.connect(editor);
    try {
      editor
        .chain()
        .focus('end')
        .insertContent({
          type: 'blockContainer',
          attrs: { id: '10000000-0000-4000-8000-000000000302' },
          content: [
            {
              type: 'shader',
              attrs: { mode: 'preview' },
              content: SHADER_STAGE_DEFINITIONS.map(([, type]) => ({ type })),
            },
          ],
        })
        .run();
      await Promise.resolve();
      editor.commands.setNodeSelection(nodePosition(editor, 'shader'));
      expect((editor.state.selection as NodeSelection).node.type.name).toBe('shader');
      const selectedPosition = editor.state.selection.from;
      expect(setShaderNodeMode(editor, () => selectedPosition, 'source')).toBe(true);
      await Promise.resolve();
      expect(editor.state.selection).toBeInstanceOf(NodeSelection);
      expect((editor.state.selection as NodeSelection).node.type.name).toBe('shader');
      expect(editor.state.selection.$from.parent.attrs.id).toBe('10000000-0000-4000-8000-000000000302');
      expect((editor.state.selection as NodeSelection).node.attrs.mode).toBe('source');

      editor.commands.setNodeSelection(selectedPosition - 1);
      expect(setShaderNodeMode(editor, () => selectedPosition, 'preview')).toBe(true);
      expect(editor.state.selection).toBeInstanceOf(NodeSelection);
      expect((editor.state.selection as NodeSelection).node.type.name).toBe('blockContainer');
      expect((editor.state.selection as NodeSelection).node.attrs.id).toBe('10000000-0000-4000-8000-000000000302');

      editor.commands.setNodeSelection(nodePosition(editor, 'mermaid'));
      expect(setShaderNodeMode(editor, () => selectedPosition, 'edit')).toBe(true);
      expect((editor.state.selection as NodeSelection).node.type.name).toBe('mermaid');

      editor.commands.setTextSelection(nodePosition(editor, 'paragraph') + 1);
      const textSelection = editor.state.selection.toJSON();
      expect(setShaderNodeMode(editor, () => selectedPosition, 'source')).toBe(true);
      expect(editor.state.selection.toJSON()).toEqual(textSelection);
    } finally {
      disconnect();
      editor.destroy();
      room.awareness.destroy();
      room.document.destroy();
    }
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
    const mathValue = materialized.base?.nodes[12]?.block?.value;
    expect(mathValue?.case === 'math' ? mathValue.value.props?.latex : undefined).toBe(authoredMathLatex);
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

  it('tracks Return and text input through peer deletion until the Post room ACK covers the emitted Yjs updates', async () => {
    const entityId = '22222222-2222-4222-8222-222222222222';
    const documentName = `post:${entityId}:ko`;
    const seedRoom = new Y.Doc();
    const bRoom = new Y.Doc();
    const aRoom = new Y.Doc();
    const serverRoom = new Y.Doc();
    hydrateCanonicalBlockRoom(seedRoom, 'post', 'ko', postDocument(), []);
    const bootstrapUpdate = Y.encodeStateAsUpdate(seedRoom);
    Y.applyUpdate(bRoom, bootstrapUpdate);
    Y.applyUpdate(aRoom, bootstrapUpdate);
    Y.applyUpdate(serverRoom, bootstrapUpdate);
    const initialPersistedState = currentDurabilityState(serverRoom);
    const protocol = createReadyPostProtocol(bRoom, entityId);
    const provider = { document: bRoom, on: vi.fn(), off: vi.fn() } as unknown as HocuspocusProvider;
    const tracker = createCollaborativeDocumentSaveTracker(provider, { kind: 'block-room', protocol });
    const unregisterSave = tracker.register(`post:${entityId}`);
    const bBridge = createBlockRoomProseMirrorBridge({ document: bRoom, documentType: 'post', locale: 'ko' });
    const bController = createPostBlockRoomTiptapController(bBridge);
    const bEditor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), bController.extension],
      content: bController.initialContent,
    });
    const disconnectB = bController.connect(bEditor);
    const bUpdates: Uint8Array[] = [];
    const captureBUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === bBridge.transactionOrigin) {
        bUpdates.push(Uint8Array.from(update));
      }
    };
    bRoom.on('update', captureBUpdate);

    const textEnd = nodePosition(bEditor, 'paragraph') + 1 + '안녕'.length;
    bEditor.commands.setTextSelection(textEnd);
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    bEditor.view.dom.dispatchEvent(enter);
    typeText(bEditor, 'local-marker');
    expect(enter.defaultPrevented).toBe(true);

    const bDocument = materializeCanonicalBlockRoom(bRoom, 'post');
    if (bDocument.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
      throw new Error('Expected Post document.');
    }
    expect(bDocument.base?.nodes).toHaveLength(2);
    const peerDeletedBlockId = bDocument.base?.nodes[1]?.block?.id;
    expect(peerDeletedBlockId).toBeTruthy();
    expect(bUpdates.length).toBeGreaterThan(0);
    expect(tracker.hasPending()).toBe(true);
    expect(hasPendingEditorSaves(`post:${entityId}`)).toBe(true);

    const localStateVector = Y.decodeStateVector(Y.encodeStateVector(bRoom));
    for (const update of bUpdates) {
      Y.applyUpdate(aRoom, update, 'B-to-A');
      Y.applyUpdate(serverRoom, update, 'B-to-server');
    }
    const serverAfterBVector = Y.decodeStateVector(Y.encodeStateVector(serverRoom));
    expect(serverAfterBVector.get(bRoom.clientID)).toBe(localStateVector.get(bRoom.clientID));

    const aBridge = createBlockRoomProseMirrorBridge({ document: aRoom, documentType: 'post', locale: 'ko' });
    const aController = createPostBlockRoomTiptapController(aBridge);
    const aEditor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), aController.extension],
      content: aController.initialContent,
    });
    const disconnectA = aController.connect(aEditor);
    const aUpdates: Uint8Array[] = [];
    const captureAUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === aBridge.transactionOrigin) {
        aUpdates.push(Uint8Array.from(update));
      }
    };
    aRoom.on('update', captureAUpdate);
    const aDocument = aEditor.getJSON() as TestJsonNode;
    const aBlockGroup = aDocument.content?.[0];
    if (!aBlockGroup?.content) {
      throw new Error('Expected Post Block group.');
    }
    aBlockGroup.content = aBlockGroup.content.filter((block) => block.attrs?.id !== peerDeletedBlockId);
    aEditor.commands.setContent(aDocument as JSONContent);
    expect(aUpdates.length).toBeGreaterThan(0);

    const bLocalUpdateCount = bUpdates.length;
    for (const update of aUpdates) {
      Y.applyUpdate(serverRoom, update, 'A-to-server');
      Y.applyUpdate(bRoom, update, provider);
    }
    await vi.waitFor(() => expect(bEditor.state.doc.firstChild?.childCount).toBe(1));
    const bAfterPeerDelete = materializeCanonicalBlockRoom(bRoom, 'post');
    if (bAfterPeerDelete.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
      throw new Error('Expected Post document.');
    }
    expect(bAfterPeerDelete.base?.nodes.map((node) => node.block?.id)).toEqual([BLOCK_ID]);
    expect(bUpdates).toHaveLength(bLocalUpdateCount);
    expect(tracker.hasPending()).toBe(true);

    persistNow.mockClear();
    const flushing = tracker.flush();
    await Promise.resolve();
    expect(persistNow).toHaveBeenCalledOnce();
    protocol.handleStateless(
      JSON.stringify({
        kind: 'room.persisted',
        v: 3,
        documentName,
        stateVector: Buffer.from(initialPersistedState.stateVector).toString('base64'),
        deleted: initialPersistedState.deleted,
      }),
    );
    expect(tracker.hasPending()).toBe(true);
    protocol.handleStateless(persistedMessage(documentName, serverRoom));
    await expect(flushing).resolves.toBe(true);
    expect(tracker.hasPending()).toBe(false);
    expect(hasPendingEditorSaves(`post:${entityId}`)).toBe(false);

    bRoom.off('update', captureBUpdate);
    aRoom.off('update', captureAUpdate);
    disconnectA();
    aEditor.destroy();
    disconnectB();
    bEditor.destroy();
    unregisterSave();
    protocol.destroy();
    seedRoom.destroy();
    bRoom.destroy();
    aRoom.destroy();
    serverRoom.destroy();
  });
});

function performanceBoundaryFixture(nested = false) {
  const ids = [BLOCK_ID, FOLLOWING_PARAGRAPH_ID, EMPTY_DOCUMENT_BLOCK_ID];
  const source = fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale: 'ko',
    base: {
      nodes: ids.map((id, index) => ({
        block: { id, paragraph: { props: {} } },
        placement:
          nested && index === 1 ? { parentBlockId: ids[0], index: 0 } : { index: nested && index === 2 ? 1 : index },
      })),
    },
    localeOverlay: {
      locale: 'ko',
      blocks: ids.map((blockId, index) => ({
        blockId,
        paragraph: { props: {}, content: [{ text: { text: `text${index}` } }] },
      })),
    },
  } as JsonValue);
  const room = new Y.Doc();
  hydrateCanonicalBlockRoom(room, 'post', 'ko', source, []);
  const bridge = createBlockRoomProseMirrorBridge({ document: room, documentType: 'post', locale: 'ko' });
  const controller = createPostBlockRoomTiptapController(bridge);
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [...createTiptapWireExtensions(), controller.extension],
    content: controller.initialContent,
  });
  const disconnect = controller.connect(editor);
  const position = (id: string) => {
    let result = -1;
    editor.state.doc.descendants((node, at) => {
      if (node.type.name === 'blockContainer' && node.attrs.id === id) {
        result = at + 2;
      }
    });
    if (result < 0) {
      throw new Error('Missing fixture Block.');
    }
    return result;
  };
  const text = (id: string) =>
    getBlockRoomCollaborativeText(room, {
      id,
      family: 'rich_text',
      locale: true,
      path: 'content[0].text.text',
    }).toString();
  return {
    ids,
    room,
    bridge,
    controller,
    editor,
    position,
    text,
    cleanup: () => {
      disconnect();
      editor.destroy();
      room.destroy();
    },
  };
}

describe('incremental Block-room input boundaries', () => {
  it('deletes one selected variable atom and restores it through the production room undo', async () => {
    const fixture = performanceBoundaryFixture();
    try {
      const at = fixture.position(fixture.ids[1]!);
      fixture.editor.view.dispatch(
        fixture.editor.state.tr.insert(
          at,
          fixture.editor.schema.nodes.siteVariable!.create({ key: 'contact.email', linked: true }),
        ),
      );
      stopCapturingBlockRoomUndo(fixture.room);
      fixture.editor.commands.setNodeSelection(at);
      expect(fixture.editor.state.selection).toBeInstanceOf(NodeSelection);
      expect(fixture.editor.commands.keyboardShortcut('Backspace')).toBe(true);
      expect(fixture.editor.state.doc.nodeAt(at)?.type.name).toBe('text');
      expect(undoBlockRoom(fixture.room)).toBe(true);
      await Promise.resolve();
      expect(fixture.editor.state.doc.nodeAt(at)?.type.name).toBe('siteVariable');
      expect(fixture.editor.state.doc.nodeAt(at)?.attrs).toMatchObject({ key: 'contact.email', linked: true });
      fixture.editor.storage.siteVariable.context = {
        siteTitle: 'rawsector',
        siteUrl: '',
        companyName: '',
        legalEmail: '',
        contactEmail: 'help@example.com',
      };
      expect(fixture.editor.getText()).toContain('help@example.com');
      fixture.editor.commands.setNodeSelection(at);
      const copied = fixture.editor.view.someProp('clipboardTextSerializer', (serialize) =>
        serialize(fixture.editor.state.selection.content(), fixture.editor.view),
      );
      expect(copied).toBe('help@example.com');
      expect(fixture.editor.getHTML()).toContain('data-site-variable="contact.email"');
      expect(fixture.editor.getHTML()).toContain('href="mailto:help@example.com"');
    } finally {
      fixture.cleanup();
    }
  });

  it.each([false, true])(
    'writes only the changed payload with nested topology=%s and retains undo/redo',
    async (nested) => {
      const fixture = performanceBoundaryFixture(nested);
      const serialize = vi.spyOn(ProseMirrorNode.prototype, 'toJSON');
      const reconcileText = vi.spyOn(fixture.bridge, 'reconcileInlineContent');
      try {
        const changedId = fixture.ids[1]!;
        const from = fixture.position(changedId);
        fixture.editor.view.dispatch(fixture.editor.state.tr.insertText('!', from));
        expect(fixture.text(changedId)).toBe('!text1');
        expect(fixture.text(fixture.ids[0]!)).toBe('text0');
        expect(fixture.text(fixture.ids[2]!)).toBe('text2');
        expect(
          serialize.mock.contexts.filter((node) => node instanceof ProseMirrorNode && node.type.name === 'doc'),
        ).toHaveLength(0);
        expect(reconcileText.mock.calls.map(([target]) => target.blockId)).toEqual([changedId]);
        expect(undoBlockRoom(fixture.room)).toBe(true);
        await Promise.resolve();
        expect(fixture.text(changedId)).toBe('text1');
        expect(redoBlockRoom(fixture.room)).toBe(true);
        await Promise.resolve();
        expect(fixture.text(changedId)).toBe('!text1');
        expect(fixture.editor.getText()).toContain('!text1');
      } finally {
        serialize.mockRestore();
        fixture.cleanup();
      }
    },
  );

  it('retains a pending remote change in another Block during immediate local typing', async () => {
    const fixture = performanceBoundaryFixture();
    try {
      const remoteId = fixture.ids[2]!;
      const text = getBlockRoomCollaborativeText(fixture.room, {
        id: remoteId,
        family: 'rich_text',
        locale: true,
        path: 'content[0].text.text',
      });
      fixture.room.transact(() => text.insert(0, 'remote-'), 'remote-peer');
      fixture.editor.view.dispatch(fixture.editor.state.tr.insertText('local-', fixture.position(fixture.ids[0]!)));
      await Promise.resolve();
      expect(fixture.text(remoteId)).toBe('remote-text2');
      expect(fixture.text(fixture.ids[0]!)).toBe('local-text0');
      expect(fixture.editor.getText()).toContain('remote-text2');
    } finally {
      fixture.cleanup();
    }
  });

  it('keeps reordered/deleted Blocks and subsequent payload edits synchronized', async () => {
    const fixture = performanceBoundaryFixture();
    try {
      const value = fixture.editor.getJSON();
      const containers = value.content![0]!.content!;
      value.content![0]!.content = [containers[2]!, containers[0]!];
      fixture.editor.commands.setContent(value);
      const materialized = fixture.controller.getLocalizedDocumentSnapshot();
      expect(fixture.bridge.readBlocks().map((block) => block.id)).toEqual([fixture.ids[2], fixture.ids[0]]);
      expect(materialized.localeOverlay?.blocks.map((block) => block.blockId).sort()).toEqual(
        [fixture.ids[0], fixture.ids[2]].sort(),
      );
      fixture.editor.view.dispatch(fixture.editor.state.tr.insertText('!', fixture.position(fixture.ids[2]!)));
      expect(fixture.text(fixture.ids[2]!)).toBe('!text2');
      expect(undoBlockRoom(fixture.room)).toBe(true);
      await Promise.resolve();
      expect(fixture.bridge.readBlocks().map((block) => block.id)).toEqual(fixture.ids);
    } finally {
      fixture.cleanup();
    }
  });

  it('inserts a localized Block at its requested order with a relative anchor', () => {
    const fixture = performanceBoundaryFixture();
    const insertedId = '10000000-0000-4000-8000-000000000189';
    const createAnchor = vi.spyOn(fixture.bridge, 'createInsertionAnchor');
    try {
      const document = fixture.editor.getJSON() as TestJsonNode;
      document.content![0]!.content!.splice(1, 0, {
        type: 'blockContainer',
        attrs: { id: insertedId },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Added locale payload' }] }],
      });

      fixture.editor.commands.setContent(document as JSONContent);

      expect(createAnchor).toHaveBeenCalledExactlyOnceWith({ parentBlockId: undefined, index: 1 });
      expect(fixture.bridge.readBlocks().map((block) => block.id)).toEqual([
        fixture.ids[0],
        insertedId,
        fixture.ids[1],
        fixture.ids[2],
      ]);
      expect(fixture.text(insertedId)).toBe('Added locale payload');
    } finally {
      createAnchor.mockRestore();
      fixture.cleanup();
    }
  });

  it('replaces an existing Block kind atomically and retains structural undo/redo', async () => {
    const fixture = performanceBoundaryFixture();
    try {
      const document = fixture.editor.getJSON() as TestJsonNode;
      const first = document.content![0]!.content![0]!;
      first.content![0] = {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Converted heading' }],
      };

      fixture.editor.commands.setContent(document as JSONContent);
      expect(fixture.bridge.readBlocks()[0]?.adapter.kind).toBe('heading');

      expect(undoBlockRoom(fixture.room)).toBe(true);
      await Promise.resolve();
      expect(fixture.bridge.readBlocks()[0]?.adapter.kind).toBe('paragraph');
      const undone = fixture.editor.getJSON() as TestJsonNode;
      expect(undone.content?.[0]?.content?.[0]?.attrs?.id).toBe(fixture.ids[0]);
      expect(undone.content?.[0]?.content?.[0]?.content?.[0]?.type).toBe('paragraph');

      expect(redoBlockRoom(fixture.room)).toBe(true);
      await Promise.resolve();
      expect(fixture.bridge.readBlocks()[0]?.adapter.kind).toBe('heading');
    } finally {
      fixture.cleanup();
    }
  });

  it('persists plugin-appended document changes after a selection-only transaction', () => {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(room, 'post', 'ko', postDocument(), []);
    const bridge = createBlockRoomProseMirrorBridge({ document: room, documentType: 'post', locale: 'ko' });
    const controller = createPostBlockRoomTiptapController(bridge);
    const append = Extension.create({
      name: 'testAppendedBody',
      addProseMirrorPlugins: () => [
        new Plugin({
          appendTransaction: (transactions, _old, state) =>
            transactions.some((transaction) => transaction.getMeta('appendBody')) ? state.tr.insertText('!', 3) : null,
        }),
      ],
    });
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), append, controller.extension],
      content: controller.initialContent,
    });
    const disconnect = controller.connect(editor);
    try {
      editor.view.dispatch(editor.state.tr.setMeta('appendBody', true));
      expect(editor.getText().trim()).toBe('!안녕');
      expect(textFromRoom(room)).toBe('!안녕');
    } finally {
      disconnect();
      editor.destroy();
      room.destroy();
    }
  });
});

describe('remote projection and composition', () => {
  it.each([0, 2])(
    'merges Korean composition with a concurrent edit in block %s and undoes only local input',
    async (remoteIndex) => {
      const f = performanceBoundaryFixture();
      const peer = new Y.Doc();
      Y.applyUpdate(peer, Y.encodeStateAsUpdate(f.room));
      let projections = 0;
      f.editor.on('transaction', ({ transaction }) => {
        if (transaction.getMeta('blockRoomProjection')) {
          projections++;
        }
      });
      try {
        f.editor.commands.setTextSelection(f.position(f.ids[0]!) + 2);
        f.editor.view.dom.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        f.editor.view.dispatch(f.editor.state.tr.insertText('ㅎ'));
        expect(f.text(f.ids[0]!)).toContain('ㅎ');
        const text = getBlockRoomCollaborativeText(peer, {
          id: f.ids[remoteIndex]!,
          family: 'rich_text',
          locale: true,
          path: 'content[0].text.text',
        });
        peer.transact(() => text.insert(0, 'REMOTE'), 'peer');
        Y.applyUpdate(f.room, Y.encodeStateAsUpdate(peer), 'peer');
        expect(projections).toBe(0);
        const at = f.editor.state.selection.from;
        f.editor.view.dispatch(f.editor.state.tr.insertText('한', at - 1, at));
        expect(f.text(f.ids[0]!)).toContain('한');
        expect(f.text(f.ids[remoteIndex]!)).toContain('REMOTE');
        f.editor.view.dom.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
        await vi.waitFor(() => expect(projections).toBe(1));
        const full = createPostBlockRoomTiptapController(f.bridge).initialContent;
        expect(f.editor.state.doc.eq(f.editor.schema.nodeFromJSON(full))).toBe(true);
        expect(undoBlockRoom(f.room)).toBe(true);
        expect(f.text(f.ids[0]!)).not.toContain('한');
        expect(f.text(f.ids[remoteIndex]!)).toContain('REMOTE');
        expect(redoBlockRoom(f.room)).toBe(true);
        expect(f.text(f.ids[0]!)).toContain('한');
      } finally {
        peer.destroy();
        f.cleanup();
      }
    },
  );

  it('connects before the view mounts, then attaches and projects remote changes on mount', () => {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(room, 'post', 'ko', postDocument(), []);
    const bridge = createBlockRoomProseMirrorBridge({ document: room, documentType: 'post', locale: 'ko' });
    const controller = createPostBlockRoomTiptapController(bridge);
    const editor = new Editor({
      element: null,
      extensions: [...createTiptapWireExtensions(), controller.extension],
      content: controller.initialContent,
    });
    let disconnect: (() => void) | undefined;
    try {
      expect(() => {
        disconnect = controller.connect(editor);
      }).not.toThrow();
      const peer = new Y.Doc();
      Y.applyUpdate(peer, Y.encodeStateAsUpdate(room));
      const id = bridge.readBlocks()[0]!.id;
      peer.transact(
        () =>
          getBlockRoomCollaborativeText(peer, {
            id,
            family: 'rich_text',
            locale: true,
            path: 'content[0].text.text',
          }).insert(0, 'REMOTE'),
        'peer',
      );
      expect(() => Y.applyUpdate(room, Y.encodeStateAsUpdate(peer), 'peer')).not.toThrow();
      editor.mount(document.createElement('div'));
      expect(editor.getText()).toContain('REMOTE');
      peer.destroy();
    } finally {
      disconnect?.();
      editor.destroy();
      room.destroy();
    }
  });

  it('reports composition edits as local author intent for the journal and save tracker', () => {
    const f = performanceBoundaryFixture();
    const authored: boolean[] = [];
    const listener = (transaction: Y.Transaction) => {
      if (transaction.changed.size > 0) {
        authored.push(isLocalAuthorTransaction(transaction));
      }
    };
    f.room.on('afterTransaction', listener);
    try {
      f.editor.commands.setTextSelection(f.position(f.ids[0]!) + 2);
      f.editor.view.dom.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      f.editor.view.dispatch(f.editor.state.tr.insertText('ㅎ'));
      const at = f.editor.state.selection.from;
      f.editor.view.dispatch(f.editor.state.tr.insertText('한', at - 1, at));
      expect(f.text(f.ids[0]!)).toContain('한');
      expect(authored.length).toBeGreaterThan(0);
      expect(authored.every(Boolean)).toBe(true);
    } finally {
      f.room.off('afterTransaction', listener);
      f.cleanup();
    }
  });

  it.each([false, true])('matches full projection for text, marks, attributes and structure (nested=%s)', (nested) => {
    const f = performanceBoundaryFixture(nested);
    const parity = () =>
      expect(
        f.editor.state.doc.eq(
          f.editor.schema.nodeFromJSON(createPostBlockRoomTiptapController(f.bridge).initialContent),
        ),
      ).toBe(true);
    try {
      const text = getBlockRoomCollaborativeText(f.room, {
        id: f.ids[1]!,
        family: 'rich_text',
        locale: true,
        path: 'content[0].text.text',
      });
      f.room.transact(() => {
        text.insert(2, '한😀');
        text.format(1, 3, { bold: true });
      }, 'peer');
      parity();
      f.bridge.setAtomicValue({ blockId: f.ids[1]!, scope: 'base', path: 'props.textAlignment' }, 2);
      parity();
      expect(f.controller.projectionStats.full).toBe(0);
      expect(f.controller.projectionStats.projectedBlocks).toBe(2);
      f.bridge.moveBlock(f.ids[2]!, { index: 0 });
      parity();
      expect(f.controller.projectionStats.full).toBe(1);
      f.bridge.deleteBlock(f.ids[1]!);
      parity();
    } finally {
      f.cleanup();
    }
  });
});
