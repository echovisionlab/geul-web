import { fromJson, type JsonObject, type JsonValue } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { DOCUMENT_COLOR_VALUES } from '@/components/core/DocumentColorPreview';

export const colorBlockId = (index: number) => `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;

/** The same persisted protobuf/Yjs document feeds the real editor and published renderer. */
export function createDocumentColorComparisonDocument() {
  const rows = DOCUMENT_COLOR_VALUES.flatMap<{ id: string; props: JsonObject; content: JsonValue[] }>(
    (color, index): { id: string; props: JsonObject; content: JsonValue[] }[] => [
      {
        id: colorBlockId(index * 2),
        props: { textColor: color, backgroundColor: color },
        content: [{ text: { text: `${color} · Block text and background` } }],
      },
      {
        id: colorBlockId(index * 2 + 1),
        props: {},
        content: [
          { text: { text: `${color} · Inline text`, styles: { textColor: color } } },
          { text: { text: ' / ' } },
          { text: { text: 'Inline background', styles: { backgroundColor: color } } },
        ],
      },
    ],
  );
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale: 'ko',
    base: {
      nodes: [
        ...rows.map((row, index) => ({
          block: { id: row.id, paragraph: { props: row.props } },
          placement: { index },
        })),
        {
          block: {
            id: colorBlockId(20),
            table: {
              props: { displaySize: 100 },
              content: {
                columnWidths: [100],
                rows: DOCUMENT_COLOR_VALUES.map((color, index) => ({
                  id: colorBlockId(100 + index),
                  cells: [{ id: colorBlockId(200 + index), props: { textColor: color, backgroundColor: color } }],
                })),
              },
            },
          },
          placement: { index: 20 },
        },
      ],
    },
    localeOverlay: {
      locale: 'ko',
      blocks: [
        ...rows.map((row) => ({ blockId: row.id, paragraph: { props: {}, content: row.content } })),
        {
          blockId: colorBlockId(20),
          table: {
            props: {},
            content: {
              rows: DOCUMENT_COLOR_VALUES.map((color, index) => ({
                rowId: colorBlockId(100 + index),
                cells: [{ cellId: colorBlockId(200 + index), content: [{ text: { text: `${color} · Table cell` } }] }],
              })),
            },
          },
        },
      ],
    },
  });
}
