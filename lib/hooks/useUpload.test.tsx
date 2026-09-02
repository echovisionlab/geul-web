// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  multipartUpload: vi.fn(),
}));

vi.mock('./useFileUpload', () => ({
  useFileUpload: () => ({
    upload: mocks.multipartUpload,
    abort: vi.fn(),
    downloadFromUrl: vi.fn(),
    isUploading: false,
    isDownloading: false,
  }),
}));

import { useUpload } from './useUpload';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type HookResult = ReturnType<typeof useUpload>;
let current: HookResult | null = null;
let container: HTMLDivElement;
let root: Root;

function Harness() {
  current = useUpload(UploadType.PROGRAM_EVENT_POSTER);
  return null;
}

beforeEach(() => {
  mocks.multipartUpload.mockReset();
  mocks.multipartUpload.mockResolvedValue({ fileId: 'file-1', url: 'https://cdn.example.test/poster.webp' });
  current = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useUpload Blob filename contract', () => {
  it('adds the MIME extension to an extensionless generated image name', async () => {
    await act(async () => {
      await current?.upload(new Blob(['poster'], { type: 'image/webp' }), {
        entityId: 'event-1',
        fileName: 'poster-123',
      });
    });

    const uploadedFile = mocks.multipartUpload.mock.calls[0]?.[0] as File;
    expect(uploadedFile.name).toBe('poster-123.webp');
    expect(uploadedFile.type).toBe('image/webp');
  });

  it('replaces a stale extension with the extension required by the Blob MIME', async () => {
    await act(async () => {
      await current?.upload(new Blob(['poster'], { type: 'image/webp' }), {
        entityId: 'event-1',
        fileName: 'poster.jpg',
      });
    });

    const uploadedFile = mocks.multipartUpload.mock.calls[0]?.[0] as File;
    expect(uploadedFile.name).toBe('poster.webp');
  });

  it('keeps an already canonical filename unchanged', async () => {
    await act(async () => {
      await current?.upload(new Blob(['poster'], { type: 'image/webp' }), {
        entityId: 'event-1',
        fileName: 'poster.WEBP',
      });
    });

    const uploadedFile = mocks.multipartUpload.mock.calls[0]?.[0] as File;
    expect(uploadedFile.name).toBe('poster.WEBP');
  });
});
