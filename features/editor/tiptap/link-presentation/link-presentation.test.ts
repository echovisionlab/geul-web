// @vitest-environment jsdom

import { Editor, type JSONContent } from '@tiptap/core';
import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  ParagraphProps_LinkPresentation,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  hydrateCanonicalBlockRoom,
  materializeCanonicalBlockRoom,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { afterEach, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createBlockRoomProseMirrorBridge } from '../block-room-prosemirror-bridge';
import { createPostBlockRoomTiptapController } from '../block-room-tiptap-controller';
import { createTiptapExternalVideoExtension, DEFAULT_TIPTAP_EXTERNAL_VIDEO_LABELS } from '../external-video';
import { createTiptapWireExtensions } from '../wire-schema';
import { createMarkdownPasteExtension } from '../markdown-paste';
import {
  createTiptapLinkCardExtension,
  getLinkPresentationState,
  LinkPresentationPaste,
} from './LinkCardTiptapExtension';
import { applyLinkPreview, isolateLinkBlock, setLinkPresentation } from './link-presentation';

const BLOCK_ID = '10000000-0000-4000-8000-000000000011';
const FILE_ID = '10000000-0000-4000-8000-000000000012';
const ICON_ID = '10000000-0000-4000-8000-000000000013';
const URL = 'https://youtu.be/dQw4w9WgXcQ';
const labels = {
  menu: 'Link display',
  asLink: 'Link',
  asCard: 'Card',
  asVideo: 'Video',
  refreshPreview: 'Refresh preview',
  loadingPreview: 'Loading preview…',
  previewUnavailable: 'Unavailable',
  playVideo: 'Play {title}',
  playNotice: 'From {provider}',
  addCaption: 'Click to add caption',
  captionPlaceholder: 'Add a caption...',
};
const extensions = () =>
  createTiptapWireExtensions({
    externalVideoNode: createTiptapExternalVideoExtension({ labels: DEFAULT_TIPTAP_EXTERNAL_VIDEO_LABELS }),
    linkCardNode: createTiptapLinkCardExtension({ labels }),
  });

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

function mountPost(label: string) {
  const room = new Y.Doc();
  hydrateCanonicalBlockRoom(
    room,
    'post',
    'en',
    fromJson(LocalizedRichTextDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      profile: RichTextProfile.POST,
      locale: 'en',
      base: { nodes: [{ block: { id: BLOCK_ID, paragraph: { props: {} } }, placement: { index: 0 } }] },
      localeOverlay: {
        locale: 'en',
        blocks: [
          {
            blockId: BLOCK_ID,
            paragraph: { props: {}, content: [{ link: { href: URL, content: [{ text: label }] } }] },
          },
        ],
      },
    } as unknown as JsonValue),
    [],
  );
  const controller = createPostBlockRoomTiptapController(
    createBlockRoomProseMirrorBridge({ document: room, documentType: 'post', locale: 'en', origin: 'link-test' }),
  );
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: [...extensions(), controller.extension],
    content: controller.initialContent,
  });
  const disconnect = controller.connect(editor);
  cleanup = () => {
    disconnect();
    editor.destroy();
    element.remove();
    room.destroy();
  };
  const stored = () => {
    const document = materializeCanonicalBlockRoom(room, 'post');
    if (document.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
      throw new Error('Expected a Post document.');
    }
    const base = document.base?.nodes[0]?.block?.value;
    const locale = document.localeOverlay?.blocks[0]?.value;
    return {
      props: base?.case === 'paragraph' ? base.value.props : undefined,
      localeProps: locale?.case === 'paragraph' ? locale.value.props : undefined,
      content: locale?.case === 'paragraph' ? locale.value.content : undefined,
    };
  };
  return { editor, stored, nodeType: () => editor.state.doc.firstChild!.firstChild!.firstChild!.type.name };
}

