// @vitest-environment jsdom

import { Editor, type JSONContent } from '@tiptap/core';
import { fromJson, toJson, type JsonValue } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  LocalizedPageDocumentSchema,
  RichTextProfile,
  type LocalizedRichTextDocument,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  hydrateCanonicalBlockRoom,
  materializeCanonicalBlockRoom,
  type RichTextBlockRoomDocumentType,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createBlockRoomProseMirrorBridge } from './block-room-prosemirror-bridge';
import { createRichTextBlockRoomTiptapController } from './block-room-tiptap-controller';
import { createMarkdownPasteExtension } from './markdown-paste';
import { createTiptapWireExtensions } from './wire-schema';
import { createCompactTiptapExtensions } from './profiles/CompactTiptapEditor';

const ids = ['10000000-0000-4000-8000-000000000111', '10000000-0000-4000-8000-000000000112'];
const cases = [
  ['post', RichTextProfile.POST],
  ['work', RichTextProfile.WORK],
  ['program-event', RichTextProfile.PROGRAM_EVENT],
  ['campaign', RichTextProfile.EMAIL],
  ['email-template', RichTextProfile.EMAIL],
  ['artist', RichTextProfile.COMPACT],
  ['terms-history', RichTextProfile.POLICY],
] as const;

function subject(documentType: RichTextBlockRoomDocumentType, profile: RichTextProfile, text = 'a') {
  const room = new Y.Doc();
  hydrateCanonicalBlockRoom(
    room,
    documentType,
    'en',
    fromJson(LocalizedRichTextDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      profile,
      locale: 'en',
      base: { nodes: ids.map((id, index) => ({ block: { id, paragraph: { props: {} } }, placement: { index } })) },
      localeOverlay: {
        locale: 'en',
        blocks: ids.map((blockId, index) => ({
          blockId,
          paragraph: { props: {}, content: [{ text: { text: index ? 'other' : text } }] },
        })),
      },
    }),
    [],
  );
  const bridge = createBlockRoomProseMirrorBridge({ document: room, documentType, locale: 'en' });
  const controller = createRichTextBlockRoomTiptapController(bridge);
  const extensions =
    profile === RichTextProfile.COMPACT ? createCompactTiptapExtensions('') : createTiptapWireExtensions();
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [
      ...extensions,
      ...(profile === RichTextProfile.COMPACT
        ? []
        : [createMarkdownPasteExtension(() => controller.canChangeStructure)]),
      controller.extension,
    ],
    content: controller.initialContent,
  });
  const disconnect = controller.connect(editor);
  const raw = () => {
    const locales = room.getMap('block-document').get('localeOverlay') as Y.Map<Y.Map<unknown>>;
    return (locales.get(ids[0]!)!.get('payload') as Y.Map<unknown>).get('content') as Y.Array<unknown>;
  };
  return {
    room,
    bridge,
    controller,
    editor,
    raw,
    close: () => {
      disconnect();
      editor.destroy();
      room.destroy();
    },
  };
}

function position(editor: Editor, blockId: string): number {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'blockContainer' && node.attrs.id === blockId) {
      found = pos + 2;
      return false;
    }
    return true;
  });
  return found;
}

function persisted(room: Y.Doc, documentType: RichTextBlockRoomDocumentType): JsonValue {
  return toJson(
    LocalizedRichTextDocumentSchema,
    materializeCanonicalBlockRoom(room, documentType) as LocalizedRichTextDocument,
  );
}

