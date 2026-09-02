// @vitest-environment jsdom

import { Editor, type JSONContent } from '@tiptap/core';
import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  blockRoomPresentLocaleValues,
  hydrateCanonicalBlockRoom,
  materializeCanonicalBlockRoom,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { NodeSelection } from '@tiptap/pm/state';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { TranslationStructureLockExtension } from '@/lib/editor/extensions/TranslationStructureLockExtension';
import { splitCurrentTextBlock } from './block-commands';
import { createBlockRoomProseMirrorBridge } from './block-room-prosemirror-bridge';
import { createPostBlockRoomTiptapController } from './block-room-tiptap-controller';
import { createTiptapWireExtensions } from './wire-schema';

const LOCATION_BLOCK_ID = '019cce25-dbc0-7d12-9f1f-735b1a6c6b13';
const BEFORE_BLOCK_ID = '0c50555d-363e-5b60-879f-c588cdacae04';
const MIDDLE_BLOCK_ID = '22b3e168-e371-57e3-bd31-3bb0317ed6bb';
const AFTER_BLOCK_ID = 'e6f3d60a-565a-5fa8-af62-85e0232e43f2';
const YOUTUBE_BLOCK_ID = '9054add7-613a-5f79-bc8d-cf04da0b9223';
const YOUTUBE_URL = 'https://youtu.be/dQw4w9WgXcQ?t=60';
const DIVIDER_BLOCK_ID = '019cce25-dbc1-7d12-9f1f-735b1a6c6b13';
const FIRST_EMPTY_BLOCK_ID = '019cce25-dbc2-7d12-9f1f-735b1a6c6b13';
const SECOND_EMPTY_BLOCK_ID = '019cce25-dbc3-7d12-9f1f-735b1a6c6b13';
const AUDIO_ONE_BLOCK_ID = '10000000-0000-4000-8000-000000000004';
const AUDIO_TWO_BLOCK_ID = '10000000-0000-4000-8000-000000000005';
const AUDIO_TAIL_BLOCK_ID = '10000000-0000-4000-8000-000000000006';
const AUDIO_ONE_FILE_ID = '20000000-0000-4000-8000-000000000004';
const AUDIO_TWO_FILE_ID = '20000000-0000-4000-8000-000000000005';

function container(id: string, content: JSONContent, children?: JSONContent): JSONContent {
  return {
    type: 'blockContainer',
    attrs: { id },
    content: children ? [content, children] : [content],
  };
}

function documentWith(...blocks: JSONContent[]): JSONContent {
  return { type: 'doc', content: [{ type: 'blockGroup', content: blocks }] };
}

function mount(content: JSONContent, structureLocked = false) {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: [...createTiptapWireExtensions(), ...(structureLocked ? [TranslationStructureLockExtension] : [])],
    content,
  });
  return {
    editor,
    destroy() {
      editor.destroy();
      element.remove();
    },
  };
}

function nodePosition(editor: Editor, nodeName: string): number {
  let result = -1;
  editor.state.doc.descendants((node, position) => {
    if (result < 0 && node.type.name === nodeName) {
      result = position;
    }
  });
  return result;
}

function nodePositionByBlockId(editor: Editor, blockId: string): number {
  let result = -1;
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === 'blockContainer' && node.attrs.id === blockId) {
      result = position;
      return false;
    }
    return true;
  });
  if (result < 0) {
    throw new Error(`Expected ${blockId} Block container.`);
  }
  return result;
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

function placeCursorAtEnd(editor: Editor, nodeName: string, text: string): void {
  editor.commands.setTextSelection(nodePosition(editor, nodeName) + text.length + 1);
}

function locationHeadingDocument() {
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale: 'en',
    base: {
      nodes: [{ block: { id: LOCATION_BLOCK_ID, heading: { props: { level: 1 } } }, placement: { index: 0 } }],
    },
    localeOverlay: {
      locale: 'en',
      blocks: [
        {
          blockId: LOCATION_BLOCK_ID,
          heading: { props: {}, content: [{ text: { text: 'Location' } }] },
        },
      ],
    },
  } as unknown as JsonValue);
}

