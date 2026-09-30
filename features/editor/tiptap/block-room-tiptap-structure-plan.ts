import type { RichTextBlockData, RichTextBlockLocaleData } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import type { ProseMirrorBlockDescriptor } from './block-room-prosemirror-bridge';
import {
  emptyLocalePayload,
  flatten,
  generatedData,
  generatedLocaleData,
  splitPayload,
  type JsonObject,
  type TiptapBlockSnapshot,
} from './block-room-tiptap-codec';

export interface PreviousTiptapBlock extends ProseMirrorBlockDescriptor {
  readonly parentId: string | null;
  readonly position: number;
}

interface Placement {
  readonly parentBlockId?: string;
  readonly index: number;
}

interface BlockPayload {
  readonly base: JsonObject;
  readonly locale: JsonObject;
}

interface NewBlockData {
  readonly data: RichTextBlockData;
  readonly localeData: Readonly<Record<string, RichTextBlockLocaleData>>;
}

export type TiptapStructureOperation =
  | { readonly type: 'delete'; readonly blockId: string }
  | {
      readonly type: 'insert';
      readonly block: TiptapBlockSnapshot;
      readonly placement: Placement;
      readonly needsAnchor: boolean;
      readonly data: NewBlockData;
    }
  | { readonly type: 'move'; readonly blockId: string; readonly placement: Placement }
  | {
      readonly type: 'replace-kind';
      readonly block: TiptapBlockSnapshot;
      readonly previous: PreviousTiptapBlock;
      readonly data: NewBlockData;
    }
  | {
      readonly type: 'update-payload';
      readonly block: TiptapBlockSnapshot;
      readonly previous: PreviousTiptapBlock;
      readonly payload: BlockPayload;
    };

export interface TiptapStructurePlan {
  readonly operations: readonly TiptapStructureOperation[];
}

interface LocatedBlock {
  readonly parentId: string | null;
  readonly index: number;
}

/** Builds an ordered snapshot diff without reading or mutating the Yjs room. */
export function planTiptapStructure(
  previousDescriptors: readonly ProseMirrorBlockDescriptor[],
  nextRoots: readonly TiptapBlockSnapshot[],
  locales: readonly string[],
  activeLocale: string,
): TiptapStructurePlan {
  const next = flatten(nextRoots);
  const previous = new Map(flattenPrevious(previousDescriptors).map((block) => [block.id, block]));
  const nextById = new Map(next.map((block) => [block.id, block]));
  const workingOrders = new BlockOrderIndex(previousDescriptors);
  const retainedAncestors = new Set<string>();
  const operations: TiptapStructureOperation[] = [];

  for (const block of next) {
    let parentId = previous.get(block.id)?.parentId;
    while (parentId && !retainedAncestors.has(parentId)) {
      retainedAncestors.add(parentId);
      parentId = previous.get(parentId)?.parentId;
    }
  }

  // Drop fully discarded subtrees before moving survivors, so those survivors
  // do not need moves just to fill gaps left by deleted siblings.
  for (const block of [...previous.values()].reverse()) {
    if (!nextById.has(block.id) && !retainedAncestors.has(block.id)) {
      operations.push({ type: 'delete', blockId: block.id });
      workingOrders.remove(block.id);
    }
  }

  for (const block of next) {
    const before = previous.get(block.id);
    const payload = splitPayload(block);
    const targetParentId = block.parentBlockId ?? null;
    if (!before) {
      const targetOrder = workingOrders.get(targetParentId) ?? [];
      operations.push({
        type: 'insert',
        block,
        placement: { parentBlockId: block.parentBlockId, index: block.index },
        needsAnchor: targetOrder.length > 0,
        data: createBlockData(block.protoCase, payload, locales, activeLocale),
      });
      workingOrders.insert(targetParentId, block.index, block.id);
      continue;
    }

    const current = workingOrders.locate(block.id);
    if (!current) {
      throw new Error(`Existing Block ${block.id} is missing from the structural order.`);
    }
    if (current.parentId !== targetParentId || current.index !== block.index) {
      operations.push({
        type: 'move',
        blockId: block.id,
        placement: { parentBlockId: block.parentBlockId, index: block.index },
      });
      workingOrders.remove(block.id);
      workingOrders.insert(targetParentId, block.index, block.id);
    }

    if (before.adapter.protoCase !== block.protoCase) {
      operations.push({
        type: 'replace-kind',
        block,
        previous: before,
        data: createBlockData(block.protoCase, payload, locales, activeLocale),
      });
      continue;
    }

    operations.push({ type: 'update-payload', block, previous: before, payload });
  }

  // Ancestors of surviving children are removed only after those children have
  // moved to their requested parents.
  for (const block of [...previous.values()].reverse()) {
    if (!nextById.has(block.id) && retainedAncestors.has(block.id)) {
      operations.push({ type: 'delete', blockId: block.id });
      workingOrders.remove(block.id);
    }
  }

  return { operations };
}

function createBlockData(
  protoCase: TiptapBlockSnapshot['protoCase'],
  payload: BlockPayload,
  locales: readonly string[],
  activeLocale: string,
): NewBlockData {
  return {
    data: generatedData(protoCase, payload.base),
    localeData: Object.fromEntries(
      locales.map((locale) => [
        locale,
        generatedLocaleData(
          protoCase,
          locale === activeLocale ? payload.locale : emptyLocalePayload(protoCase, payload.base),
        ),
      ]),
    ),
  };
}

function flattenPrevious(
  blocks: readonly ProseMirrorBlockDescriptor[],
  parentId: string | null = null,
): readonly PreviousTiptapBlock[] {
  return blocks.flatMap((block, position) => [
    { ...block, parentId, position },
    ...flattenPrevious(block.children, block.id),
  ]);
}

function descriptorOrders(
  blocks: readonly ProseMirrorBlockDescriptor[],
  parentId: string | null = null,
  result = new Map<string | null, string[]>(),
): Map<string | null, string[]> {
  result.set(
    parentId,
    blocks.map((block) => block.id),
  );
  for (const block of blocks) {
    descriptorOrders(block.children, block.id, result);
  }
  return result;
}

/** Index positions once; only affected sibling lists are reindexed on moves. */
class BlockOrderIndex {
  readonly #orders: Map<string | null, string[]>;
  readonly #locations = new Map<string, LocatedBlock>();

  constructor(blocks: readonly ProseMirrorBlockDescriptor[]) {
    this.#orders = descriptorOrders(blocks);
    for (const parentId of this.#orders.keys()) {
      this.#reindex(parentId);
    }
  }

  get(parentId: string | null): readonly string[] | undefined {
    return this.#orders.get(parentId);
  }

  locate(blockId: string): LocatedBlock | undefined {
    return this.#locations.get(blockId);
  }

  remove(blockId: string): void {
    const current = this.locate(blockId);
    if (!current) {
      return;
    }
    this.#orders.get(current.parentId)?.splice(current.index, 1);
    this.#locations.delete(blockId);
    this.#reindex(current.parentId);
  }

  insert(parentId: string | null, index: number, blockId: string): void {
    const order = this.#orders.get(parentId) ?? [];
    if (index < 0 || index > order.length) {
      throw new Error(`Block ${blockId} index ${index} is outside its target order.`);
    }
    order.splice(index, 0, blockId);
    this.#orders.set(parentId, order);
    this.#reindex(parentId);
  }

  #reindex(parentId: string | null): void {
    this.#orders.get(parentId)?.forEach((id, index) => this.#locations.set(id, { parentId, index }));
  }
}