describe('line-break persistence through the live controller', () => {
  it.each(cases)('%s Shift+Enter stores hardBreak, while Enter creates a separate block', (kind, profile) => {
    const s = subject(kind, profile);
    s.editor.commands.setTextSelection(position(s.editor, ids[0]!) + 1);
    s.editor.commands.toggleMark('bold');
    s.editor.view.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }),
    );
    s.editor.commands.insertContent('b');
    expect(s.raw().toJSON()).toMatchObject([{ text: { text: 'a' } }, { hardBreak: {} }, { text: { text: 'b' } }]);
    expect(JSON.stringify(s.raw().toJSON())).not.toMatch(/\\[nr]/);
    expect(
      s.editor.state.doc.firstChild!.firstChild!.firstChild!.content.content.map((node) => node.type.name),
    ).toEqual(['text', 'hardBreak', 'text']);
    expect(s.editor.state.doc.firstChild!.firstChild!.firstChild!.child(1).marks).toEqual([]);
    s.editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(s.bridge.readBlocks()).toHaveLength(3);
    s.close();
  });

  it.each(cases)('%s paste keeps GitHub paragraph boundaries through reopening the Block room', (kind, profile) => {
    const s = subject(kind, profile);
    s.editor.commands.setTextSelection({ from: position(s.editor, ids[0]!), to: position(s.editor, ids[0]!) + 1 });
    s.editor.view.pasteText('a\nb\n\nc', new Event('paste') as ClipboardEvent);
    expect(s.raw().toJSON()).toEqual([{ text: { text: 'a' } }, { hardBreak: {} }, { text: { text: 'b' } }]);
    const expected = s.editor.getJSON();
    const reopened = new Editor({
      extensions:
        profile === RichTextProfile.COMPACT ? createCompactTiptapExtensions('') : createTiptapWireExtensions(),
      content: s.controller.initialContent,
    });
    expect(reopened.getJSON()).toEqual(expected);
    expect(s.bridge.readBlocks()).toHaveLength(3);
    reopened.destroy();
    s.close();
  });

  it('round trips exact schema JSON with leading, trailing, consecutive breaks, styled links and adjacent atoms', () => {
    const s = subject('post', RichTextProfile.POST);
    const doc: JSONContent = s.editor.getJSON();
    doc.content![0]!.content![0]!.content![0]!.content = [
      { type: 'hardBreak' },
      { type: 'text', text: 'a', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://example.test' } }] },
      { type: 'hardBreak' },
      { type: 'hardBreak' },
      { type: 'text', text: 'b', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://example.test' } }] },
      { type: 'hardBreak' },
      { type: 'siteVariable', attrs: { key: 'site.title', linked: false } },
      { type: 'hardBreak' },
    ];
    s.editor.commands.setContent(doc);
    const expected = s.editor.getJSON();
    const reopened = new Editor({
      extensions: createTiptapWireExtensions(),
      content: s.controller.initialContent,
    });
    expect(reopened.getJSON()).toEqual(expected);
    expect(JSON.stringify(persisted(s.room, 'post'))).not.toMatch(/\\[nr]/);
    reopened.destroy();
    s.close();
  });

  it('keeps an unrelated legacy block byte-identical, then canonicalizes that block on edit without oscillation', () => {
    const s = subject('post', RichTextProfile.POST, 'a\r\nb');
    const original = JSON.stringify(s.raw().toJSON());
    s.editor.commands.setContent(s.controller.initialContent);
    expect(JSON.stringify(s.raw().toJSON())).toBe(original);
    const initial: JSONContent = s.editor.getJSON();
    expect(initial.content![0]!.content![0]!.content![0]!.content!.map((node) => node.type)).toEqual([
      'text',
      'hardBreak',
      'text',
    ]);
    for (let cycle = 0; cycle < 5; cycle++) {
      s.editor.commands.setTextSelection(position(s.editor, ids[1]!) + 1);
      s.editor.commands.insertContent('!');
      expect(JSON.stringify(s.raw().toJSON())).toBe(original);
    }
    s.editor.commands.setTextSelection(position(s.editor, ids[0]!) + 1);
    s.editor.commands.insertContent('!');
    expect(s.raw().toJSON()).toEqual([{ text: { text: 'a!' } }, { hardBreak: {} }, { text: { text: 'b' } }]);
    const saved = Y.encodeStateAsUpdate(s.room);
    for (let cycle = 0; cycle < 5; cycle++) {
      s.editor.commands.setContent(s.controller.initialContent);
      expect(Y.encodeStateAsUpdate(s.room)).toEqual(saved);
    }
    s.close();
  });
});

it('persists page rich-text section Shift+Enter and GitHub paste through its scoped controller', () => {
  const room = new Y.Doc();
  const sectionId = '10000000-0000-4000-8000-000000000113';
  hydrateCanonicalBlockRoom(
    room,
    'page',
    'en',
    fromJson(LocalizedPageDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      locale: 'en',
      base: {
        nodes: [
          {
            section: {
              id: sectionId,
              richText: {
                props: {},
                blocks: { nodes: [{ block: { id: ids[0]!, paragraph: { props: {} } }, placement: { index: 0 } }] },
              },
            },
            placement: { index: 0 },
          },
        ],
      },
      localeOverlay: {
        locale: 'en',
        sections: [
          {
            sectionId,
            richText: {
              props: {},
              blocks: {
                locale: 'en',
                blocks: [{ blockId: ids[0]!, paragraph: { props: {}, content: [{ text: { text: 'a' } }] } }],
              },
            },
          },
        ],
      },
    }),
    [],
  );
  const bridge = createBlockRoomProseMirrorBridge({
    document: room,
    documentType: 'page',
    locale: 'en',
    pageSectionId: sectionId,
  });
  const controller = createRichTextBlockRoomTiptapController(bridge);
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [
      ...createTiptapWireExtensions(),
      createMarkdownPasteExtension(() => controller.canChangeStructure),
      controller.extension,
    ],
    content: controller.initialContent,
  });
  const disconnect = controller.connect(editor);
  editor.commands.setTextSelection(position(editor, ids[0]!) + 1);
  editor.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }),
  );
  editor.commands.insertContent('b');
  expect(bridge.readBlocks()[0]!.localePayload!.content).toEqual([
    { text: { text: 'a' } },
    { hardBreak: {} },
    { text: { text: 'b' } },
  ]);
  editor.commands.setTextSelection({ from: 3, to: 6 });
  editor.view.pasteText('a\nb\n\nc', new Event('paste') as ClipboardEvent);
  expect(bridge.readBlocks()).toHaveLength(2);
  expect(bridge.readBlocks()[0]!.localePayload!.content).toEqual([
    { text: { text: 'a' } },
    { hardBreak: {} },
    { text: { text: 'b' } },
  ]);
  const reopened = new Editor({ extensions: createTiptapWireExtensions(), content: controller.initialContent });
  expect(reopened.getJSON()).toEqual(editor.getJSON());
  reopened.destroy();
  disconnect();
  editor.destroy();
  room.destroy();
});

it('imports HTML br elements as canonical inline breaks in an email paragraph', () => {
  const s = subject('email-template', RichTextProfile.EMAIL, '');
  s.editor.commands.setTextSelection(position(s.editor, ids[0]!));
  s.editor.commands.insertContent('<br><strong>a<br>b</strong><br><br>c<br>');
  const content = s.raw().toJSON();
  expect(content.filter((item: { hardBreak?: unknown }) => item.hardBreak)).toHaveLength(5);
  expect(JSON.stringify(content)).not.toMatch(/\\[nr]/);
  const reopened = new Editor({ extensions: createTiptapWireExtensions(), content: s.controller.initialContent });
  expect(reopened.getJSON()).toEqual(s.editor.getJSON());
  reopened.destroy();
  s.close();
});
