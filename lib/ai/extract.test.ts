import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { LocalizedPageDocumentSchema } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { hydrateCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { LooseBlock } from '@/lib/types/editor/schema';
import { extractBlocksMetadataText, extractPageDocumentMetadataText, extractXmlFragmentMetadataText } from './extract';

describe('extractBlocksMetadataText', () => {
  it('includes headings, inline math, captions, and special block props', () => {
    const blocks: LooseBlock[] = [
      {
        id: 'heading-1',
        type: 'heading',
        props: { level: 2 },
        content: [{ type: 'text', text: 'Signal and Surface' }],
        children: [],
      },
      {
        id: 'paragraph-1',
        type: 'paragraph',
        props: {},
        content: [
          { type: 'text', text: 'An installation using the relation' },
          { type: 'mathInline', props: { latex: 'E = mc^2' } },
          { type: 'text', text: 'as a visual motif.' },
        ],
        children: [],
      },
      {
        id: 'image-1',
        type: 'file',
        props: {
          mimeType: 'image/jpeg',
          caption: 'Projection still with sensor grid',
          alt: 'Projected grid in the gallery',
          name: 'still.jpg',
        },
        children: [],
      },
      {
        id: 'math-1',
        type: 'math',
        props: { latex: '\\int_0^1 x^2 dx' },
        children: [],
      },
      {
        id: 'map-1',
        type: 'map',
        props: {
          caption: 'Installation site in Seoul',
          location: 'Seoul, South Korea',
        },
        children: [],
      },
    ];

    const text = extractBlocksMetadataText(blocks);

    expect(text).toContain('Heading: Signal and Surface');
    expect(text).toContain('An installation using the relation E = mc^2 as a visual motif.');
    expect(text).toContain('Image file: still.jpg');
    expect(text).toContain('Image caption: Projection still with sensor grid');
    expect(text).toContain('Image alt: Projected grid in the gallery');
    expect(text).toContain('Math: \\int_0^1 x^2 dx');
    expect(text).toContain('Map caption: Installation site in Seoul');
    expect(text).toContain('Map location: Seoul, South Korea');
  });

  it('avoids repeating identical media values', () => {
    const blocks: LooseBlock[] = [
      {
        id: 'video-1',
        type: 'file',
        props: {
          mimeType: 'video/mp4',
          name: 'Documentation clip',
          caption: 'Documentation clip',
        },
        children: [],
      },
    ];

    const text = extractBlocksMetadataText(blocks);

    expect(text).toContain('Video file: Documentation clip');
    expect(text).not.toContain('Video caption: Documentation clip');
    expect(text).not.toContain('Video title:');
  });

  it('extracts metadata text from Yjs XML block documents', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('document-store');
    const blockgroup = new Y.XmlElement('blockgroup');
    const firstContainer = new Y.XmlElement('blockcontainer');
    const firstParagraph = new Y.XmlElement('paragraph');
    const firstText = new Y.XmlText();
    firstText.insert(0, '시그널 프로세싱 및 C++ 사운드 개발에 대한 이야기');
    firstParagraph.insert(0, [firstText]);
    firstContainer.insert(0, [firstParagraph]);

    const secondContainer = new Y.XmlElement('blockcontainer');
    const secondParagraph = new Y.XmlElement('paragraph');
    const secondText = new Y.XmlText();
    secondText.insert(0, '실시간 처리의 중요성은 아무리 강조해도 지나치지 않습니다.');
    secondParagraph.insert(0, [secondText]);
    secondContainer.insert(0, [secondParagraph]);

    blockgroup.insert(0, [firstContainer, secondContainer]);
    fragment.insert(0, [blockgroup]);

    const text = extractXmlFragmentMetadataText(fragment);

    expect(text).toContain('시그널 프로세싱 및 C++ 사운드 개발에 대한 이야기');
    expect(text).toContain('실시간 처리의 중요성은 아무리 강조해도 지나치지 않습니다.');
  });

  it('extracts the requested locale from a typed resident Page room', () => {
    const contentDoc = new Y.Doc();
    hydrateCanonicalBlockRoom(
      contentDoc,
      'page',
      'ko',
      fromJson(LocalizedPageDocumentSchema, {
        blockCatalogFingerprint: contentBlockCatalogFingerprint,
        locale: 'en',
        base: {
          nodes: [
            {
              section: {
                id: '019ccf00-0000-7000-8000-000000000001',
                richText: {
                  props: {},
                  blocks: {
                    nodes: [
                      {
                        block: { id: '019ccf00-0000-7000-8000-000000000002', paragraph: { props: {} } },
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
              sectionId: '019ccf00-0000-7000-8000-000000000001',
              richText: {
                props: {},
                blocks: {
                  locale: 'en',
                  blocks: [
                    {
                      blockId: '019ccf00-0000-7000-8000-000000000002',
                      paragraph: { props: {}, content: [{ text: { text: 'English target body' } }] },
                    },
                  ],
                },
              },
            },
          ],
        },
      } as JsonValue),
      [],
    );

    expect(extractPageDocumentMetadataText(contentDoc)).toContain('English target body');
  });
});
