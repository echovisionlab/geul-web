// @vitest-environment jsdom

import { randomTestUuid } from '@echovisionlab/geul-common/test/random-id';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { describe, expect, it, vi } from 'vitest';
import { UPLOAD_ABORTED_MESSAGE } from '@/lib/upload/failure';
import { insertMediaFilesAtPosition } from './media-file-insert';
import type { EditorMediaBlock } from './media-block-updates';

function createHarness() {
  const blocks: Array<EditorMediaBlock & { id: string }> = [];
  return {
    blocks,
    editor: {
      captureInsertPosition: (referenceBlockId?: string) =>
        referenceBlockId ? { referenceBlockId, encodedRelativePosition: new Uint8Array([1]) } : null,
    },
    insert(block: EditorMediaBlock, position: { referenceBlockId: string } | null) {
      const inserted = { ...block, id: block.id ?? randomTestUuid(), position };
      blocks.push(inserted);
      return { ok: true as const, blockId: inserted.id };
    },
  };
}

function baseOptions(overrides: Partial<Parameters<typeof insertMediaFilesAtPosition>[2]> = {}) {
  return {
    entityType: TranscodeEntityType.POST,
    entityId: randomTestUuid(),
    upload: vi.fn(async (file: File) => ({
      fileId: randomTestUuid(),
      url: `https://cdn.example.test/${encodeURIComponent(file.name)}`,
    })),
    onUploadStart: vi.fn(),
    onUploadProgress: vi.fn(),
    onUploadEnd: vi.fn(),
    onUploadCancel: vi.fn(),
    onUploadError: vi.fn(),
    ...overrides,
  };
}

describe('insertMediaFilesAtPosition', () => {
  it('inserts only verified active File blocks in selection order', async () => {
    const harness = createHarness();
    const references: string[] = [];
    const files = [
      new File(['one'], 'First Take.wav', { type: 'audio/wav' }),
      new File(['two'], 'Second Take.mp4', { type: 'video/mp4' }),
    ];

    await insertMediaFilesAtPosition(
      harness.editor as never,
      files,
      baseOptions({
        insertBlockAtPosition: (block, position) => {
          references.push(position?.referenceBlockId ?? '');
          return harness.insert(block, position);
        },
      }),
      { referenceBlockId: randomTestUuid(), encodedRelativePosition: new Uint8Array([9]) },
    );

    expect(harness.blocks.map((block) => block.props.name)).toEqual(['First Take', 'Second Take']);
    expect(harness.blocks.every((block) => Boolean(block.props.fileId))).toBe(true);
    expect(harness.blocks.every((block) => block.props.pendingUploadFileId === undefined)).toBe(true);
    expect(harness.blocks.every((block) => block.props.mediaAttemptId === undefined)).toBe(true);
    expect(references[1]).toBe(harness.blocks[0]?.id);
  });

  it('does not insert a File block before upload verification completes', async () => {
    const harness = createHarness();
    let resolveUpload: ((value: { fileId: string; url: string }) => void) | undefined;
    const upload = vi.fn(
      () =>
        new Promise<{ fileId: string; url: string }>((resolve) => {
          resolveUpload = resolve;
        }),
    );
    const task = insertMediaFilesAtPosition(
      harness.editor as never,
      [new File(['document'], 'notes.pdf', { type: 'application/pdf' })],
      baseOptions({ upload, insertBlockAtPosition: (block, position) => harness.insert(block, position) }),
      { referenceBlockId: randomTestUuid(), encodedRelativePosition: new Uint8Array([3]) },
    );

    expect(harness.blocks).toHaveLength(0);
    resolveUpload?.({ fileId: randomTestUuid(), url: 'https://cdn.example.test/notes.pdf' });
    await task;
    expect(harness.blocks).toHaveLength(1);
  });

  it('keeps failed and cancelled uploads out of the document', async () => {
    const failed = createHarness();
    const failedOptions = baseOptions({
      upload: vi.fn(async () => {
        throw new Error('network failed');
      }),
      insertBlockAtPosition: (block, position) => failed.insert(block, position),
    });
    await insertMediaFilesAtPosition(
      failed.editor as never,
      [new File(['x'], 'failed.pdf', { type: 'application/pdf' })],
      failedOptions,
      { referenceBlockId: randomTestUuid() },
    );
    expect(failed.blocks).toHaveLength(0);
    expect(failedOptions.onUploadError).toHaveBeenCalledWith('failed.pdf', 'network failed');

    const cancelled = createHarness();
    const cancelledOptions = baseOptions({
      upload: vi.fn(async () => {
        throw new Error(UPLOAD_ABORTED_MESSAGE);
      }),
      insertBlockAtPosition: (block, position) => cancelled.insert(block, position),
    });
    await insertMediaFilesAtPosition(
      cancelled.editor as never,
      [new File(['x'], 'cancelled.pdf', { type: 'application/pdf' })],
      cancelledOptions,
      { referenceBlockId: randomTestUuid() },
    );
    expect(cancelled.blocks).toHaveLength(0);
    expect(cancelledOptions.onUploadCancel).toHaveBeenCalledWith('cancelled.pdf');
  });

  it('reports a post-upload insertion conflict without creating a placeholder', async () => {
    const harness = createHarness();
    const options = baseOptions({
      insertBlockAtPosition: () => ({ ok: false, reason: 'missing_reference' }),
    });
    await insertMediaFilesAtPosition(
      harness.editor as never,
      [new File(['x'], 'orphan.pdf', { type: 'application/pdf' })],
      options,
      { referenceBlockId: randomTestUuid(), encodedRelativePosition: new Uint8Array([5]) },
    );

    expect(harness.blocks).toHaveLength(0);
    expect(options.onUploadError).toHaveBeenCalledWith(
      'orphan.pdf',
      'Verified File could not be inserted: missing_reference',
    );
  });
});