function threeParagraphDocument() {
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale: 'en',
    base: {
      nodes: [BEFORE_BLOCK_ID, MIDDLE_BLOCK_ID, AFTER_BLOCK_ID].map((id, index) => ({
        block: { id, paragraph: { props: {} } },
        placement: { index },
      })),
    },
    localeOverlay: {
      locale: 'en',
      blocks: [
        { blockId: BEFORE_BLOCK_ID, paragraph: { props: {}, content: [{ text: { text: 'Before' } }] } },
        { blockId: MIDDLE_BLOCK_ID, paragraph: { props: {}, content: [{ text: { text: 'Middle' } }] } },
        { blockId: AFTER_BLOCK_ID, paragraph: { props: {}, content: [{ text: { text: 'After' } }] } },
      ],
    },
  } as unknown as JsonValue);
}

function youtubeDocument() {
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale: 'en',
    base: {
      nodes: [
        { block: { id: YOUTUBE_BLOCK_ID, paragraph: { props: {} } }, placement: { index: 0 } },
        { block: { id: AFTER_BLOCK_ID, paragraph: { props: {} } }, placement: { index: 1 } },
      ],
    },
    localeOverlay: {
      locale: 'en',
      blocks: [
        {
          blockId: YOUTUBE_BLOCK_ID,
          paragraph: {
            props: {},
            content: [{ link: { href: YOUTUBE_URL, content: [{ text: 'Field recording' }] } }],
          },
        },
        { blockId: AFTER_BLOCK_ID, paragraph: { props: {}, content: [{ text: { text: 'After' } }] } },
      ],
    },
  } as unknown as JsonValue);
}

function consecutiveAudioDocument() {
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale: 'en',
    base: {
      nodes: [
        {
          block: {
            id: AUDIO_ONE_BLOCK_ID,
            file: { props: { attachment: { activeFileId: AUDIO_ONE_FILE_ID }, name: 'audio-one.wav' } },
          },
          placement: { index: 0 },
        },
        {
          block: {
            id: AUDIO_TWO_BLOCK_ID,
            file: { props: { attachment: { activeFileId: AUDIO_TWO_FILE_ID }, name: 'audio-two.wav' } },
          },
          placement: { index: 1 },
        },
        { block: { id: AUDIO_TAIL_BLOCK_ID, paragraph: { props: {} } }, placement: { index: 2 } },
      ],
    },
    localeOverlay: {
      locale: 'en',
      blocks: [
        { blockId: AUDIO_ONE_BLOCK_ID, file: { props: { caption: 'Audio one' } } },
        { blockId: AUDIO_TWO_BLOCK_ID, file: { props: { caption: 'Audio two' } } },
        {
          blockId: AUDIO_TAIL_BLOCK_ID,
          paragraph: { props: {}, content: [{ text: { text: 'Existing tail' } }] },
        },
      ],
    },
  } as unknown as JsonValue);
}

function atomWithRepeatedEmptyParagraphsDocument() {
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale: 'en',
    base: {
      nodes: [
        { block: { id: DIVIDER_BLOCK_ID, divider: { props: {} } }, placement: { index: 0 } },
        { block: { id: FIRST_EMPTY_BLOCK_ID, paragraph: { props: {} } }, placement: { index: 1 } },
        { block: { id: SECOND_EMPTY_BLOCK_ID, paragraph: { props: {} } }, placement: { index: 2 } },
        { block: { id: AFTER_BLOCK_ID, paragraph: { props: {} } }, placement: { index: 3 } },
      ],
    },
    localeOverlay: {
      locale: 'en',
      blocks: [
        { blockId: DIVIDER_BLOCK_ID, divider: { props: {} } },
        { blockId: FIRST_EMPTY_BLOCK_ID, paragraph: { props: {}, content: [] } },
        { blockId: SECOND_EMPTY_BLOCK_ID, paragraph: { props: {}, content: [] } },
        { blockId: AFTER_BLOCK_ID, paragraph: { props: {}, content: [{ text: { text: 'After' } }] } },
      ],
    },
  } as unknown as JsonValue);
}

