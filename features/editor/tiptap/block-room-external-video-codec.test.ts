// @vitest-environment jsdom

import { Editor } from '@tiptap/core';
import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedPageDocumentSchema,
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  hydrateCanonicalBlockRoom,
  materializeCanonicalBlockRoom,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createBlockRoomProseMirrorBridge } from './block-room-prosemirror-bridge';
import {
  createPostBlockRoomTiptapController,
  createRichTextBlockRoomTiptapController,
} from './block-room-tiptap-controller';
import {
  createTiptapExternalVideoExtension,
  DEFAULT_TIPTAP_EXTERNAL_VIDEO_LABELS,
  getTiptapStandaloneExternalVideos,
  updateTiptapExternalVideoLayout,
  updateTiptapExternalVideoSource,
} from './external-video';
import { createTiptapWireExtensions } from './wire-schema';

const VIDEO_BLOCK_ID = '10000000-0000-4000-8000-000000000001';
const TEXT_BLOCK_ID = '10000000-0000-4000-8000-000000000002';
const PAGE_SECTION_ID = '10000000-0000-4000-8000-000000000003';
const YOUTUBE_URL = 'https://youtu.be/dQw4w9WgXcQ?t=1m';

function externalVideoDocument(profile = RichTextProfile.POST) {
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile,
    locale: 'en',
    base: {
      nodes: [
        {
          block: {
            id: VIDEO_BLOCK_ID,
            paragraph: { props: { textAlignment: 2, previewWidth: 64, aspectRatio: 3 } },
          },
          placement: { index: 0 },
        },
        {
          block: { id: TEXT_BLOCK_ID, paragraph: { props: {} } },
          placement: { index: 1 },
        },
      ],
    },
    localeOverlay: {
      locale: 'en',
      blocks: [
        {
          blockId: VIDEO_BLOCK_ID,
          paragraph: {
            props: {},
            content: [
              {
                link: {
                  href: YOUTUBE_URL,
                  content: [
                    { text: 'Field ', styles: { bold: true } },
                    { text: 'recording', styles: { italic: true } },
                  ],
                },
              },
            ],
          },
        },
        {
          blockId: TEXT_BLOCK_ID,
          paragraph: { props: {}, content: [{ text: { text: 'Ordinary paragraph' } }] },
        },
      ],
    },
  } as unknown as JsonValue);
}

