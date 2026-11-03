// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@/test/render';
import { UploadType } from '@/lib/types/upload/model';
import { initiateUploadAction, completeUploadAction, abortUploadAction } from '@/lib/actions/file';
import { sessionFixture, uploadFetch, UploadXMLHttpRequest } from '@/lib/upload/direct-upload.test-fixture';
import { forgetUploadSession } from '@/lib/upload/upload-session-store';
import { useImageAssetUpload } from './useImageAssetUpload';

vi.mock('@/lib/actions/file', () => ({
  initiateUploadAction: vi.fn(),
  completeUploadAction: vi.fn(),
  abortUploadAction: vi.fn(),
  findMultipartUploadCandidateAction: vi.fn().mockResolvedValue(null),
  recoverCompletedUploadAction: vi.fn(),
  prepareClientMediaUploadAction: vi.fn(),
  completeClientMediaUploadAction: vi.fn(),
  recoverCompletedClientMediaUploadAction: vi.fn(),
}));

const completion = () => Promise.withResolvers<{ fileId: string; url: string }>();
let finalization: ReturnType<typeof completion>;
let operations: Promise<void>[];
let client: QueryClient;
let view: Pick<ReturnType<typeof renderHook>, 'unmount'> | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  finalization = completion();
  operations = [];
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  vi.mocked(initiateUploadAction)
    .mockResolvedValueOnce(sessionFixture())
    .mockResolvedValue({ ...sessionFixture(), fileId: 'file-2', uploadId: 'upload-2' });
  vi.mocked(completeUploadAction)
    .mockReturnValueOnce(finalization.promise)
    .mockResolvedValue({ fileId: 'file-2', url: '/two' });
  vi.stubGlobal('fetch', vi.fn(uploadFetch));
  vi.stubGlobal('XMLHttpRequest', UploadXMLHttpRequest);
  UploadXMLHttpRequest.instances = [];
  UploadXMLHttpRequest.sendHandler = () => {};
});
afterEach(async () => {
  await act(async () => {
    UploadXMLHttpRequest.sendHandler = null;
    UploadXMLHttpRequest.instances.forEach((xhr) => xhr.succeed());
    finalization.resolve({ fileId: 'file-1', url: '/one' });
    await Promise.allSettled(operations);
  });
  view?.unmount();
  view = undefined;
  client.clear();
  forgetUploadSession('file-1');
  forgetUploadSession('file-2');
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

it.each(['target', 'enabled'] as const)(
  'keeps the real shared transport exclusive until the old upload settles after %s changes',
  async (change) => {
    const onUploaded = vi.fn();
    const hook = renderHook(
      ({ entityId, enabled }) =>
        useImageAssetUpload({
          uploadType: UploadType.EDITOR_IMAGE,
          entityId,
          enabled,
          fileName: 'image.gif',
          uploadFailedMessage: 'Upload failed',
          onUploaded,
        }),
      {
        initialProps: { entityId: 'one', enabled: true },
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );
    view = hook;
    const start = () => {
      const task = hook.result.current.handleUpload(new Blob(['GIF89'], { type: 'image/gif' }));
      operations.push(task);
      return task;
    };
    act(() => {
      start();
    });
    await waitFor(() => expect(UploadXMLHttpRequest.instances).toHaveLength(1));
    if (change === 'target') {
      hook.rerender({ entityId: 'two', enabled: true });
    } else {
      hook.rerender({ entityId: 'one', enabled: false });
      hook.rerender({ entityId: 'one', enabled: true });
    }
    expect(hook.result.current.isUploading).toBe(true);
    await act(async () => {
      await start();
    });
    expect(initiateUploadAction).toHaveBeenCalledOnce();
    await act(async () => UploadXMLHttpRequest.instances[0].succeed());
    await waitFor(() => expect(completeUploadAction).toHaveBeenCalledOnce());
    await act(async () => {
      await start();
    });
    expect(initiateUploadAction).toHaveBeenCalledOnce();
    expect(abortUploadAction).not.toHaveBeenCalled();
    await act(async () => {
      finalization.resolve({ fileId: 'file-1', url: '/one' });
      await operations[0];
    });
    expect(onUploaded).not.toHaveBeenCalled();
    expect(hook.result.current.isUploading).toBe(false);
    act(() => {
      start();
    });
    await waitFor(() => expect(UploadXMLHttpRequest.instances).toHaveLength(2));
    await act(async () => {
      UploadXMLHttpRequest.instances[1].succeed();
      await operations.at(-1);
    });
    expect(onUploaded).toHaveBeenCalledExactlyOnceWith('file-2');
    expect(hook.result.current.isUploading).toBe(false);
  },
);
