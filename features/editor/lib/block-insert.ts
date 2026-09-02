/**
 * Engine-neutral deferred block insertion contracts.
 *
 * A saved block ID is durable document data, not an editor implementation
 * detail. Concrete engines decide how to resolve it at insertion time.
 */
import type { EditorMediaBlock, EditorMediaCommandPort } from './media-block-updates';
import { createBlockId, isBlockId } from '@/lib/editor/block-id';

export interface InsertPosition {
  referenceBlockId: string;
  /** Present for async collaborative insertion; never persisted or sent. */
  encodedRelativePosition?: Uint8Array;
}

export interface BlockInsertSuccess {
  ok: true;
  blockId: string;
}

export interface BlockInsertFailure {
  ok: false;
  reason: 'missing_reference' | 'unsupported_block' | 'invalid_block' | 'unavailable';
}

export type BlockInsertResult = BlockInsertSuccess | BlockInsertFailure;

export type DeferredBlockInsert = (block: EditorMediaBlock, savedPosition: InsertPosition | null) => BlockInsertResult;

export function createInsertPosition(referenceBlockId: string | null | undefined): InsertPosition | null {
  return referenceBlockId ? { referenceBlockId } : null;
}

export function ensureMediaBlockId(block: EditorMediaBlock): EditorMediaBlock {
  return block.id ? block : { ...block, id: createBlockId() };
}

/** Captures the engine's current insertion anchor before an async picker opens. */
export function captureInsertPosition(
  editor: EditorMediaCommandPort,
  referenceBlockId?: string,
): InsertPosition | null {
  return editor.captureInsertPosition(referenceBlockId);
}

export function captureInsertPositionFromDomTarget(
  editor: EditorMediaCommandPort,
  target: EventTarget | null,
): InsertPosition | null {
  const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  if (!element) {
    return null;
  }
  const blockElement = element.closest<HTMLElement>('[data-node-type="blockContainer"][data-id]');
  const blockId = blockElement?.getAttribute('data-id');
  return blockId ? captureInsertPosition(editor, blockId) : null;
}

/**
 * Inserts after the saved reference when it still exists, otherwise the port's
 * current/end fallback. The port returns an explicit failure for a schema that
 * cannot represent the block.
 */
export function insertBlockAtPosition(
  editor: EditorMediaCommandPort,
  block: EditorMediaBlock,
  savedPosition: InsertPosition | null,
): BlockInsertResult {
  const blockWithId = ensureMediaBlockId(block);
  return isBlockId(blockWithId.id)
    ? editor.insertBlock(blockWithId, savedPosition)
    : { ok: false, reason: 'invalid_block' };
}

export function insertMirroredBlockAtPosition(
  primaryEditor: EditorMediaCommandPort,
  mirrorEditor: EditorMediaCommandPort | null | undefined,
  block: EditorMediaBlock,
  savedPosition: InsertPosition | null,
): BlockInsertResult {
  const blockWithId = ensureMediaBlockId(block);
  if (!isBlockId(blockWithId.id)) {
    return { ok: false, reason: 'invalid_block' };
  }
  if (!mirrorEditor || mirrorEditor === primaryEditor) {
    return insertBlockAtPosition(primaryEditor, blockWithId, savedPosition);
  }

  // A Y.RelativePosition belongs to one Y.Doc. The temporary locale mirror is
  // addressed by the same durable anchor ID until that mirror is removed.
  const mirrorPosition = savedPosition ? { referenceBlockId: savedPosition.referenceBlockId } : null;
  const mirrorResult = insertBlockAtPosition(mirrorEditor, blockWithId, mirrorPosition);
  if (!mirrorResult.ok) {
    return mirrorResult;
  }
  const primaryResult = insertBlockAtPosition(primaryEditor, blockWithId, savedPosition);
  if (!primaryResult.ok && blockWithId.id) {
    mirrorEditor.deleteBlock(blockWithId.id);
  }
  return primaryResult;
}