it('keeps one durable Paragraph link while switching between video, card and link', () => {
  const post = mountPost(URL);
  expect(post.nodeType()).toBe('externalVideo');

  expect(setLinkPresentation(post.editor, BLOCK_ID, 'card')).toBe(true);
  expect(post.nodeType()).toBe('linkCard');
  expect(
    applyLinkPreview(post.editor, BLOCK_ID, URL, {
      title: 'Live at the Hall',
      description: 'A full set.',
      siteName: 'YouTube',
      thumbnailFileId: FILE_ID,
      iconFileId: ICON_ID,
    }),
  ).toBe(true);
  // The caption is the card's own translatable text, set like any atom attribute.
  const card = post.editor.state.doc.firstChild!.firstChild!.firstChild!;
  post.editor.view.dispatch(
    post.editor.state.tr.setNodeMarkup(2, undefined, { ...card.attrs, linkCaption: 'Recorded live.' }),
  );
  expect(post.stored()).toMatchObject({
    props: {
      linkPresentation: ParagraphProps_LinkPresentation.CARD,
      linkSiteName: 'YouTube',
      linkThumbnail: { state: { case: 'activeFileId', value: FILE_ID } },
      linkIcon: { state: { case: 'activeFileId', value: ICON_ID } },
    },
    localeProps: { linkDescription: 'A full set.', linkCaption: 'Recorded live.' },
  });
  // A bare URL label takes the page title; the link itself is unchanged.
  const [inline] = post.stored().content ?? [];
  expect(inline?.value.case === 'link' ? inline.value.value : undefined).toMatchObject({
    href: URL,
    content: [{ text: 'Live at the Hall' }],
  });

  expect(setLinkPresentation(post.editor, BLOCK_ID, 'link')).toBe(true);
  expect(post.nodeType()).toBe('paragraph');
  expect(post.stored().props?.linkPresentation).toBe(ParagraphProps_LinkPresentation.LINK);
});

it('keeps an authored link label when a preview arrives', () => {
  const post = mountPost('Our favourite set');
  setLinkPresentation(post.editor, BLOCK_ID, 'card');
  applyLinkPreview(post.editor, BLOCK_ID, URL, { title: 'Page title' });
  const [inline] = post.stored().content ?? [];
  expect(inline?.value.case === 'link' ? inline.value.value.content : undefined).toMatchObject([
    { text: 'Our favourite set' },
  ]);
});

it('moves a link pasted into other text to its own paragraph below', () => {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: extensions(),
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: BLOCK_ID },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'See ' },
                    {
                      type: 'text',
                      text: 'example.com',
                      marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  });
  cleanup = () => editor.destroy();

  const isolated = isolateLinkBlock(editor, BLOCK_ID, 'https://example.com');

  const blocks = (editor.getJSON() as JSONContent).content![0].content!;
  expect(blocks.map((block) => [block.attrs!.id === isolated, block.content![0].content?.[0]?.text])).toEqual([
    [false, 'See '],
    [true, 'example.com'],
  ]);
});

it.each([
  ['https://www.discogs.com/release/1', 'paragraph'],
  [URL, 'externalVideo'],
])('offers the presentation choice after pasting %s alone', async (pasted, projected) => {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [...extensions(), LinkPresentationPaste, createMarkdownPasteExtension(() => true)],
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [{ type: 'blockContainer', attrs: { id: BLOCK_ID }, content: [{ type: 'paragraph' }] }],
        },
      ],
    },
  });
  cleanup = () => editor.destroy();

  editor.view.someProp('handlePaste', (handler) =>
    handler(
      editor.view,
      { clipboardData: { getData: (type: string) => (type === 'text/plain' ? pasted : '') } } as ClipboardEvent,
      editor.state.doc.slice(0, 0),
    ),
  );
  await Promise.resolve();

  expect(getLinkPresentationState(editor.state).pasted).toEqual({ blockId: BLOCK_ID, url: pasted });
  expect(editor.state.doc.firstChild!.firstChild!.firstChild!.type.name).toBe(projected);
  editor.commands.insertContent('x');
  expect(getLinkPresentationState(editor.state).pasted).toBeNull();
});
