import { fromJson, type JsonObject } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { DEFAULT_SHADER_PROGRAM, SHADER_STAGE_DEFINITIONS } from './shader/shader-program';

/** Stable IDs let the browser compare each published block with its editor node. */
export function createPublicBlockComparisonDocument(includeRuntimes = false) {
  const nodes: JsonObject[] = [];
  const blocks: JsonObject[] = [];
  const siblingCounts = new Map<string, number>();
  let sequence = 0;
  const id = () => `10000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  function add(kind: string, base: JsonObject, locale: JsonObject, parentBlockId?: string) {
    const blockId = id();
    const parent = parentBlockId ?? '';
    const index = siblingCounts.get(parent) ?? 0;
    siblingCounts.set(parent, index + 1);
    nodes.push({
      block: { id: blockId, [kind]: base },
      placement: { index, ...(parentBlockId ? { parentBlockId } : {}) },
    });
    blocks.push({ blockId, [kind]: locale });
    return blockId;
  }
  const text = (value: string) => [{ text: { text: value } }];
  for (const level of [1, 2, 3]) {
    add('heading', { props: { level } }, { props: {}, content: text(`제목 ${level} · Heading ${level}`) });
  }
  const parent = add(
    'paragraph',
    { props: {} },
    {
      props: {},
      content: [
        ...text('한글과 Latin,  연속 공백과 줄바꿈을 비교합니다.'),
        { hardBreak: {} },
        { text: { text: '굵게 ', styles: { bold: true } } },
        { text: { text: '기울임 ', styles: { italic: true } } },
        { text: { text: '밑줄 ', styles: { underline: true } } },
        { text: { text: '취소선 ', styles: { strike: true } } },
        { text: { text: 'inline code', styles: { code: true } } },
        { link: { href: 'https://example.com', content: [{ text: ' 링크' }] } },
      ],
    },
  );
  add('paragraph', { props: {} }, { props: {}, content: text('문단 아래의 중첩 문단') }, parent);
  add('paragraph', { props: {} }, { props: {}, content: [] });
  add('heading', { props: { level: 2 } }, { props: {}, content: [] });
  for (const textAlignment of [2, 3]) {
    add(
      'paragraph',
      { props: { textAlignment, textColor: 'blue', backgroundColor: 'yellow' } },
      { props: {}, content: text('정렬과 블록 색상') },
    );
  }
  const list = add('bulletListItem', { props: {} }, { props: {}, content: text('목록의 첫 항목') });
  const nested = add('bulletListItem', { props: {} }, { props: {}, content: text('중첩 목록') }, list);
  add('paragraph', { props: {} }, { props: {}, content: text('중첩 목록 아래 문단') }, nested);
  add('bulletListItem', { props: {} }, { props: {}, content: [] });
  add('numberedListItem', { props: {} }, { props: {}, content: text('첫 번째 순서') });
  add('numberedListItem', { props: {} }, { props: {}, content: text('두 번째 순서') });
  const check = add('checkListItem', { props: { checked: true } }, { props: {}, content: text('완료한 항목') });
  add('paragraph', { props: {} }, { props: {}, content: text('체크 항목 아래 문단') }, check);
  add('checkListItem', { props: {} }, { props: {}, content: [] });
  add('quote', { props: {} }, { props: {}, content: text('인용문 🙂 Quote') });
  add('quote', { props: { textColor: 'blue', backgroundColor: 'yellow' } }, { props: {}, content: [] });
  const callout = add(
    'callout',
    { props: { icon: '💡', backgroundColor: 'gray' } },
    { props: {}, content: text('콜아웃의 첫 줄') },
  );
  add('paragraph', { props: {} }, { props: {}, content: text('콜아웃 안의 문단') }, callout);
  add('bulletListItem', { props: {} }, { props: {}, content: text('콜아웃 안의 목록') }, callout);
  add('divider', {}, {});
  // Compare filled and empty body cells while keeping real column headings in both specimens.
  for (const emptyBody of [false, true]) {
    const rowIds = [id(), id(), id()];
    const cellIds = rowIds.map(() => [id(), id()]);
    add(
      'table',
      {
        props: { previewWidth: 100 },
        content: {
          columnWidths: [40, 60],
          headerRows: 1,
          rows: rowIds.map((rowId, row) => ({
            id: rowId,
            cells: cellIds[row]!.map((cellId, column): JsonObject => ({
              id: cellId,
              header: row === 0,
              props: column === 1 ? { textAlignment: 2, backgroundColor: 'yellow' } : {},
            })),
          })),
        },
      },
      {
        props: {},
        content: {
          rows: rowIds.map((rowId, row) => ({
            rowId,
            cells: cellIds[row]!.map((cellId, column) => ({
              cellId,
              content: row === 0 ? text(`열 ${column + 1}`) : emptyBody ? [] : text(`표 내용 ${row}-${column}`),
            })),
          })),
        },
      },
    );
  }
  add(
    'codeBlock',
    { props: { language: 1 } },
    { props: { title: '코드 블록' }, content: 'const value = 1;\nconsole.log(value);' },
  );
  add(
    'paragraph',
    { props: {} },
    { props: {}, content: [...text('인라인 수식 '), { mathInline: { source: 'x^2 + y^2' } }] },
  );
  add('math', { props: { latex: '\\frac{a}{b} = \\sqrt{x}' } }, {});
  add(
    'math',
    {
      props: {
        latex: Array.from(
          { length: 12 },
          (_, index) =>
            `\\frac{a_{${index + 1}}^2 + b_{${index + 1}}^2}{\\sqrt{x_{${index + 1}}^2 + y_{${index + 1}}^2}}`,
        ).join(' + '),
      },
    },
    {},
  );
  add('mermaid', { props: { source: 'flowchart LR\n A[초안] --> B[발행]' } }, { props: { title: '다이어그램' } });
  if (includeRuntimes) {
    add('map', { props: { aspectRatio: 2 } }, { props: { caption: '지도 캡션' } });
    add(
      'file',
      { props: { attachment: { missingAttachment: { formerFileId: id(), mediaKind: 1 } }, name: '파일' } },
      { props: { caption: '파일 캡션' } },
    );
    add(
      'p5Sketch',
      {
        props: {
          previewHeight: 180,
          source: 'function setup() { createCanvas(200, 180); noLoop(); }\nfunction draw() { background(180); }',
        },
      },
      { props: { title: 'p5' } },
    );
    add(
      'threeScene',
      { props: { previewHeight: 180, language: 1, source: '// Scene' } },
      { props: { title: 'Three.js' } },
    );
    add(
      'shader',
      {
        props: {
          previewHeight: 180,
          stages: SHADER_STAGE_DEFINITIONS.map(([stage], index) => ({
            kind: index + 1,
            source: DEFAULT_SHADER_PROGRAM.sources[stage],
            channels: index < 2 ? [] : Array.from({ length: 4 }, () => ({ kind: 1 })),
          })),
        },
      },
      { props: { title: 'Shader' } },
    );
  }
  return fromJson(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale: 'ko',
    base: { nodes },
    localeOverlay: { locale: 'ko', blocks },
  });
}
