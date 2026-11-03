// @vitest-environment jsdom
import { act, renderHook } from '@/test/render';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifications } from '@/components/core/Notification';
import { useImageAssetUpload } from './useImageAssetUpload';
const mocks = vi.hoisted(() => ({ upload: vi.fn(), loggerError: vi.fn() }));
vi.mock('@/lib/hooks/useUpload', () => ({ useUpload: () => ({ upload: mocks.upload, isUploading: false }) }));
vi.mock('@/lib/utils/client-logger', () => ({ createClientLogger: () => ({ error: mocks.loggerError }) }));
const options = {
  uploadType: UploadType.FEATURED_IMAGE,
  entityId: 'entity-1',
  fileName: 'featured',
  uploadFailedMessage: 'Upload failed',
  disabledMessage: 'Not ready',
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(notifications, 'show');
});
afterEach(() => {
  notifications.clean();
  vi.restoreAllMocks();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
describe('useImageAssetUpload', () => {
  it('uploads, reports progress, delegates the file id, and resets progress', async () => {
    const transfer = deferred<{ fileId: string }>();
    const linked = deferred<void>();
    const onUploaded = vi.fn(() => linked.promise);
    let progress!: (value: { percentage: number }) => void;
    mocks.upload.mockImplementation((_blob, input) => {
      progress = input.onProgress;
      return transfer.promise;
    });
    const { result } = renderHook(() => useImageAssetUpload({ ...options, fileName: () => 'poster-now', onUploaded }));
    let operation!: Promise<void>;
    act(() => {
      operation = result.current.handleUpload(new Blob(['image'], { type: 'image/png' }));
    });
    act(() => progress({ percentage: 55 }));
    expect(result.current.uploadProgress).toBe(55);
    expect(result.current.isUploading).toBe(true);
    await act(async () => transfer.resolve({ fileId: 'file-1' }));
    expect(result.current.isUploading).toBe(true);
    expect(onUploaded).toHaveBeenCalledWith('file-1');
    await act(async () => {
      await result.current.handleUpload(new Blob());
    });
    expect(mocks.upload).toHaveBeenCalledOnce();
    await act(async () => {
      linked.resolve();
      await operation;
    });
    expect(result.current.isUploading).toBe(false);
    expect(result.current.uploadProgress).toBe(0);
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.objectContaining({ entityId: 'entity-1', fileName: 'poster-now' }),
    );
    expect(notifications.show).not.toHaveBeenCalled();
  });
  it('rejects uploads while disabled', async () => {
    const { result } = renderHook(() => useImageAssetUpload({ ...options, enabled: false, onUploaded: vi.fn() }));
    await act(async () => result.current.handleUpload(new Blob()));
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(notifications.show).toHaveBeenCalledWith({ message: 'Not ready', tone: 'danger' });
  });
  it('logs upload failures and chooses the useful error message', async () => {
    mocks.upload.mockRejectedValueOnce(new Error('Network failed')).mockRejectedValueOnce('unknown');
    const { result } = renderHook(() => useImageAssetUpload({ ...options, onUploaded: vi.fn() }));
    await act(async () => {
      await result.current.handleUpload(new Blob());
      await result.current.handleUpload(new Blob());
    });
    expect(mocks.loggerError).toHaveBeenNthCalledWith(1, 'Upload error', { error: 'Network failed' });
    expect(mocks.loggerError).toHaveBeenNthCalledWith(2, 'Upload error', { error: 'unknown' });
    expect(notifications.show).toHaveBeenNthCalledWith(1, { message: 'Network failed', tone: 'danger' });
    expect(notifications.show).toHaveBeenNthCalledWith(2, { message: 'Upload failed', tone: 'danger' });
    expect(result.current.isUploading).toBe(false);
  });
  it.each(['target', 'unmount'] as const)('ignores late transport completion after %s changes', async (change) => {
    const transfer = deferred<{ fileId: string }>();
    mocks.upload.mockReturnValue(transfer.promise);
    const onUploaded = vi.fn();
    const view = renderHook(({ entityId }) => useImageAssetUpload({ ...options, entityId, onUploaded }), {
      initialProps: { entityId: 'one' },
    });
    let operation!: Promise<void>;
    act(() => {
      operation = view.result.current.handleUpload(new Blob());
    });
    if (change === 'unmount') {
      view.unmount();
    } else {
      view.rerender({ entityId: 'two' });
    }
    await act(async () => {
      transfer.resolve({ fileId: 'old' });
      await operation;
    });
    expect(onUploaded).not.toHaveBeenCalled();
    expect(notifications.show).not.toHaveBeenCalled();
  });
});
