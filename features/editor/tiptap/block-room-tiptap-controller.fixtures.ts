import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
  type LocalizedRichTextDocument,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';

export const authoredMathLatex = String.raw`\frac{a}{b} + \frac{c}{d}`;

export function allKindsDocument(): LocalizedRichTextDocument {
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
    { math: { props: { latex: authoredMathLatex } } },
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
