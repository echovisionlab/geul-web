import {
  richTextBlockKindByProtoCase,
  type RichTextBlockKind,
} from '@echovisionlab/geul-proto/content/block_catalog.ts';

export type RichTextBlockProtoCase = keyof typeof richTextBlockKindByProtoCase;

export type ProseMirrorContentShape = 'atom' | 'inline' | 'plain-text' | 'shader' | 'source-text' | 'table';

export interface RichTextProseMirrorAdapter {
  readonly kind: RichTextBlockKind;
  readonly protoCase: RichTextBlockProtoCase;
  readonly nodeType: RichTextBlockProtoCase;
  readonly contentShape: ProseMirrorContentShape;
}

function adapter<TProtoCase extends RichTextBlockProtoCase>(
  protoCase: TProtoCase,
  contentShape: ProseMirrorContentShape,
): RichTextProseMirrorAdapter {
  return {
    kind: richTextBlockKindByProtoCase[protoCase],
    protoCase,
    nodeType: protoCase,
    contentShape,
  };
}

/**
 * Compile-time exhaustive generated Block-to-ProseMirror registration.
 *
 * The generated catalog owns durable kind names. `nodeType` is the canonical
 * Geul Tiptap wire node name and is kept at this single bridge boundary instead
 * of being inferred by components.
 */
export const richTextProseMirrorAdapters = {
  paragraph: adapter('paragraph', 'inline'),
  heading: adapter('heading', 'inline'),
  'bullet-list-item': adapter('bulletListItem', 'inline'),
  'numbered-list-item': adapter('numberedListItem', 'inline'),
  'check-list-item': adapter('checkListItem', 'inline'),
  quote: adapter('quote', 'inline'),
  'code-block': adapter('codeBlock', 'plain-text'),
  divider: adapter('divider', 'atom'),
  table: adapter('table', 'table'),
  'p5-sketch': adapter('p5Sketch', 'source-text'),
  'three-scene': adapter('threeScene', 'source-text'),
  shader: adapter('shader', 'shader'),
  math: adapter('math', 'atom'),
  map: adapter('map', 'atom'),
  file: adapter('file', 'atom'),
  callout: adapter('callout', 'inline'),
} as const satisfies Record<RichTextBlockKind, RichTextProseMirrorAdapter>;

function hasOwn<TObject extends object>(value: TObject, key: PropertyKey): key is keyof TObject {
  return Object.hasOwn(value, key);
}

export function richTextProseMirrorAdapterForProtoCase(protoCase: string): RichTextProseMirrorAdapter {
  if (!hasOwn(richTextBlockKindByProtoCase, protoCase)) {
    throw new Error(`Unsupported generated rich-text Block proto case: ${protoCase}`);
  }
  return richTextProseMirrorAdapters[richTextBlockKindByProtoCase[protoCase]];
}
