import type { BlockInsertResult, InsertPosition } from '@/features/editor/lib/block-insert';
import type {
  EditorMediaBlock,
  EditorMediaCommandPort,
  SelectedFileBlock,
} from '@/features/editor/lib/media-block-updates';

export type EditorMediaCommandOperation =
  | { type: 'getBlock'; blockId: string; result: SelectedFileBlock | null }
  | { type: 'updateBlockProps'; blockId: string; props: Record<string, unknown>; result: boolean }
  | { type: 'deleteBlock'; blockId: string; result: boolean }
  | {
      type: 'insertBlock';
      block: EditorMediaBlock;
      savedPosition: InsertPosition | null;
      result: BlockInsertResult;
    }
  | { type: 'captureInsertPosition'; result: InsertPosition | null }
  | { type: 'applyNeutralBlockProps'; blockId: string; props: Record<string, unknown> }
  | { type: 'deleteNeutralBlock'; blockId: string; result: boolean };

export interface EditorMediaCommandPortFixtureOptions {
  blocks?: readonly SelectedFileBlock[];
  neutralBlockProps?: ReadonlyMap<string, Readonly<Record<string, unknown>>>;
  supportedTypes?: readonly EditorMediaBlock['type'][];
  available?: boolean;
  currentSelection?: InsertPosition | null;
}

export interface EditorMediaCommandPortFixture {
  port: EditorMediaCommandPort;
  blocks: ReadonlyMap<string, SelectedFileBlock>;
  neutralBlockProps: ReadonlyMap<string, Record<string, unknown>>;
  operations: EditorMediaCommandOperation[];
  setAvailable: (available: boolean) => void;
  setCurrentSelection: (position: InsertPosition | null) => void;
  setSupportedTypes: (types: readonly EditorMediaBlock['type'][]) => void;
}

const defaultSupportedTypes: readonly EditorMediaBlock['type'][] = ['file'];

function cloneEditorMediaBlock(block: EditorMediaBlock): EditorMediaBlock {
  return { id: block.id, type: block.type, props: { ...block.props } };
}

function cloneSelectedFileBlock(block: SelectedFileBlock): SelectedFileBlock {
  return { id: block.id, type: block.type, props: { ...block.props } };
}

function cloneInsertPosition(position: InsertPosition | null): InsertPosition | null {
  return position ? { referenceBlockId: position.referenceBlockId } : null;
}

function lastBlockId(blocks: ReadonlyMap<string, SelectedFileBlock>): string | null {
  let result: string | null = null;
  for (const blockId of blocks.keys()) {
    result = blockId;
  }
  return result;
}

function insertAfter(blocks: Map<string, SelectedFileBlock>, referenceBlockId: string, block: SelectedFileBlock): void {
  const entries = [...blocks.entries()];
  blocks.clear();
  for (const [blockId, currentBlock] of entries) {
    blocks.set(blockId, currentBlock);
    if (blockId === referenceBlockId) {
      blocks.set(block.id, block);
    }
  }
}

export function createEditorMediaCommandPortFixture(
  options: EditorMediaCommandPortFixtureOptions = {},
): EditorMediaCommandPortFixture {
  const blocks = new Map<string, SelectedFileBlock>();
  for (const block of options.blocks ?? []) {
    blocks.set(block.id, cloneSelectedFileBlock(block));
  }

  const neutralBlockProps = new Map<string, Record<string, unknown>>();
  for (const [blockId, props] of options.neutralBlockProps ?? []) {
    neutralBlockProps.set(blockId, { ...props });
  }

  const operations: EditorMediaCommandOperation[] = [];
  let available = options.available ?? true;
  let supportedTypes = new Set(options.supportedTypes ?? defaultSupportedTypes);
  let currentSelection = cloneInsertPosition(options.currentSelection ?? null);
  let hasExplicitCurrentSelection = Object.hasOwn(options, 'currentSelection');

  const resolveCurrentSelection = (): InsertPosition | null => {
    if (hasExplicitCurrentSelection) {
      return cloneInsertPosition(currentSelection);
    }
    const referenceBlockId = lastBlockId(blocks);
    return referenceBlockId ? { referenceBlockId } : null;
  };

  const port = {
    getBlock(blockId) {
      const currentBlock = blocks.get(blockId);
      const result = currentBlock ? cloneSelectedFileBlock(currentBlock) : null;
      operations.push({ type: 'getBlock', blockId, result });
      return result;
    },
    updateBlockProps(blockId, props) {
      const currentBlock = blocks.get(blockId);
      const result = Boolean(currentBlock);
      if (currentBlock) {
        blocks.set(blockId, {
          ...currentBlock,
          props: { ...currentBlock.props, ...props },
        });
      }
      operations.push({ type: 'updateBlockProps', blockId, props: { ...props }, result });
      return result;
    },
    deleteBlock(blockId) {
      const result = blocks.delete(blockId);
      if (result) {
        neutralBlockProps.delete(blockId);
      }
      operations.push({ type: 'deleteBlock', blockId, result });
      return result;
    },
    insertBlock(block, savedPosition) {
      let result: BlockInsertResult;
      if (!available) {
        result = { ok: false, reason: 'unavailable' };
      } else if (!supportedTypes.has(block.type)) {
        result = { ok: false, reason: 'unsupported_block' };
      } else if (!block.id) {
        result = { ok: false, reason: 'invalid_block' };
      } else {
        const currentSelectionReference = resolveCurrentSelection()?.referenceBlockId;
        const referenceBlockId =
          (savedPosition && blocks.has(savedPosition.referenceBlockId) ? savedPosition.referenceBlockId : null) ??
          (currentSelectionReference && blocks.has(currentSelectionReference) ? currentSelectionReference : null) ??
          lastBlockId(blocks);

        if (!referenceBlockId) {
          result = { ok: false, reason: 'missing_reference' };
        } else {
          insertAfter(blocks, referenceBlockId, {
            id: block.id,
            type: block.type,
            props: { ...block.props },
          });
          result = { ok: true, blockId: block.id };
        }
      }

      operations.push({
        type: 'insertBlock',
        block: cloneEditorMediaBlock(block),
        savedPosition: cloneInsertPosition(savedPosition),
        result,
      });
      return result;
    },
    captureInsertPosition() {
      const result = resolveCurrentSelection();
      operations.push({ type: 'captureInsertPosition', result });
      return result;
    },
    applyNeutralBlockProps(blockId, props) {
      neutralBlockProps.set(blockId, {
        ...neutralBlockProps.get(blockId),
        ...props,
      });
      operations.push({ type: 'applyNeutralBlockProps', blockId, props: { ...props } });
    },
    deleteNeutralBlock(blockId) {
      const result = neutralBlockProps.delete(blockId);
      operations.push({ type: 'deleteNeutralBlock', blockId, result });
    },
  } satisfies EditorMediaCommandPort;

  return {
    port,
    blocks,
    neutralBlockProps,
    operations,
    setAvailable(nextAvailable) {
      available = nextAvailable;
    },
    setCurrentSelection(position) {
      currentSelection = cloneInsertPosition(position);
      hasExplicitCurrentSelection = true;
    },
    setSupportedTypes(types) {
      supportedTypes = new Set(types);
    },
  };
}
