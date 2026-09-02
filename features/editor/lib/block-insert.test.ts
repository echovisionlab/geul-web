import { describe, expect, it, vi } from 'vitest';
import { insertMirroredBlockAtPosition, type InsertPosition } from './block-insert';
import type { EditorMediaCommandPort } from './media-block-updates';

interface MockEditor extends EditorMediaCommandPort {
  inserted: Array<{
    blocks: Array<{ id?: string; type: string; props: Record<string, unknown> }>;
    placement?: 'before' | 'after';
    referenceBlockId: string;
  }>;
}

function createMockEditor(existingBlockIds: string[]): MockEditor {
  const blocksById = new Map(existingBlockIds.map((id) => [id, { id }]));

  return {
    getBlock: (id: string) => {
      const block = blocksById.get(id);
      return block ? { ...block, type: 'file' as const, props: {} } : null;
    },
    captureInsertPosition: () => null,
    updateBlockProps: () => false,
    deleteBlock: (id: string) => blocksById.delete(id),
    inserted: [],
    insertBlock(block, position) {
      const referenceBlock = position ? blocksById.get(position.referenceBlockId) : undefined;
      this.inserted.push({
        blocks: [block],
        placement: 'after',
        referenceBlockId: referenceBlock?.id ?? '',
      });
      if (!block.id) {
        return { ok: false as const, reason: 'invalid_block' as const };
      }
      blocksById.set(block.id, { id: block.id });
      return { ok: true as const, blockId: block.id };
    },
  };
}

describe('insertMirroredBlockAtPosition', () => {
  it('inserts the same generated block id into both editors', () => {
    const primaryEditor = createMockEditor(['ref-block']);
    const mirrorEditor = createMockEditor(['ref-block']);
    const savedPosition: InsertPosition = { referenceBlockId: 'ref-block' };

    insertMirroredBlockAtPosition(
      primaryEditor,
      mirrorEditor,
      {
        type: 'file',
        props: { url: 'https://example.com/image.png' },
      },
      savedPosition,
    );

    const primaryInsert = primaryEditor.inserted[0]?.blocks[0];
    const mirrorInsert = mirrorEditor.inserted[0]?.blocks[0];

    expect(typeof primaryInsert?.id).toBe('string');
    expect(primaryInsert).toMatchObject({
      id: mirrorInsert?.id,
      type: 'file',
      props: { url: 'https://example.com/image.png' },
    });
    expect(mirrorInsert).toMatchObject({
      id: primaryInsert?.id,
      type: 'file',
      props: { url: 'https://example.com/image.png' },
    });
  });

  it('removes the shared-first placeholder when the locale insert fails', () => {
    const pendingBlockId = '01b3db42-75f1-4bf1-8cb9-9b3baf57e795';
    const deleteBlock = vi.fn(() => true);
    const primary: EditorMediaCommandPort = {
      getBlock: () => null,
      captureInsertPosition: () => null,
      updateBlockProps: () => false,
      deleteBlock: () => false,
      insertBlock: () => ({ ok: false as const, reason: 'missing_reference' as const }),
    };
    const mirror: EditorMediaCommandPort = {
      getBlock: () => null,
      captureInsertPosition: () => null,
      updateBlockProps: () => false,
      insertBlock: (block: { id?: string }) => ({ ok: true as const, blockId: block.id ?? '' }),
      deleteBlock,
    };

    const result = insertMirroredBlockAtPosition(
      primary,
      mirror,
      { id: pendingBlockId, type: 'file', props: {} },
      { referenceBlockId: 'missing' },
    );

    expect(result).toEqual({ ok: false, reason: 'missing_reference' });
    expect(deleteBlock).toHaveBeenCalledWith(pendingBlockId);
  });

  it('rejects caller-supplied legacy block identities', () => {
    const editor = createMockEditor(['ref-block']);

    expect(
      insertMirroredBlockAtPosition(
        editor,
        null,
        { id: 'legacy-file', type: 'file', props: {} },
        { referenceBlockId: 'ref-block' },
      ),
    ).toEqual({ ok: false, reason: 'invalid_block' });
    expect(editor.inserted).toEqual([]);
  });
});
