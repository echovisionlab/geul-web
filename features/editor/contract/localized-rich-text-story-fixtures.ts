import { create } from '@bufbuild/protobuf';
import {
  CodeBlockBlockLocaleSchema,
  CodeBlockBlockSchema,
  CodeBlockProps_Language,
  CodeBlockProps_TextAlignment,
  HeadingBlockLocaleSchema,
  HeadingBlockSchema,
  HeadingProps_Level,
  ParagraphBlockLocaleSchema,
  ParagraphBlockSchema,
  RichTextInlineSchema,
  TableBlockLocaleSchema,
  TableBlockSchema,
  TableProps_TextAlignment,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import type { LocalizedRichTextBlock } from './localized-rich-text';

function textInline(text: string) {
  return create(RichTextInlineSchema, {
    value: { case: 'text', value: { text } },
  });
}

export function storyParagraph(id: string, text: string): LocalizedRichTextBlock {
  return {
    id,
    kind: 'paragraph',
    base: create(ParagraphBlockSchema, { props: {} }),
    locale: create(ParagraphBlockLocaleSchema, { props: {}, content: [textInline(text)] }),
    children: [],
  };
}

export function storyHeading(id: string, text: string): LocalizedRichTextBlock {
  return {
    id,
    kind: 'heading',
    base: create(HeadingBlockSchema, { props: { level: HeadingProps_Level.LEVEL_2 } }),
    locale: create(HeadingBlockLocaleSchema, { props: {}, content: [textInline(text)] }),
    children: [],
  };
}

export function storyCodeBlock(id: string, source: string, title: string): LocalizedRichTextBlock {
  return {
    id,
    kind: 'code-block',
    base: create(CodeBlockBlockSchema, {
      props: {
        language: CodeBlockProps_Language.TYPESCRIPT,
        previewWidth: 100,
        textAlignment: CodeBlockProps_TextAlignment.LEFT,
      },
    }),
    locale: create(CodeBlockBlockLocaleSchema, { props: { title }, content: source }),
    children: [],
  };
}

export function storyTable(
  id: string,
  header: readonly string[],
  rows: readonly (readonly string[])[],
  columnWidths: readonly number[],
): LocalizedRichTextBlock {
  const allRows = [header, ...rows];
  return {
    id,
    kind: 'table',
    base: create(TableBlockSchema, {
      props: { previewWidth: 100, textAlignment: TableProps_TextAlignment.LEFT },
      content: {
        columnWidths: [...columnWidths],
        headerRows: 1,
        rows: allRows.map((row, rowIndex) => ({
          cells: row.map(() => ({ header: rowIndex === 0, props: {} })),
        })),
      },
    }),
    locale: create(TableBlockLocaleSchema, {
      props: {},
      content: {
        rows: allRows.map((row) => ({
          cells: row.map((text) => ({ content: [textInline(text)] })),
        })),
      },
    }),
    children: [],
  };
}
