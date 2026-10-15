import { create, toJson } from '@bufbuild/protobuf';
import {
  RichTextBlockDataSchema,
  RichTextBlockLocaleDataSchema,
  type LocalizedRichTextDocument,
  type LocalizedPageDocument,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  materializeLocalizedRichTextTree,
  type LocalizedRichTextBlock,
} from '@/features/editor/contract/localized-rich-text';
import { materializeLocalizedPageSections, type LocalizedPageSection } from '@/features/editor/contract/localized-page';
import { documentToTiptap, object } from '@/features/editor/tiptap/block-room-tiptap-codec';
import { richTextProseMirrorAdapters } from '@/features/editor/tiptap/block-room-prosemirror-registry';
import type { ProseMirrorBlockDescriptor } from '@/features/editor/tiptap/block-room-prosemirror-bridge';
import type { EditorSnapshot } from '@/features/editor/editor-snapshot';

function descriptors(blocks: readonly LocalizedRichTextBlock[]): ProseMirrorBlockDescriptor[] {
  return blocks.map((block) => {
    const adapter = richTextProseMirrorAdapters[block.kind];
    // The generated union was already paired and validated by materialization.
    const base = create(RichTextBlockDataSchema, {
      value: { case: adapter.protoCase, value: block.base },
    } as Parameters<typeof create<typeof RichTextBlockDataSchema>>[1]);
    const locale = create(RichTextBlockLocaleDataSchema, {
      value: { case: adapter.protoCase, value: block.locale },
    } as Parameters<typeof create<typeof RichTextBlockLocaleDataSchema>>[1]);
    return {
      id: block.id,
      adapter,
      basePayload: object(object(toJson(RichTextBlockDataSchema, base))[adapter.protoCase]),
      localePayload: object(object(toJson(RichTextBlockLocaleDataSchema, locale))[adapter.protoCase]),
      children: descriptors(block.children),
    };
  });
}

export function richTextSnapshotContent(blocks: readonly LocalizedRichTextBlock[]) {
  return documentToTiptap(descriptors(blocks), { paragraphExternalVideo: true });
}

export function postSnapshotContent(document: LocalizedRichTextDocument) {
  return richTextSnapshotContent(materializeLocalizedRichTextTree(document));
}

function pageSections(sections: readonly LocalizedPageSection[]): NonNullable<EditorSnapshot['sections']> {
  return sections.map(({ richText, columns, ...section }) => ({
    ...section,
    blocks: richText ?? undefined,
    content: richText ? richTextSnapshotContent(richText) : undefined,
    columns: columns.map((column) => ({ ...column, sections: pageSections(column.sections) })),
  }));
}

export function pageSnapshotSections(document: LocalizedPageDocument) {
  return pageSections(materializeLocalizedPageSections(document));
}
