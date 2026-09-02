import {
  richTextBlockKindByProtoCase,
  validateLocalizedRichTextDocument,
} from '@echovisionlab/geul-proto/content/block_catalog.ts';
import type {
  LocalizedRichTextDocument,
  RichTextBlock,
  RichTextBlockLocale,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { assertNever, requireRichTextBlockKind } from './block-registry';

type RichTextValue = Exclude<RichTextBlock['value'], { case: undefined }>;
type RichTextLocaleValue = Exclude<RichTextBlockLocale['value'], { case: undefined }>;
type RichTextProtoCase = keyof typeof richTextBlockKindByProtoCase;

type RichTextValueFor<TKind extends RichTextProtoCase> = Extract<RichTextValue, { case: TKind }>['value'];

type RichTextLocaleValueFor<TKind extends RichTextProtoCase> = Extract<RichTextLocaleValue, { case: TKind }>['value'];

export type LocalizedRichTextBlock = {
  [TKind in RichTextProtoCase]: {
    readonly id: string;
    readonly kind: (typeof richTextBlockKindByProtoCase)[TKind];
    readonly base: RichTextValueFor<TKind>;
    readonly locale: RichTextLocaleValueFor<TKind>;
    readonly children: readonly LocalizedRichTextBlock[];
  };
}[RichTextProtoCase];

interface BlockPair {
  readonly block: RichTextBlock;
  readonly locale: RichTextBlockLocale;
  readonly parentBlockId: string | null;
  readonly index: number;
}

function assertLocaleKind<TKind extends RichTextProtoCase>(
  value: RichTextBlockLocale['value'],
  kind: TKind,
): asserts value is Extract<RichTextLocaleValue, { case: TKind }> {
  if (value.case !== kind) {
    throw new Error(`Localized Block kind does not match ${kind}.`);
  }
}

function pairedBlock<TKind extends RichTextProtoCase>(
  id: string,
  protoCase: TKind,
  base: RichTextValueFor<TKind>,
  locale: RichTextLocaleValueFor<TKind>,
  children: readonly LocalizedRichTextBlock[],
): LocalizedRichTextBlock {
  return {
    id,
    kind: richTextBlockKindByProtoCase[protoCase],
    base,
    locale,
    children,
  } as LocalizedRichTextBlock;
}

function materializePair(pair: BlockPair, children: readonly LocalizedRichTextBlock[]): LocalizedRichTextBlock {
  if (pair.block.value.case === undefined) {
    throw new Error(`Localized rich-text Block ${pair.block.id} has no kind.`);
  }
  requireRichTextBlockKind(richTextBlockKindByProtoCase[pair.block.value.case]);
  if (pair.locale.value.case !== pair.block.value.case) {
    throw new Error(`Localized Block ${pair.block.id} kind does not match its base Block.`);
  }

  switch (pair.block.value.case) {
    case 'paragraph': {
      assertLocaleKind(pair.locale.value, 'paragraph');
      return pairedBlock(pair.block.id, 'paragraph', pair.block.value.value, pair.locale.value.value, children);
    }
    case 'heading': {
      assertLocaleKind(pair.locale.value, 'heading');
      return pairedBlock(pair.block.id, 'heading', pair.block.value.value, pair.locale.value.value, children);
    }
    case 'bulletListItem': {
      assertLocaleKind(pair.locale.value, 'bulletListItem');
      return pairedBlock(pair.block.id, 'bulletListItem', pair.block.value.value, pair.locale.value.value, children);
    }
    case 'numberedListItem': {
      assertLocaleKind(pair.locale.value, 'numberedListItem');
      return pairedBlock(pair.block.id, 'numberedListItem', pair.block.value.value, pair.locale.value.value, children);
    }
    case 'checkListItem': {
      assertLocaleKind(pair.locale.value, 'checkListItem');
      return pairedBlock(pair.block.id, 'checkListItem', pair.block.value.value, pair.locale.value.value, children);
    }
    case 'quote': {
      assertLocaleKind(pair.locale.value, 'quote');
      return pairedBlock(pair.block.id, 'quote', pair.block.value.value, pair.locale.value.value, children);
    }
    case 'callout': {
      assertLocaleKind(pair.locale.value, 'callout');
      return pairedBlock(pair.block.id, 'callout', pair.block.value.value, pair.locale.value.value, children);
    }
    case 'codeBlock': {
      assertLocaleKind(pair.locale.value, 'codeBlock');
      return pairedBlock(pair.block.id, 'codeBlock', pair.block.value.value, pair.locale.value.value, children);
    }
    case 'divider': {
      assertLocaleKind(pair.locale.value, 'divider');
      return pairedBlock(pair.block.id, 'divider', pair.block.value.value, pair.locale.value.value, children);
    }
    case 'table': {
      assertLocaleKind(pair.locale.value, 'table');
      return pairedBlock(pair.block.id, 'table', pair.block.value.value, pair.locale.value.value, children);
    }
    case 'p5Sketch': {
      assertLocaleKind(pair.locale.value, 'p5Sketch');
      return pairedBlock(pair.block.id, 'p5Sketch', pair.block.value.value, pair.locale.value.value, children);
    }
    case 'threeScene': {
      assertLocaleKind(pair.locale.value, 'threeScene');
      return pairedBlock(pair.block.id, 'threeScene', pair.block.value.value, pair.locale.value.value, children);
    }
    case 'shader': {
      assertLocaleKind(pair.locale.value, 'shader');
      return pairedBlock(pair.block.id, 'shader', pair.block.value.value, pair.locale.value.value, children);
    }
    case 'math': {
      assertLocaleKind(pair.locale.value, 'math');
      return pairedBlock(pair.block.id, 'math', pair.block.value.value, pair.locale.value.value, children);
    }
    case 'map': {
      assertLocaleKind(pair.locale.value, 'map');
      return pairedBlock(pair.block.id, 'map', pair.block.value.value, pair.locale.value.value, children);
    }
    case 'file': {
      assertLocaleKind(pair.locale.value, 'file');
      return pairedBlock(pair.block.id, 'file', pair.block.value.value, pair.locale.value.value, children);
    }
    case undefined:
      throw new Error(`Localized rich-text Block ${pair.block.id} has no kind.`);
    default:
      return assertNever(pair.block.value, 'Unsupported localized rich-text Block kind');
  }
}

/**
 * Materializes the generated flat graph into the only tree shape accepted by
 * Tiptap and public rendering. Generated validation remains the authority for
 * IDs, profiles, field ownership, positions, and kind-specific payloads.
 */
export function materializeLocalizedRichTextTree(
  document: LocalizedRichTextDocument,
): readonly LocalizedRichTextBlock[] {
  validateLocalizedRichTextDocument(document);
  const overlay = document.localeOverlay;
  const base = document.base;
  if (!overlay || !base) {
    throw new Error('Localized rich-text document is incomplete.');
  }

  const localeById = new Map(overlay.blocks.map((block) => [block.blockId, block]));
  const pairs: BlockPair[] = base.nodes.map((node) => {
    if (!node.block || !node.placement) {
      throw new Error('Localized rich-text graph contains an incomplete Block node.');
    }
    const locale = localeById.get(node.block.id);
    if (!locale) {
      throw new Error(`Localized rich-text Block ${node.block.id} has no locale payload.`);
    }
    return {
      block: node.block,
      locale,
      parentBlockId: node.placement.parentBlockId ?? null,
      index: node.placement.index,
    };
  });

  const childrenByParent = new Map<string | null, BlockPair[]>();
  for (const pair of pairs) {
    const siblings = childrenByParent.get(pair.parentBlockId) ?? [];
    siblings.push(pair);
    childrenByParent.set(pair.parentBlockId, siblings);
  }
  for (const siblings of childrenByParent.values()) {
    siblings.sort((left, right) => left.index - right.index);
  }

  const build = (parentBlockId: string | null): readonly LocalizedRichTextBlock[] =>
    (childrenByParent.get(parentBlockId) ?? []).map((pair) => materializePair(pair, build(pair.block.id)));

  return build(null);
}
