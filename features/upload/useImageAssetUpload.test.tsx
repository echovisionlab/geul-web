// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  notification: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/lib/hooks/useUpload', () => ({
  useUpload: () => ({ upload: mocks.upload, isUploading: false }),
}));
vi.mock('@mantine/notifications', () => ({ notifications: { show: mocks.notification } }));
vi.mock('@/lib/utils/client-logger', () => ({
  createClientLogger: () => ({ error: mocks.loggerError }),
}));

import { useImageAssetUpload } from './useImageAssetUpload';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type HookResult = ReturnType<typeof useImageAssetUpload>;
let current: HookResult | null = null;
let container: HTMLDivElement;
let root: Root;

function Harness({
  enabled = true,
  onUploaded,
  fileName = 'featured',
}: {
  enabled?: boolean;
  onUploaded: (fileId: string) => unknown | Promise<unknown>;
  fileName?: string | (() => string);
}) {
  current = useImageAssetUpload({
    uploadType: UploadType.FEATURED_IMAGE,
    entityId: 'entity-1',
    fileName,
    onUploaded,
    uploadFailedMessage: 'Upload failed',
    enabled,
    disabledMessage: 'Not ready',
  });
  return null;
}

beforeEach(() => {
  mocks.upload.mockReset();
  mocks.notification.mockReset();
  mocks.loggerError.mockReset();
  current = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useImageAssetUpload', () => {
  it('uploads, reports progress, delegates the file id, and resets progress', async () => {
    const onUploaded = vi.fn();
    mocks.upload.mockImplementation(
      async (_blob: Blob, options: { onProgress: (value: { percentage: number }) => void }) => {
        options.onProgress({ percentage: 55 });
        return { fileId: 'file-1' };
      },
    );
    act(() => root.render(<Harness onUploaded={onUploaded} fileName={() => 'poster-now'} />));

    await act(async () => {
      await current?.handleUpload(new Blob(['image'], { type: 'image/png' }));
    });

    expect(mocks.upload).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.objectContaining({ entityId: 'entity-1', fileName: 'poster-now' }),
    );
    expect(onUploaded).toHaveBeenCalledWith('file-1');
    expect(current?.uploadProgress).toBe(0);
    expect(mocks.notification).not.toHaveBeenCalled();
  });

  it('rejects uploads while disabled', async () => {
    act(() => root.render(<Harness enabled={false} onUploaded={vi.fn()} />));

    await act(async () => {
      await current?.handleUpload(new Blob());
    });

    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.notification).toHaveBeenCalledWith({ message: 'Not ready', color: 'red' });
  });

  it('logs upload failures and chooses the useful error message', async () => {
    mocks.upload.mockRejectedValueOnce(new Error('Network failed')).mockRejectedValueOnce('unknown');
    act(() => root.render(<Harness onUploaded={vi.fn()} />));

    await act(async () => {
      await current?.handleUpload(new Blob());
      await current?.handleUpload(new Blob());
    });

    expect(mocks.loggerError).toHaveBeenNthCalledWith(1, 'Upload error', { error: 'Network failed' });
    expect(mocks.loggerError).toHaveBeenNthCalledWith(2, 'Upload error', { error: 'unknown' });
    expect(mocks.notification).toHaveBeenNthCalledWith(1, { message: 'Network failed', color: 'red' });
    expect(mocks.notification).toHaveBeenNthCalledWith(2, { message: 'Upload failed', color: 'red' });
  });
});