function pageExternalVideoDocument() {
  return fromJson(LocalizedPageDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    locale: 'en',
    base: {
      nodes: [
        {
          section: {
            id: PAGE_SECTION_ID,
            richText: {
              props: {},
              blocks: {
                nodes: [
                  {
                    block: {
                      id: VIDEO_BLOCK_ID,
                      paragraph: { props: { textAlignment: 2, previewWidth: 64, aspectRatio: 3 } },
                    },
                    placement: { index: 0 },
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
      locale: 'en',
      sections: [
        {
          sectionId: PAGE_SECTION_ID,
          richText: {
            props: {},
            blocks: {
              locale: 'en',
              blocks: [
                {
                  blockId: VIDEO_BLOCK_ID,
                  paragraph: {
                    props: {},
                    content: [{ link: { href: YOUTUBE_URL, content: [{ text: 'Page recording' }] } }],
                  },
                },
              ],
            },
          },
        },
      ],
    },
  } as unknown as JsonValue);
}

function projectedParagraphType(documentType: 'post' | 'page' | 'work' | 'program-event', profile?: RichTextProfile) {
  const room = new Y.Doc();
  hydrateCanonicalBlockRoom(
    room,
    documentType,
    'en',
    documentType === 'page' ? pageExternalVideoDocument() : externalVideoDocument(profile),
    [],
  );
  const bridge = createBlockRoomProseMirrorBridge({
    document: room,
    documentType,
    locale: 'en',
    ...(documentType === 'page' ? { pageSectionId: PAGE_SECTION_ID } : {}),
  });
  const controller = createRichTextBlockRoomTiptapController(bridge);
  const nodeType = controller.initialContent.content?.[0]?.content?.[0]?.content?.[0]?.type;
  room.destroy();
  return { nodeType, paragraphExternalVideo: controller.paragraphExternalVideo };
}

function mountController() {
  const room = new Y.Doc();
  hydrateCanonicalBlockRoom(room, 'post', 'en', externalVideoDocument(), []);
  const bridge = createBlockRoomProseMirrorBridge({
    document: room,
    documentType: 'post',
    locale: 'en',
    origin: 'post-tiptap-external-video-test',
  });
  const controller = createPostBlockRoomTiptapController(bridge);
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: [
      ...createTiptapWireExtensions({
        externalVideoNode: createTiptapExternalVideoExtension({
          labels: DEFAULT_TIPTAP_EXTERNAL_VIDEO_LABELS,
        }),
      }),
      controller.extension,
    ],
    content: controller.initialContent,
  });
  const disconnect = controller.connect(editor);
  return {
    editor,
    room,
    destroy() {
      disconnect();
      editor.destroy();
      element.remove();
      room.destroy();
    },
  };
}

describe('Block-room external-video projection', () => {
  it.each([
    ['Post', 'post', RichTextProfile.POST, true, 'externalVideo'],
    ['Page', 'page', undefined, true, 'externalVideo'],
    ['Work', 'work', RichTextProfile.WORK, false, 'paragraph'],
    ['Program Event', 'program-event', RichTextProfile.PROGRAM_EVENT, false, 'paragraph'],
  ] as const)(
    '%s uses its generated paragraph external-video capability',
    (_label, documentType, profile, enabled, nodeType) => {
      expect(projectedParagraphType(documentType, profile)).toEqual({
        paragraphExternalVideo: enabled,
        nodeType,
      });
    },
  );

  it('hydrates as one atom and writes layout back without rewriting the canonical Paragraph link', () => {
    const mounted = mountController();
    const [video] = getTiptapStandaloneExternalVideos(mounted.editor.view);
    expect(video).toMatchObject({
      blockId: VIDEO_BLOCK_ID,
      url: YOUTUBE_URL,
      previewWidth: '64',
      textAlignment: 'center',
      aspectRatio: '4:3',
    });
    expect(video?.node.type.name).toBe('externalVideo');

    expect(updateTiptapExternalVideoLayout(mounted.editor, { previewWidth: '72' }, VIDEO_BLOCK_ID)).toBe(true);

    const materialized = materializeCanonicalBlockRoom(mounted.room, 'post');
    if (materialized.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
      throw new Error('Expected Post document.');
    }
    const base = materialized.base?.nodes[0]?.block?.value;
    const locale = materialized.localeOverlay?.blocks[0]?.value;
    expect(base?.case).toBe('paragraph');
    expect(base?.case === 'paragraph' ? base.value.props : undefined).toMatchObject({
      textAlignment: 2,
      previewWidth: 72,
      aspectRatio: 3,
    });
    expect(locale?.case).toBe('paragraph');
    const inline = locale?.case === 'paragraph' ? locale.value.content[0]?.value : undefined;
    expect(inline?.case).toBe('link');
    expect(inline?.case === 'link' ? inline.value : undefined).toMatchObject({
      href: YOUTUBE_URL,
      content: [
        { text: 'Field ', styles: { bold: true } },
        { text: 'recording', styles: { italic: true } },
      ],
    });
    const ordinary = materialized.base?.nodes[1]?.block?.value;
    expect(ordinary?.case === 'paragraph' ? ordinary.value.props?.previewWidth : undefined).toBeUndefined();

    mounted.destroy();
  });

  it('updates the durable Paragraph link while retaining its block identity', () => {
    const mounted = mountController();

    expect(
      updateTiptapExternalVideoSource(
        mounted.editor,
        { url: 'https://vimeo.com/123456789', label: 'Updated recording' },
        VIDEO_BLOCK_ID,
      ),
    ).toBe(true);

    const materialized = materializeCanonicalBlockRoom(mounted.room, 'post');
    if (materialized.$typeName !== 'api.content.v1.LocalizedRichTextDocument') {
      throw new Error('Expected Post document.');
    }
    expect(materialized.base?.nodes[0]?.block?.id).toBe(VIDEO_BLOCK_ID);
    expect(materialized.base?.nodes[0]?.block?.value.case).toBe('paragraph');
    const locale = materialized.localeOverlay?.blocks[0]?.value;
    const inline = locale?.case === 'paragraph' ? locale.value.content[0]?.value : undefined;
    expect(inline?.case === 'link' ? inline.value : undefined).toMatchObject({
      href: 'https://vimeo.com/123456789',
      content: [{ text: 'Updated recording' }],
    });

    mounted.destroy();
  });
});
