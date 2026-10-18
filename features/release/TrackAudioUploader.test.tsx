// @vitest-environment jsdom

import type { ReactElement } from 'react';
import { randomTestId, randomTestUuid } from '@echovisionlab/geul-common/test/random-id';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { UploadSessionStatus } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { NotificationRegion, notifications } from '@/components/core/Notification';
import { abortUploadAction, findMultipartUploadCandidateAction } from '@/lib/actions/file';
import { UploadType } from '@/lib/types/upload/model';
import { rememberUploadSession } from '@/lib/upload/upload-session-store';
import { act, render as renderUI, screen, waitFor } from '@/test/render';
import { TrackAudioUploader } from './TrackAudioUploader';

const uploadHookMocks = vi.hoisted(() => ({
  upload: vi.fn(),
  abort: vi.fn(),
  isUploading: false,
}));

const mockUseUploadResumeState = vi.fn<
  (
    uploadType: UploadType,
    entityId: string | null,
    options: any,
  ) => {
    resumeNotice: any;
    hasActiveSession: boolean;
  }
>(() => ({
  resumeNotice: null,
  hasActiveSession: false,
}));

vi.mock('@/lib/hooks/useFileUpload', () => ({
  UPLOAD_ABORTED_MESSAGE: 'Upload aborted',
  UPLOAD_FINALIZATION_FAILED_MESSAGE: 'Upload finalization failed',
  UPLOAD_FAILED_MESSAGE: 'Upload failed',
  UPLOAD_INTERRUPTED_MESSAGE: 'Upload interrupted',
  useFileUpload: () => ({
    upload: uploadHookMocks.upload,
    abort: uploadHookMocks.abort,
    isUploading: uploadHookMocks.isUploading,
  }),
}));

vi.mock('@/lib/hooks/useUploadResumeNotice', () => ({
  useUploadResumeState: (uploadType: UploadType, entityId: string | null, options: any) =>
    mockUseUploadResumeState(uploadType, entityId, options),
}));

vi.mock('@/lib/actions/file', () => ({
  abortUploadAction: vi.fn(),
  findMultipartUploadCandidateAction: vi.fn(),
}));

let view: ReturnType<typeof renderUI>;
let queryClient: QueryClient;
let pickerClick: MockInstance<() => void>;

function createTrackAudioTestIds() {
  const releaseId = randomTestUuid();
  const trackId = randomTestUuid();
  const uploadId = randomTestId('upload');
  const fileId = randomTestUuid();
  const pendingFileId = randomTestUuid();
  const attemptId = randomTestUuid();
  const pendingAttemptId = randomTestUuid();
  const currentAudioFileId = randomTestUuid();

  return {
    releaseId,
    trackId,
    uploadId,
    fileId,
    pendingFileId,
    attemptId,
    pendingAttemptId,
    currentAudioFileId,
    fileUrl: `https://cdn.example.test/media/token/${fileId}.ogg`,
  };
}

function tree(node: ReactElement) {
  return (
    <QueryClientProvider client={queryClient}>
      {node}
      <NotificationRegion closeLabel="Close" />
    </QueryClientProvider>
  );
}

function render(node: ReactElement) {
  view = renderUI(tree(node));
  return view;
}

function rerender(node: ReactElement) {
  view.rerender(tree(node));
}

async function selectUploadFile(file: File) {
  pickerClick.mockClear();
  await view.user.click(screen.getByRole('button', { name: 'Upload audio file' }));
  const pickerInput = pickerClick.mock.contexts.at(-1) as HTMLInputElement | undefined;
  expect(pickerInput).toBeDefined();
  await view.user.upload(pickerInput!, file);
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  uploadHookMocks.upload.mockReset();
  uploadHookMocks.abort.mockReset();
  pickerClick = vi.spyOn(HTMLInputElement.prototype, 'click');
});

afterEach(() => {
  act(() => notifications.clean());
  queryClient.clear();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  uploadHookMocks.isUploading = false;
  mockUseUploadResumeState.mockReset();
  mockUseUploadResumeState.mockReturnValue({ resumeNotice: null, hasActiveSession: false });
  window.sessionStorage.clear();
});

