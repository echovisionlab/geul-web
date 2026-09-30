// @vitest-environment jsdom
import { Editor, type JSONContent } from '@tiptap/core';
import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  LocalizedPageDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  getBlockRoomCollaborativeText,
  hydrateCanonicalBlockRoom,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createBlockRoomProseMirrorBridge } from './block-room-prosemirror-bridge';
import { createPostBlockRoomTiptapController } from './block-room-tiptap-controller';
import { createTiptapWireExtensions } from './wire-schema';
interface TestJsonNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: JSONContent['marks'];
  content?: TestJsonNode[];
}
const BLOCK_ID = '019cce25-dbc0-7d12-9f1f-735b1a6c6b13';
const EMPTY_DOCUMENT_BLOCK_ID = '10000000-0000-4000-8000-000000000180';
const FOLLOWING_PARAGRAPH_ID = '10000000-0000-4000-8000-000000000184';
function performanceBoundaryFixture(nested = false, existingRoom?: Y.Doc, documentType: 'post' | 'page' = 'post') {
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
  const room = existingRoom ?? new Y.Doc();
  if (!existingRoom) {
    hydrateCanonicalBlockRoom(
      room,
      documentType,
      'ko',
      documentType === 'post'
        ? source
        : fromJson(LocalizedPageDocumentSchema, {
            blockCatalogFingerprint: contentBlockCatalogFingerprint,
            locale: 'ko',
            base: {
              nodes: [
                {
                  section: {
                    id: '10000000-0000-4000-8000-000000009000',
                    settings: {},
                    richText: {
                      props: {},
                      blocks: {
                        nodes: ids.map((id, index) => ({
                          block: { id, paragraph: { props: {} } },
                          placement: { index },
                        })),
                      },
                    },
                  },
                  placement: { index: 0 },
                },
              ],
            },
            localeOverlay: {
              locale: 'ko',
              sections: [
                {
                  sectionId: '10000000-0000-4000-8000-000000009000',
                  richText: {
                    props: {},
                    blocks: {
                      locale: 'ko',
                      blocks: ids.map((blockId, index) => ({
                        blockId,
                        paragraph: { props: {}, content: [{ text: { text: `text${index}` } }] },
                      })),
                    },
                  },
                },
              ],
            },
          } as JsonValue),
      [],
    );
  }
  const bridge = createBlockRoomProseMirrorBridge({
    document: room,
    documentType,
    locale: 'ko',
    ...(documentType === 'page' ? { pageSectionId: '10000000-0000-4000-8000-000000009000' } : {}),
  });
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

describe('immediate remote projection and structural edits', () => {
  it('retains remote text in the same Block before local typing', async () => {
    const f = performanceBoundaryFixture();
    try {
      const id = f.ids[0]!;
      const text = getBlockRoomCollaborativeText(f.room, {
        id,
        family: 'rich_text',
        locale: true,
        path: 'content[0].text.text',
      });
      f.room.transact(() => text.insert(0, 'remote-'), 'remote-peer');
      f.editor.view.dispatch(f.editor.state.tr.insertText('local-', f.position(id)));
      await Promise.resolve();
      expect(f.text(id)).toContain('remote-');
      expect(f.text(id)).toContain('local-');
    } finally {
      f.cleanup();
    }
  });
  it('retains remote text in another Block during local structural edit', async () => {
    const f = performanceBoundaryFixture();
    try {
      const id = f.ids[2]!;
      const text = getBlockRoomCollaborativeText(f.room, {
        id,
        family: 'rich_text',
        locale: true,
        path: 'content[0].text.text',
      });
      f.room.transact(() => text.insert(0, 'remote-'), 'remote-peer');
      const value = f.editor.getJSON() as TestJsonNode;
      const blocks = value.content![0]!.content!;
      value.content![0]!.content = [blocks[1]!, blocks[0]!, blocks[2]!];
      f.editor.commands.setContent(value);
      await Promise.resolve();
      expect(f.text(id)).toBe('remote-text2');
    } finally {
      f.cleanup();
    }
  });
  it('retains promoted child when deleting its parent in one structural edit', async () => {
    const f = performanceBoundaryFixture(true);
    try {
      const value = f.editor.getJSON() as TestJsonNode;
      const blocks = value.content![0]!.content!;
      const child = blocks[0]!.content![1]!.content![0]!;
      value.content![0]!.content = [child, blocks[1]!];
      expect(() => f.editor.commands.setContent(value)).not.toThrow();
      expect(f.bridge.readBlocks().map((b) => b.id)).toEqual([f.ids[1], f.ids[2]]);
    } finally {
      f.cleanup();
    }
  });
});

describe('concurrent rich text formatting', () => {
  it.each([
    { documentType: 'post', partial: false },
    { documentType: 'page', partial: false },
    { documentType: 'post', partial: true },
    { documentType: 'page', partial: true },
  ] as const)('keeps concurrent typing with $documentType partial=$partial', async ({ documentType, partial }) => {
    const a = performanceBoundaryFixture(false, undefined, documentType);
    const roomB = new Y.Doc();
    Y.applyUpdate(roomB, Y.encodeStateAsUpdate(a.room));
    const b = performanceBoundaryFixture(false, roomB, documentType);
    try {
      const id = a.ids[0]!;
      a.editor.view.dispatch(a.editor.state.tr.insertText('remote-', a.position(id)));
      const from = b.position(id);
      b.editor.commands.setTextSelection({ from: from + (partial ? 1 : 0), to: from + (partial ? 4 : 5) });
      b.editor.commands.toggleMark('bold');
      expect(a.editor.getText()).toContain('remote-text0');
      expect(
        (b.editor.getJSON() as TestJsonNode).content![0]!.content![0]!.content![0]!.content!.some((node) =>
          node.marks?.some((mark) => mark.type === 'bold'),
        ),
      ).toBe(true);
      const updateA = Y.encodeStateAsUpdate(a.room);
      const updateB = Y.encodeStateAsUpdate(b.room);
      Y.applyUpdate(a.room, updateB, 'remote-peer');
      Y.applyUpdate(b.room, updateA, 'remote-peer');
      await Promise.resolve();
      expect.soft(a.editor.getText()).toContain('remote-text0');
      expect.soft(b.editor.getText()).toContain('remote-text0');
      expect(a.editor.getJSON()).toEqual(b.editor.getJSON());
      b.editor.view.dispatch(
        b.editor.state.tr.insertText(
          '!',
          b.position(id) + b.editor.state.doc.nodeAt(b.position(id) - 1)!.textContent.length,
        ),
      );
      Y.applyUpdate(a.room, Y.encodeStateAsUpdate(b.room), 'remote-peer');
      expect(a.editor.getJSON()).toEqual(b.editor.getJSON());
      expect(a.editor.getText()).toContain('remote-text0!');
    } finally {
      a.cleanup();
      b.cleanup();
    }
  });
});
