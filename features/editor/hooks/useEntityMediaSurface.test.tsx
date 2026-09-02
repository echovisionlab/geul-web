// @vitest-environment jsdom

import { act } from 'react';
import { randomTestUuid } from '@echovisionlab/geul-common/test/random-id';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorMediaCommandPort } from '@/features/editor/lib/media-block-updates';
import { useEntityMediaSurface } from './useEntityMediaSurface';

const mocks = vi.hoisted(() => ({ upload: vi.fn() }));

vi.mock('@/lib/hooks/useFileUpload', () => ({
  useFileUpload: () => ({ upload: mocks.upload }),
}));

const entityId = '01b3db42-75f1-4bf1-8cb9-9b3baf57e795';
const anchorBlockId = 'b67328c4-668c-5bf2-8f1e-41465149ded6';
let latestSurface: ReturnType<typeof useEntityMediaSurface> | null = null;
let container: HTMLDivElement | null = null;
let root: Root | null = null;

function HookProbe() {
  latestSurface = useEntityMediaSurface({
    entityId,
    entityType: TranscodeEntityType.POST,
    allowStructuralEdits: true,
    allowInsertEdits: true,
  });
  return null;
}

function createEditor() {
  const inserted: Array<{ block: Parameters<EditorMediaCommandPort['insertBlock']>[0]; verified: boolean }> = [];
  let verified = false;
  const editor: EditorMediaCommandPort = {
    getBlock: vi.fn(() => null),
    updateBlockProps: vi.fn(() => false),
    deleteBlock: vi.fn(() => false),
    insertBlock: vi.fn((block) => {
      inserted.push({ block, verified });
      return { ok: true as const, blockId: block.id ?? randomTestUuid() };
    }),
    captureInsertPosition: vi.fn(() => ({
      referenceBlockId: anchorBlockId,
      encodedRelativePosition: new Uint8Array([1, 2, 3]),
    })),
  };
  return {
    editor,
    inserted,
    markVerified: () => {
      verified = true;
    },
  };
}

async function render() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<HookProbe />);
    await Promise.resolve();
  });
}

beforeEach(() => {
  latestSurface = null;
  mocks.upload.mockReset();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('useEntityMediaSurface', () => {
  it('keeps upload progress outside the document and inserts only the verified File', async () => {
    const harness = createEditor();
    let resolveUpload: ((value: { fileId: string; url: string }) => void) | undefined;
    mocks.upload.mockImplementation((_file, options) => {
      options.onProgress({ percentage: 35, stage: 'uploading' });
      return new Promise((resolve) => {
        resolveUpload = resolve;
      });
    });
    await render();

    const task = latestSurface?.dropFilesAtBlock(harness.editor, anchorBlockId, [
      new File(['audio'], 'Field Take.wav', { type: 'audio/wav' }),
    ]);
    await act(async () => {
      await Promise.resolve();
    });

    expect(harness.inserted).toHaveLength(0);
    expect(latestSurface?.uploadProgress).toMatchObject({ percentage: 35, stage: 'uploading' });

    const fileId = randomTestUuid();
    harness.markVerified();
    resolveUpload?.({ fileId, url: `https://cdn.example.test/${fileId}.wav` });
    await act(async () => {
      await task;
    });

    expect(harness.inserted).toHaveLength(1);
    expect(harness.inserted[0]).toMatchObject({
      verified: true,
      block: { type: 'file', props: { fileId, name: 'Field Take' } },
    });
    expect(harness.inserted[0]?.block.props).not.toHaveProperty('pendingUploadFileId');
    expect(harness.inserted[0]?.block.props).not.toHaveProperty('mediaAttemptId');
    expect(latestSurface?.uploadProgress).toBeNull();
  });

  it('does not install the old external-image placeholder extension', async () => {
    mocks.upload.mockResolvedValue({ fileId: randomTestUuid(), url: 'https://cdn.example.test/file' });
    await render();

    expect(latestSurface?.mediaTiptapExtensions).toEqual([]);
    expect(latestSurface?.externalImageProgress).toBeNull();
  });
});