describe('Tiptap text-block Enter commands', () => {
  it('creates a paragraph after the ganwoljae Location heading', () => {
    const mounted = mount(
      documentWith(
        container('location-heading', {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Location' }],
        }),
      ),
    );
    placeCursorAtEnd(mounted.editor, 'heading', 'Location');

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    mounted.editor.view.dom.dispatchEvent(enter);

    const group = mounted.editor.state.doc.firstChild;
    expect(enter.defaultPrevented).toBe(true);
    expect(group?.childCount).toBe(2);
    expect(group?.child(0).attrs.id).toBe('location-heading');
    expect(group?.child(0).firstChild?.type.name).toBe('heading');
    expect(group?.child(1).attrs.id).not.toBe('location-heading');
    expect(group?.child(1).firstChild?.type.name).toBe('paragraph');
    expect(mounted.editor.state.selection.$from.parent.type.name).toBe('paragraph');
    mounted.destroy();
  });

  it('persists heading Enter in the typed source Block-room document', () => {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(room, 'post', 'en', locationHeadingDocument(), []);
    const bridge = createBlockRoomProseMirrorBridge({
      document: room,
      documentType: 'post',
      locale: 'en',
      origin: 'post-tiptap',
    });
    const controller = createPostBlockRoomTiptapController(bridge);
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), controller.extension],
      content: controller.initialContent,
    });
    const disconnect = controller.connect(editor);
    placeCursorAtEnd(editor, 'heading', 'Location');

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    editor.view.dom.dispatchEvent(enter);

    const materialized = materializeCanonicalBlockRoom(room, 'post');
    if (materialized.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
      throw new Error('Expected Post document.');
    }
    expect(materialized.base?.nodes.map((node) => node.block?.value.case)).toEqual(['heading', 'paragraph']);
    expect(materialized.base?.nodes[0]?.block?.id).toBe(LOCATION_BLOCK_ID);
    expect(materialized.base?.nodes[1]?.block?.id).not.toBe(LOCATION_BLOCK_ID);
    expect(materialized.localeOverlay?.blocks.map((block) => block.value.case)).toEqual(['heading', 'paragraph']);
    disconnect();
    editor.destroy();
    room.destroy();
  });

  it('deletes the empty Paragraph after a heading from the Block-room document with one Backspace', () => {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(room, 'post', 'en', locationHeadingDocument(), []);
    const bridge = createBlockRoomProseMirrorBridge({
      document: room,
      documentType: 'post',
      locale: 'en',
      origin: 'post-tiptap',
    });
    const controller = createPostBlockRoomTiptapController(bridge);
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), controller.extension],
      content: controller.initialContent,
    });
    const disconnect = controller.connect(editor);
    placeCursorAtEnd(editor, 'heading', 'Location');

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    editor.view.dom.dispatchEvent(enter);
    const backspace = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    editor.view.dom.dispatchEvent(backspace);

    const materialized = materializeCanonicalBlockRoom(room, 'post');
    if (materialized.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
      throw new Error('Expected Post document.');
    }
    expect(enter.defaultPrevented).toBe(true);
    expect(backspace.defaultPrevented).toBe(true);
    expect(materialized.base?.nodes).toHaveLength(1);
    expect(materialized.base?.nodes[0]?.block?.id).toBe(LOCATION_BLOCK_ID);
    expect(materialized.base?.nodes[0]?.block?.value.case).toBe('heading');
    expect(materialized.localeOverlay?.blocks).toHaveLength(1);
    expect(editor.state.selection.$from.parent.type.name).toBe('heading');
    expect(editor.state.selection.$from.parentOffset).toBe('Location'.length);
    disconnect();
    editor.destroy();
    room.destroy();
  });

  it('keeps the surviving Block-room order through repeated Backspace after an atomic block', async () => {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(room, 'post', 'en', atomWithRepeatedEmptyParagraphsDocument(), []);
    const bridge = createBlockRoomProseMirrorBridge({
      document: room,
      documentType: 'post',
      locale: 'en',
      origin: 'post-tiptap',
    });
    const moveBlock = vi.spyOn(bridge, 'moveBlock');
    const controller = createPostBlockRoomTiptapController(bridge);
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), controller.extension],
      content: controller.initialContent,
    });
    const disconnect = controller.connect(editor);
    const paragraphs: number[] = [];
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'paragraph') {
        paragraphs.push(position);
      }
    });
    editor.commands.setTextSelection(paragraphs[1] + 1);

    for (let index = 0; index < 3; index += 1) {
      editor.view.dom.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }),
      );
    }
    await Promise.resolve();

    const materialized = materializeCanonicalBlockRoom(room, 'post');
    if (materialized.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
      throw new Error('Expected Post document.');
    }
    const orderedNodes = [...(materialized.base?.nodes ?? [])]
      .sort((left, right) => (left.placement?.index ?? 0) - (right.placement?.index ?? 0))
      .map((node) => node.block?.id);
    expect(orderedNodes).toEqual([FIRST_EMPTY_BLOCK_ID, AFTER_BLOCK_ID]);
    expect(materialized.localeOverlay?.blocks.map((block) => block.blockId)).toEqual([
      FIRST_EMPTY_BLOCK_ID,
      AFTER_BLOCK_ID,
    ]);
    expect(moveBlock).not.toHaveBeenCalled();
    disconnect();
    editor.destroy();
    room.destroy();
  });

  it('persists a middle paragraph split at the same Block-room position', async () => {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(room, 'post', 'en', threeParagraphDocument(), []);
    const bridge = createBlockRoomProseMirrorBridge({
      document: room,
      documentType: 'post',
      locale: 'en',
      origin: 'post-tiptap',
    });
    const insertBlock = vi.spyOn(bridge, 'insertBlock');
    const moveBlock = vi.spyOn(bridge, 'moveBlock');
    const controller = createPostBlockRoomTiptapController(bridge);
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), controller.extension],
      content: controller.initialContent,
    });
    const disconnect = controller.connect(editor);
    const paragraphs: number[] = [];
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'paragraph') {
        paragraphs.push(position);
      }
    });
    editor.commands.setTextSelection(paragraphs[1] + 4);

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    editor.view.dom.dispatchEvent(enter);
    await Promise.resolve();

    const materialized = materializeCanonicalBlockRoom(room, 'post');
    if (materialized.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
      throw new Error('Expected Post document.');
    }
    const orderedNodes = [...(materialized.base?.nodes ?? [])].sort(
      (left, right) => (left.placement?.index ?? 0) - (right.placement?.index ?? 0),
    );
    const ids = orderedNodes.map((node) => node.block?.id);
    const overlaysById = new Map(materialized.localeOverlay?.blocks.map((block) => [block.blockId, block]));
    const orderedOverlays = ids.map((id) => overlaysById.get(id ?? ''));
    expect(enter.defaultPrevented).toBe(true);
    expect(ids).toHaveLength(4);
    expect(ids[0]).toBe(BEFORE_BLOCK_ID);
    expect(ids[1]).toBe(MIDDLE_BLOCK_ID);
    expect(ids[2]).not.toBe(BEFORE_BLOCK_ID);
    expect(ids[2]).not.toBe(MIDDLE_BLOCK_ID);
    expect(ids[2]).not.toBe(AFTER_BLOCK_ID);
    expect(ids[3]).toBe(AFTER_BLOCK_ID);
    expect(
      orderedOverlays.map((block) => {
        const value = block?.value;
        if (value?.case !== 'paragraph') {
          return undefined;
        }
        const inline = value.value.content[0]?.value;
        return inline?.case === 'text' ? inline.value.text : '';
      }),
    ).toEqual(['Before', 'Mid', 'dle', 'After']);
    expect(editor.state.selection.$from.parent.textContent).toBe('dle');
    expect(editor.state.selection.$from.parentOffset).toBe(0);
    expect(insertBlock).toHaveBeenCalledOnce();
    expect(insertBlock.mock.calls[0]?.[0].index).toBe(2);
    expect(moveBlock).not.toHaveBeenCalled();
    disconnect();
    editor.destroy();
    room.destroy();
  });

  it('preserves an authored blank Paragraph between text after collaboration replay', async () => {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(room, 'post', 'en', threeParagraphDocument(), []);
    const bridge = createBlockRoomProseMirrorBridge({
      document: room,
      documentType: 'post',
      locale: 'en',
      origin: 'post-tiptap',
    });
    const controller = createPostBlockRoomTiptapController(bridge);
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), controller.extension],
      content: controller.initialContent,
    });
    const disconnect = controller.connect(editor);
    const middle = nodePositionByBlockId(editor, MIDDLE_BLOCK_ID);
    editor.commands.setTextSelection(middle + 'Middle'.length + 2);

    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    typeText(editor, 'After blank');
    await Promise.resolve();

    const peer = new Y.Doc();
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(room));
    const materialized = materializeCanonicalBlockRoom(peer, 'post');
    if (materialized.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
      throw new Error('Expected Post document.');
    }
    const orderedNodes = [...(materialized.base?.nodes ?? [])].sort(
      (left, right) => (left.placement?.index ?? 0) - (right.placement?.index ?? 0),
    );
    const overlaysById = new Map(materialized.localeOverlay?.blocks.map((block) => [block.blockId, block]));
    const orderedOverlays = orderedNodes.map((node) => overlaysById.get(node.block?.id ?? ''));
    const texts = orderedOverlays.map((block) => {
      const value = block?.value;
      if (value?.case !== 'paragraph') {
        return undefined;
      }
      const inline = value.value.content[0]?.value;
      return inline?.case === 'text' ? inline.value.text : '';
    });
    const ids = orderedNodes.map((node) => node.block?.id ?? '');
    const blankBlockId = ids[2];

    expect(texts).toEqual(['Before', 'Middle', '', 'After blank', 'After']);
    expect(new Set(ids).size).toBe(ids.length);
    expect(blankBlockId).toEqual(expect.any(String));
    expect(blockRoomPresentLocaleValues(peer)).toContainEqual(
      expect.objectContaining({
        owner: { case: 'blockHandle', value: blankBlockId },
        fieldHandle: 'content',
        path: [],
      }),
    );

    disconnect();
    editor.destroy();
    peer.destroy();
    room.destroy();
  });

  it('persists a writable Paragraph directly after a selected YouTube preview', async () => {
    const room = new Y.Doc();
    hydrateCanonicalBlockRoom(room, 'post', 'en', youtubeDocument(), []);
    const bridge = createBlockRoomProseMirrorBridge({
      document: room,
      documentType: 'post',
      locale: 'en',
      origin: 'post-tiptap',
    });
    const insertBlock = vi.spyOn(bridge, 'insertBlock');
    const moveBlock = vi.spyOn(bridge, 'moveBlock');
    const controller = createPostBlockRoomTiptapController(bridge);
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [...createTiptapWireExtensions(), controller.extension],
      content: controller.initialContent,
    });
    const disconnect = controller.connect(editor);
    const youtube = nodePosition(editor, 'externalVideo');
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, youtube)));

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    editor.view.dom.dispatchEvent(enter);
    editor.commands.insertContent('New paragraph');
    await Promise.resolve();

    const materialized = materializeCanonicalBlockRoom(room, 'post');
    if (materialized.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
      throw new Error('Expected Post document.');
    }
    const orderedNodes = [...(materialized.base?.nodes ?? [])].sort(
      (left, right) => (left.placement?.index ?? 0) - (right.placement?.index ?? 0),
    );
    const ids = orderedNodes.map((node) => node.block?.id);
    const overlaysById = new Map(materialized.localeOverlay?.blocks.map((block) => [block.blockId, block]));
    const overlays = ids.map((id) => overlaysById.get(id ?? ''));
    expect(enter.defaultPrevented).toBe(true);
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe(YOUTUBE_BLOCK_ID);
    expect(ids[1]).toEqual(expect.any(String));
    expect(ids[1]).not.toBe(YOUTUBE_BLOCK_ID);
    expect(ids[1]).not.toBe(AFTER_BLOCK_ID);
    expect(ids[2]).toBe(AFTER_BLOCK_ID);
    expect(overlays.map((block) => block?.value.case)).toEqual(['paragraph', 'paragraph', 'paragraph']);
    const youtubeOverlay = overlays[0]?.value;
    const insertedOverlay = overlays[1]?.value;
    if (youtubeOverlay?.case !== 'paragraph' || insertedOverlay?.case !== 'paragraph') {
      throw new Error('Expected external video and inserted text to remain Paragraph locale overlays.');
    }
    const youtubeInline = youtubeOverlay.value.content[0]?.value;
    if (youtubeInline?.case !== 'link') {
      throw new Error('Expected the external video Paragraph to retain its Link inline.');
    }
    expect(youtubeInline?.value.href).toBe(YOUTUBE_URL);
    const insertedInline = insertedOverlay.value.content[0]?.value;
    if (insertedInline?.case !== 'text') {
      throw new Error('Expected the inserted Paragraph to contain text.');
    }
    expect(insertedInline?.value.text).toBe('New paragraph');
    expect(insertBlock).toHaveBeenCalledOnce();
    expect(insertBlock.mock.calls[0]?.[0].index).toBe(1);
    expect(moveBlock).not.toHaveBeenCalled();
    disconnect();
    editor.destroy();
    room.destroy();
  });

  it.each([
    [AUDIO_ONE_BLOCK_ID, 1],
    [AUDIO_TWO_BLOCK_ID, 2],
  ])(
    'persists Enter after consecutive File Block %s without an orphaned locale overlay',
    async (selectedBlockId, index) => {
      const room = new Y.Doc();
      hydrateCanonicalBlockRoom(room, 'post', 'en', consecutiveAudioDocument(), []);
      const bridge = createBlockRoomProseMirrorBridge({
        document: room,
        documentType: 'post',
        locale: 'en',
        origin: 'post-tiptap',
      });
      const insertBlock = vi.spyOn(bridge, 'insertBlock');
      const moveBlock = vi.spyOn(bridge, 'moveBlock');
      const before = materializeCanonicalBlockRoom(room, 'post');
      const controller = createPostBlockRoomTiptapController(bridge);
      const editor = new Editor({
        element: document.createElement('div'),
        extensions: [...createTiptapWireExtensions(), controller.extension],
        content: controller.initialContent,
      });
      const disconnect = controller.connect(editor);
      const selectedBlock = nodePositionByBlockId(editor, selectedBlockId);
      editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, selectedBlock)));

      const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      editor.view.dom.dispatchEvent(enter);
      typeText(editor, 'AFTER_AUDIO_TWO');
      await Promise.resolve();

      const materialized = materializeCanonicalBlockRoom(room, 'post');
      if (
        before.$typeName !== 'api.content.v1.LocalizedRichTextDocument' ||
        materialized.$typeName !== 'api.content.v1.LocalizedRichTextDocument'
      ) {
        throw new Error('Expected Post document.');
      }
      const nodes = [...(materialized.base?.nodes ?? [])].sort(
        (left, right) => (left.placement?.index ?? 0) - (right.placement?.index ?? 0),
      );
      const ids = nodes.map((node) => node.block?.id);
      const insertedId = ids[index];
      if (!insertedId) {
        throw new Error('Expected an inserted Paragraph Block ID.');
      }
      const overlaysById = new Map(materialized.localeOverlay?.blocks.map((block) => [block.blockId, block]));
      const orderedOverlays = ids.map((id) => overlaysById.get(id ?? ''));

      expect(enter.defaultPrevented).toBe(true);
      expect(ids).toHaveLength(4);
      expect(ids).toEqual(
        [AUDIO_ONE_BLOCK_ID, AUDIO_TWO_BLOCK_ID, AUDIO_TAIL_BLOCK_ID].toSpliced(index, 0, insertedId),
      );
      expect(ids.at(-1)).toBe(AUDIO_TAIL_BLOCK_ID);
      expect(insertedId).toEqual(expect.any(String));
      expect(insertedId).not.toBe(AUDIO_ONE_BLOCK_ID);
      expect(insertedId).not.toBe(AUDIO_TWO_BLOCK_ID);
      expect(insertedId).not.toBe(AUDIO_TAIL_BLOCK_ID);
      expect(orderedOverlays.map((block) => block?.blockId)).toEqual(ids);
      expect(materialized.localeOverlay?.blocks).toHaveLength(nodes.length);
      expect(nodes.map((node) => node.block?.value.case)).toEqual(
        ['file', 'file', 'paragraph'].toSpliced(index, 0, 'paragraph'),
      );
      const insertedOverlay = overlaysById.get(insertedId ?? '')?.value;
      expect(insertedOverlay?.case).toBe('paragraph');
      const insertedText = insertedOverlay?.case === 'paragraph' ? insertedOverlay.value.content[0]?.value : undefined;
      expect(insertedText?.case === 'text' ? insertedText.value.text : undefined).toBe('AFTER_AUDIO_TWO');
      const files = nodes.filter((node) => node.block?.value.case === 'file');
      expect(files.map((node) => node.block?.id)).toEqual([AUDIO_ONE_BLOCK_ID, AUDIO_TWO_BLOCK_ID]);
      expect(files[0]?.block?.value).toMatchObject({
        case: 'file',
        value: { props: { attachment: { state: { case: 'activeFileId', value: AUDIO_ONE_FILE_ID } } } },
      });
      expect(files[1]?.block?.value).toMatchObject({
        case: 'file',
        value: { props: { attachment: { state: { case: 'activeFileId', value: AUDIO_TWO_FILE_ID } } } },
      });
      expect(insertBlock).toHaveBeenCalledOnce();
      expect(insertBlock.mock.calls[0]?.[0].index).toBe(index);
      expect(moveBlock).not.toHaveBeenCalled();
      disconnect();
      editor.destroy();
      room.destroy();
    },
  );

  it.each([
    ['bulletListItem', {}, {}],
    ['numberedListItem', { start: 3 }, { start: 4 }],
    ['checkListItem', { checked: true }, { checked: false }],
  ])('continues a non-empty %s with a new item', (type, attrs, expectedNextAttrs) => {
    const mounted = mount(
      documentWith(
        container('list-item', {
          type,
          attrs,
          content: [{ type: 'text', text: 'Item' }],
        }),
      ),
    );
    placeCursorAtEnd(mounted.editor, type, 'Item');

    expect(splitCurrentTextBlock(mounted.editor)).toBe(true);

    const group = mounted.editor.state.doc.firstChild;
    expect(group?.child(0).attrs.id).toBe('list-item');
    expect(group?.child(1).attrs.id).not.toBe('list-item');
    expect(group?.child(1).firstChild?.type.name).toBe(type);
    expect(group?.child(1).firstChild?.attrs).toMatchObject(expectedNextAttrs);
    mounted.destroy();
  });

  it.each(['heading', 'quote', 'callout', 'bulletListItem', 'numberedListItem', 'checkListItem'])(
    'exits an empty %s to a paragraph without changing its block ID',
    (type) => {
      const mounted = mount(documentWith(container('empty-text-block', { type })));
      mounted.editor.commands.setTextSelection(nodePosition(mounted.editor, type) + 1);

      expect(splitCurrentTextBlock(mounted.editor)).toBe(true);

      const group = mounted.editor.state.doc.firstChild;
      expect(group?.childCount).toBe(1);
      expect(group?.child(0).attrs.id).toBe('empty-text-block');
      expect(group?.child(0).firstChild?.type.name).toBe('paragraph');
      mounted.destroy();
    },
  );

  it('continues a quote as a paragraph', () => {
    const mounted = mount(
      documentWith(
        container('quote', {
          type: 'quote',
          content: [{ type: 'text', text: 'Quoted' }],
        }),
      ),
    );
    placeCursorAtEnd(mounted.editor, 'quote', 'Quoted');

    expect(splitCurrentTextBlock(mounted.editor)).toBe(true);

    const group = mounted.editor.state.doc.firstChild;
    expect(group?.child(0).firstChild?.type.name).toBe('quote');
    expect(group?.child(1).firstChild?.type.name).toBe('paragraph');
    mounted.destroy();
  });

  it('exits a Callout into a default Paragraph without carrying its background', () => {
    const mounted = mount(
      documentWith(
        container('warning', {
          type: 'callout',
          attrs: { icon: '⚠️', backgroundColor: 'yellow', textColor: 'red' },
          content: [{ type: 'text', text: 'Warning' }],
        }),
      ),
    );
    placeCursorAtEnd(mounted.editor, 'callout', 'Warning');

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    mounted.editor.view.dom.dispatchEvent(enter);

    const group = mounted.editor.state.doc.firstChild;
    expect(enter.defaultPrevented).toBe(true);
    expect(group?.childCount).toBe(2);
    expect(group?.child(0).firstChild?.type.name).toBe('callout');
    expect(group?.child(0).firstChild?.attrs.backgroundColor).toBe('yellow');
    expect(group?.child(1).firstChild?.type.name).toBe('paragraph');
    expect(group?.child(1).firstChild?.attrs).toMatchObject({
      backgroundColor: 'default',
      textColor: 'default',
      textAlignment: 'left',
    });
    expect(mounted.editor.state.selection.$from.parent).toBe(group?.child(1).firstChild);
    mounted.destroy();
  });

  it('keeps Shift-Enter inside a Callout as a hard break', () => {
    const mounted = mount(
      documentWith(
        container('warning', {
          type: 'callout',
          attrs: { icon: '⚠️', backgroundColor: 'yellow', textColor: 'default' },
          content: [{ type: 'text', text: 'FirstSecond' }],
        }),
      ),
    );
    mounted.editor.commands.setTextSelection(nodePosition(mounted.editor, 'callout') + 'First'.length + 1);

    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    mounted.editor.view.dom.dispatchEvent(enter);

    const block = mounted.editor.state.doc.firstChild?.firstChild;
    expect(enter.defaultPrevented).toBe(true);
    expect(block?.firstChild?.type.name).toBe('callout');
    expect(block?.firstChild?.content.content.map((node) => node.type.name)).toEqual(['text', 'hardBreak', 'text']);
    expect(mounted.editor.state.doc.firstChild?.childCount).toBe(1);
    mounted.destroy();
  });

  it('allows target-locale Shift-Enter as a hard break without creating a sibling block', () => {
    const mounted = mount(
      documentWith(
        container('paragraph', {
          type: 'paragraph',
          content: [{ type: 'text', text: 'first' }],
        }),
      ),
      true,
    );
    mounted.editor.commands.setTextSelection(nodePosition(mounted.editor, 'paragraph') + 3);

    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    mounted.editor.view.dom.dispatchEvent(enter);

    const block = mounted.editor.state.doc.firstChild?.firstChild;
    expect(enter.defaultPrevented).toBe(true);
    expect(block?.attrs.id).toBe('paragraph');
    expect(block?.firstChild?.content.content.map((node) => node.type.name)).toEqual(['text', 'hardBreak', 'text']);
    expect(mounted.editor.state.doc.firstChild?.childCount).toBe(1);
    mounted.destroy();
  });

  it('keeps nested children attached to the original block when its text is split', () => {
    const childGroup: JSONContent = {
      type: 'blockGroup',
      content: [container('child', { type: 'paragraph', content: [{ type: 'text', text: 'Child' }] })],
    };
    const mounted = mount(
      documentWith(
        container('parent', { type: 'bulletListItem', content: [{ type: 'text', text: 'Parent' }] }, childGroup),
      ),
    );
    placeCursorAtEnd(mounted.editor, 'bulletListItem', 'Parent');

    expect(splitCurrentTextBlock(mounted.editor)).toBe(true);

    const group = mounted.editor.state.doc.firstChild;
    expect(group?.child(0).child(1).firstChild?.attrs.id).toBe('child');
    expect(group?.child(1).childCount).toBe(1);
    mounted.destroy();
  });
});