describe('TrackAudioUploader', () => {
  it('passes the track identity and current-file CAS fence to upload', async () => {
    const ids = createTrackAudioTestIds();
    uploadHookMocks.upload.mockImplementation(async (_file: File, options: any) => {
      options.onMultipartSession?.({
        uploadId: ids.uploadId,
        fileId: ids.fileId,
        resumed: false,
        resumable: true,
      });
      return {
        url: ids.fileUrl,
        fileId: ids.fileId,
      };
    });

    render(
      <TrackAudioUploader
        trackId={ids.trackId}
        audioOriginalFileId={ids.currentAudioFileId}
        processingStatus="TRACK_PROCESSING_STATUS_PENDING"
        audioAttached
        compact
        mode="button-only"
      />,
    );

    await selectUploadFile(new File(['audio'], 'audio.ogg', { type: 'audio/ogg' }));

    expect(uploadHookMocks.upload).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({
        uploadType: UploadType.TRACK_AUDIO,
        entityId: ids.trackId,
        entityType: TranscodeEntityType.TRACK,
        expectedCurrentFileId: ids.currentAudioFileId,
      }),
    );
  });

  it('keeps a non-resumable finalizing session available for exact completion retry', async () => {
    const ids = createTrackAudioTestIds();
    uploadHookMocks.upload.mockImplementation(async (_file: File, options: any) => {
      options.onMultipartSession?.({
        uploadId: ids.uploadId,
        fileId: ids.fileId,
        attemptId: ids.attemptId,
        resumed: false,
        resumable: false,
      });
      throw new Error('Upload finalization failed');
    });

    render(
      <TrackAudioUploader
        trackId={ids.trackId}
        processingStatus="TRACK_PROCESSING_STATUS_PENDING"
        audioAttached={false}
        compact
        mode="button-only"
      />,
    );

    await selectUploadFile(new File(['audio'], 'audio.ogg', { type: 'audio/ogg' }));

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelButton).toBeDisabled();
    expect(cancelButton).toHaveAttribute('title', 'Finalizing');
    expect(mockUseUploadResumeState).toHaveBeenLastCalledWith(UploadType.TRACK_AUDIO, ids.trackId, {
      entityType: TranscodeEntityType.TRACK,
      fileId: ids.fileId,
      attemptId: ids.attemptId,
      pendingFileId: ids.fileId,
      hasDurableSource: false,
    });
  });

  it('locks cancellation as soon as Complete starts and reconciles a successful completion', async () => {
    const ids = createTrackAudioTestIds();
    let resolveUpload: (result: { url: string; fileId: string }) => void = () => {};
    let beginFinalizing = () => {};
    const onPendingUploadCancelled = vi.fn();
    const onUploadProgressChange = vi.fn();
    const props = {
      trackId: ids.trackId,
      processingStatus: 'TRACK_PROCESSING_STATUS_PENDING' as const,
      audioAttached: false,
      onPendingUploadCancelled,
      onUploadProgressChange,
      compact: true,
      mode: 'default' as const,
    };

    uploadHookMocks.upload.mockImplementation((_file: File, options: any) => {
      options.onMultipartSession?.({
        uploadId: ids.uploadId,
        fileId: ids.fileId,
        attemptId: ids.attemptId,
        resumed: false,
        resumable: true,
      });
      beginFinalizing = () =>
        options.onLifecycle?.({
          correlationId: 'track-audio-test',
          mode: 'upload',
          stage: 'finalizing',
          percentage: 100,
          fileId: ids.fileId,
          source: 'local',
        });
      return new Promise((resolve) => {
        resolveUpload = resolve;
      });
    });

    render(<TrackAudioUploader {...props} />);
    await selectUploadFile(new File(['audio'], 'audio.ogg', { type: 'audio/ogg' }));

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelButton).toBeEnabled();
    act(() => {
      beginFinalizing();
      // Complete owns the session before React commits the disabled button.
      cancelButton.click();
    });
    expect(cancelButton).toBeDisabled();
    expect(cancelButton).toHaveAttribute('title', 'Finalizing');
    expect(onUploadProgressChange).toHaveBeenCalledWith(ids.trackId, {
      active: true,
      progress: 100,
      stage: 'finalizing',
    });
    expect(uploadHookMocks.abort).not.toHaveBeenCalled();
    expect(abortUploadAction).not.toHaveBeenCalled();
    expect(onPendingUploadCancelled).not.toHaveBeenCalled();

    await act(async () => {
      resolveUpload({ url: ids.fileUrl, fileId: ids.fileId });
    });

    expect(await screen.findByText('Audio uploaded, processing started')).toBeInTheDocument();
    expect(onPendingUploadCancelled).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(onUploadProgressChange).toHaveBeenLastCalledWith(ids.trackId, {
      active: false,
      progress: 0,
      stage: null,
    });
  });

  it('keeps a server-finalizing identity non-cancellable and retries the exact session after a completion network failure', async () => {
    const ids = createTrackAudioTestIds();
    let rejectUpload: (error: Error) => void = () => {};
    const onPendingUploadCancelled = vi.fn();
    const finalizingResumeNotice = {
      uploadId: ids.uploadId,
      fileId: ids.fileId,
      fileName: 'audio.ogg',
      attemptId: ids.attemptId,
      status: UploadSessionStatus.FINALIZING,
    };
    uploadHookMocks.upload
      .mockImplementationOnce((_file: File, options: any) => {
        options.onMultipartSession?.({
          uploadId: ids.uploadId,
          fileId: ids.fileId,
          attemptId: ids.attemptId,
          resumed: false,
          resumable: false,
        });
        options.onLifecycle?.({
          correlationId: 'track-audio-test',
          mode: 'upload',
          stage: 'finalizing',
          percentage: 100,
          fileId: ids.fileId,
          source: 'local',
        });
        return new Promise((_resolve, reject) => {
          rejectUpload = reject;
        });
      })
      .mockImplementationOnce(async (_file: File, options: any) => {
        expect(options.resumeSession).toEqual({ fileId: ids.fileId, uploadId: ids.uploadId });
        options.onMultipartSession?.({
          uploadId: ids.uploadId,
          fileId: ids.fileId,
          attemptId: ids.attemptId,
          resumed: true,
          resumable: false,
        });
        options.onLifecycle?.({
          correlationId: 'track-audio-retry-test',
          mode: 'upload',
          stage: 'finalizing',
          percentage: 100,
          fileId: ids.fileId,
          source: 'local',
        });
        mockUseUploadResumeState.mockReturnValue({ resumeNotice: null, hasActiveSession: false });
        return { url: ids.fileUrl, fileId: ids.fileId };
      });

    const props = {
      trackId: ids.trackId,
      processingStatus: 'TRACK_PROCESSING_STATUS_PENDING' as const,
      audioAttached: false,
      onPendingUploadCancelled,
      compact: true,
      mode: 'button-only' as const,
    };
    render(<TrackAudioUploader {...props} />);

    const file = new File(['audio'], 'audio.ogg', { type: 'audio/ogg' });
    await selectUploadFile(file);

    await act(async () => {
      rejectUpload(new Error('Upload finalization failed'));
    });

    mockUseUploadResumeState.mockReturnValue({ resumeNotice: finalizingResumeNotice, hasActiveSession: true });
    rerender(<TrackAudioUploader {...props} />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelButton).toBeDisabled();
    expect(cancelButton).toHaveAttribute('title', 'Finalizing');
    await view.user.click(cancelButton);
    expect(abortUploadAction).not.toHaveBeenCalled();
    expect(uploadHookMocks.abort).not.toHaveBeenCalled();
    expect(onPendingUploadCancelled).not.toHaveBeenCalled();

    await selectUploadFile(file);

    expect(uploadHookMocks.upload).toHaveBeenCalledTimes(2);
    expect(onPendingUploadCancelled).not.toHaveBeenCalled();
    expect(await screen.findByText('Audio uploaded, processing started')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('reports an interrupted upload after the pending presentation is refreshed', async () => {
    const ids = createTrackAudioTestIds();
    let rejectUpload: (error: Error) => void = () => {};
    uploadHookMocks.upload.mockImplementation((_file: File, options: any) => {
      options.onMultipartSession?.({
        uploadId: ids.uploadId,
        fileId: ids.fileId,
        attemptId: ids.attemptId,
        resumed: false,
        resumable: true,
      });

      return new Promise((_resolve, reject) => {
        rejectUpload = reject;
      });
    });

    const props = {
      trackId: ids.trackId,
      processingStatus: 'TRACK_PROCESSING_STATUS_PENDING' as const,
      audioAttached: false,
      compact: true,
      mode: 'button-only' as const,
    };

    render(<TrackAudioUploader {...props} />);

    await selectUploadFile(new File(['audio'], 'audio.ogg', { type: 'audio/ogg' }));

    rerender(<TrackAudioUploader {...props} />);

    await act(async () => {
      rejectUpload(new Error('Upload interrupted'));
    });

    expect(await screen.findByText('Failed to upload file')).toBeInTheDocument();
  });

  it('aborts the remote multipart session when cancelling a tracked pending upload before resume notice resolves', async () => {
    const ids = createTrackAudioTestIds();
    rememberUploadSession({
      fileId: ids.pendingFileId,
      uploadId: ids.uploadId,
      attemptId: ids.pendingAttemptId,
    });
    vi.mocked(findMultipartUploadCandidateAction).mockResolvedValue({
      uploadId: ids.uploadId,
      fileId: ids.pendingFileId,
      fileName: 'audio.ogg',
      mimeType: 'audio/ogg',
      fileSize: 10,
      fileLastModified: 123,
      chunkSize: 5,
      totalParts: 2,
      uploadedParts: [{ partNumber: 1, etag: 'etag-1' }],
      status: 2,
      lastActivityAt: new Date(),
      attemptId: ids.pendingAttemptId,
      slotId: '',
    } as any);
    vi.mocked(abortUploadAction).mockResolvedValue({ success: true });

    render(
      <TrackAudioUploader
        trackId={ids.trackId}
        audioOriginalFileId={ids.currentAudioFileId}
        processingStatus="TRACK_PROCESSING_STATUS_PENDING"
        audioAttached={false}
        pendingUploadFileId={ids.pendingFileId}
        pendingUploadAttemptId={ids.pendingAttemptId}
        pendingUploadStatus="pending"
        compact
        mode="button-only"
      />,
    );

    await view.user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(findMultipartUploadCandidateAction).toHaveBeenCalledWith({
      uploadType: UploadType.TRACK_AUDIO,
      entityId: ids.trackId,
      entityType: TranscodeEntityType.TRACK,
      expectedCurrentFileId: ids.currentAudioFileId,
      fileId: ids.pendingFileId,
      uploadId: ids.uploadId,
    });
    await waitFor(() =>
      expect(abortUploadAction).toHaveBeenCalledWith({ fileId: ids.pendingFileId, uploadId: ids.uploadId }),
    );
  });
});
