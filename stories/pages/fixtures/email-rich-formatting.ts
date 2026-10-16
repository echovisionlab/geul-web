import { fromJson } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';

/** Canonical blocks, not rendered HTML: editor and delivery serializer read this document. */
export function localRichFormattingEmailDocument() {
  const id = (index: number) => `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.EMAIL,
    locale: 'ko',
    base: {
      nodes: [
        { block: { id: id(1), paragraph: { props: {} } }, placement: { index: 0 } },
        { block: { id: id(2), heading: { props: { level: 2 } } }, placement: { index: 1 } },
        { block: { id: id(3), bulletListItem: { props: {} } }, placement: { index: 2 } },
        { block: { id: id(4), bulletListItem: { props: {} } }, placement: { index: 3 } },
        { block: { id: id(5), quote: { props: {} } }, placement: { index: 4 } },
        { block: { id: id(6), paragraph: { props: {} } }, placement: { index: 5 } },
      ],
    },
    localeOverlay: {
      locale: 'ko',
      blocks: [
        {
          blockId: id(1),
          paragraph: {
            props: {},
            content: [{ text: { text: 'First line' } }, { hardBreak: {} }, { text: { text: 'After hard break' } }],
          },
        },
        { blockId: id(2), heading: { props: {}, content: [{ text: { text: 'Email heading' } }] } },
        { blockId: id(3), bulletListItem: { props: {}, content: [{ text: { text: 'one /' } }] } },
        { blockId: id(4), bulletListItem: { props: {}, content: [{ text: { text: 'two' } }] } },
        { blockId: id(5), quote: { props: {}, content: [{ text: { text: 'quote' } }] } },
        { blockId: id(6), paragraph: { props: {}, content: [{ text: { text: 'Second paragraph' } }] } },
      ],
    },
  });
}
