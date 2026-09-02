// @vitest-environment jsdom

import { act } from 'react';
import { randomTestId, randomTestUuid } from '@echovisionlab/geul-common/test/random-id';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifications } from '@mantine/notifications';
import { abortUploadAction, findMultipartUploadCandidateAction } from '@/lib/actions/file';
import { UploadType } from '@/lib/types/upload/model';
import { rememberUploadSession } from '@/lib/upload/upload-session-store';
import { TestProviders } from '@/test/TestProviders';
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

vi.mock('@tanstack/react-query', () => ({
  useMutation: (options?: { mutationFn?: (...args: any[]) => unknown }) => ({
    mutateAsync: vi.fn(async (...args: any[]) => options?.mutationFn?.(...args)),
    isPending: false,
  }),
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

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

vi.mock('@/lib/utils/client-logger', () => ({
  createClientLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function createTrackAudioTestIds() {
  const releaseId = randomTestUuid();
  const trackId = randomTestUuid();
  const uploadId = randomTestId('upload');
  const fileId = randomTestUuid();
  const pendingFileId = randomTestUuid();
  const resumeFileId = randomTestUuid();
  const attemptId = randomTestUuid();
  const pendingAttemptId = randomTestUuid();
  const resumeAttemptId = randomTestUuid();
  const currentAttemptId = randomTestUuid();
  const currentAudioFileId = randomTestUuid();

  return {
    releaseId,
    trackId,
    uploadId,
    fileId,
    pendingFileId,
    resumeFileId,
    attemptId,
    pendingAttemptId,
    resumeAttemptId,
    currentAttemptId,
    currentAudioFileId,
    fileUrl: `https://cdn.example.test/media/token/${fileId}.ogg`,
    cancelButtonSelector: `#release-track-audio-cancel-button-${trackId}`,
  };
}

function render(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<TestProviders>{node}</TestProviders>);
  });
}

function rerender(node: React.ReactNode) {
  act(() => {
    root?.render(<TestProviders>{node}</TestProviders>);
  });
}

async function selectUploadFile(file: File) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).not.toBeNull();

  await act(async () => {
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });
    input?.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
  vi.clearAllMocks();
  uploadHookMocks.isUploading = false;
  mockUseUploadResumeState.mockReset();
  mockUseUploadResumeState.mockReturnValue({
    resumeNotice: null,
    hasActiveSession: false,
  });
  window.sessionStorage.clear();
});

describe('TrackAudioUploader', () => {
  it('limits the native picker to audio file extensions without enabling mp4 video files', () => {
    const ids = createTrackAudioTestIds();

    render(
      <TrackAudioUploader
        trackId={ids.trackId}
        inputId="track-audio-input"
        processingStatus="TRACK_PROCESSING_STATUS_PENDING"
      />,
    );

    const input = document.querySelector<HTMLInputElement>('#track-audio-input');
    expect(input?.accept).toContain('.m4a');
    expect(input?.accept).not.toContain('audio/mp4');
    expect(input?.accept).not.toContain('.mp4');
  });

  it('shows an icon-only processing status while detailed lifecycle progress stays out of the cell', () => {
    const ids = createTrackAudioTestIds();

    render(
      <TrackAudioUploader
        trackId={ids.trackId}
        processingStatus="TRACK_PROCESSING_STATUS_PROCESSING"
        processingActive
        processingProgress={42}
        audioAttached
        compact
        mode="status-only"
      />,
    );

    expect(document.querySelector('[aria-label="Processing 42%"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Processing');
    expect(document.body.textContent).not.toContain('Processing 42%');
  });

  it('does not expose ready text while an active lifecycle stage is still running', () => {
    const ids = createTrackAudioTestIds();

    render(
      <TrackAudioUploader
        trackId={ids.trackId}
        processingStatus="TRACK_PROCESSING_STATUS_COMPLETED"
        processingActive
        processingProgress={84}
        audioAttached
        compact
        mode="status-only"
      />,
    );

    expect(document.querySelector('[aria-label="Processing 84%"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Ready');
    expect(document.body.textContent).not.toContain('Processing');
  });

  it('shows a ready icon when lifecycle has already completed', () => {
    const ids = createTrackAudioTestIds();

    render(
      <TrackAudioUploader
        trackId={ids.trackId}
        processingStatus="TRACK_PROCESSING_STATUS_COMPLETED"
        processingProgress={100}
        audioAttached
        compact
        mode="status-only"
      />,
    );

    expect(document.querySelector('[aria-label="Audio ready"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Audio ready');
  });

  it('shows idle for a bare pending track with no audio or resumable upload', () => {
    const ids = createTrackAudioTestIds();

    render(
      <TrackAudioUploader
        trackId={ids.trackId}
        processingStatus="TRACK_PROCESSING_STATUS_PENDING"
        audioAttached={false}
        compact
        mode="status-only"
      />,
    );

    expect(document.body.textContent).toContain('-');
    expect(document.body.textContent).not.toContain('Upload audio file');
  });

  it('prioritizes active local upload state over interrupted upload warnings in the status cell', () => {
    const ids = createTrackAudioTestIds();

    render(
      <TrackAudioUploader
        trackId={ids.trackId}
        processingStatus="TRACK_PROCESSING_STATUS_PENDING"
        activeUploadState={{ active: true, progress: 21, stage: 'uploading' }}
        audioAttached={false}
        pendingUploadFileId={ids.pendingFileId}
        pendingUploadAttemptId={ids.pendingAttemptId}
        pendingUploadStatus="pending"
        pendingUploadStartedAt="2026-04-10T00:00:00.000Z"
        compact
        mode="status-only"
      />,
    );

    expect(document.querySelector(`#release-track-audio-status-${ids.trackId}-processing`)).not.toBeNull();
    expect(document.querySelector(`#release-track-audio-status-${ids.trackId}-warning`)).toBeNull();
    expect(document.body.textContent).not.toContain('Interrupted upload found');
  });

  it('hides the upload trigger while a local upload is active and leaves cancel available', () => {
    const ids = createTrackAudioTestIds();
    uploadHookMocks.isUploading = true;

    render(
      <TrackAudioUploader
        trackId={ids.trackId}
        processingStatus="TRACK_PROCESSING_STATUS_PENDING"
        audioAttached={false}
        compact
        mode="button-only"
      />,
    );

    expect(document.querySelector(`#release-track-audio-upload-action-${ids.trackId}`)).toBeNull();
    expect(document.querySelector(ids.cancelButtonSelector)).not.toBeNull();
  });

  it('does not clear stale pending upload markers from the passive status renderer', () => {
    const ids = createTrackAudioTestIds();
    mockUseUploadResumeState.mockReturnValue({
      resumeNotice: null,
      hasActiveSession: false,
    });

    render(
      <TrackAudioUploader
        trackId={ids.trackId}
        processingStatus={null}
        audioAttached={false}
        pendingUploadFileId={ids.pendingFileId}
        pendingUploadAttemptId={ids.pendingAttemptId}
        pendingUploadStatus="pending"
        pendingUploadStartedAt="2026-04-10T00:00:00.000Z"
        compact
        mode="status-only"
      />,
    );
    expect(mockUseUploadResumeState).toHaveBeenCalledWith(UploadType.TRACK_AUDIO, null, {
      entityType: TranscodeEntityType.TRACK,
      fileId: ids.pendingFileId,
      attemptId: ids.pendingAttemptId,
      pendingFileId: ids.pendingFileId,
      hasDurableSource: false,
    });
  });

  it('keeps a resumable pending file id local in the active button-side renderer', () => {
    const ids = createTrackAudioTestIds();
    mockUseUploadResumeState.mockReturnValue({
      resumeNotice: {
        uploadId: ids.uploadId,
        fileId: ids.resumeFileId,
        fileName: 'audio.ogg',
        attemptId: ids.resumeAttemptId,
        status: 1,
      },
      hasActiveSession: true,
    } as any);

    render(
      <TrackAudioUploader
        trackId={ids.trackId}
        processingStatus="TRACK_PROCESSING_STATUS_PENDING"
        audioAttached={false}
        compact
        mode="button-only"
      />,
    );
    expect(mockUseUploadResumeState).toHaveBeenCalledWith(UploadType.TRACK_AUDIO, ids.trackId, {
      entityType: TranscodeEntityType.TRACK,
      fileId: undefined,
      attemptId: undefined,
      pendingFileId: undefined,
      hasDurableSource: false,
    });
  });

  it('does not restore a resumable pending file id from the passive status renderer', () => {
    const ids = createTrackAudioTestIds();
    mockUseUploadResumeState.mockReturnValue({
      resumeNotice: {
        uploadId: ids.uploadId,
        fileId: ids.resumeFileId,
        fileName: 'audio.ogg',
        attemptId: ids.resumeAttemptId,
        status: 1,
      },
      hasActiveSession: true,
    } as any);

    render(
      <TrackAudioUploader
        trackId={ids.trackId}
        processingStatus="TRACK_PROCESSING_STATUS_PENDING"
        audioAttached={false}
        compact
        mode="status-only"
      />,
    );
    expect(mockUseUploadResumeState).toHaveBeenCalledWith(UploadType.TRACK_AUDIO, null, {
      entityType: TranscodeEntityType.TRACK,
      fileId: undefined,
      attemptId: undefined,
      pendingFileId: undefined,
      hasDurableSource: false,
    });
  });

  it('uses the current original file as the CAS fence for replacement resume lookup', () => {
    const ids = createTrackAudioTestIds();

    render(
      <TrackAudioUploader
        trackId={ids.trackId}
        audioOriginalFileId={ids.currentAudioFileId}
        processingStatus="TRACK_PROCESSING_STATUS_PENDING"
        audioAttached
        pendingUploadFileId={ids.pendingFileId}
        pendingUploadAttemptId={ids.pendingAttemptId}
        pendingUploadStatus="pending"
        compact
        mode="button-only"
      />,
    );

    expect(mockUseUploadResumeState).toHaveBeenCalledWith(UploadType.TRACK_AUDIO, ids.trackId, {
      entityType: TranscodeEntityType.TRACK,
      expectedCurrentFileId: ids.currentAudioFileId,
      fileId: ids.pendingFileId,
      attemptId: ids.pendingAttemptId,
      pendingFileId: ids.pendingFileId,
      hasDurableSource: true,
    });
  });

  it('does not synthesize a new attempt id when resuming a server session without one', () => {
    const ids = createTrackAudioTestIds();
    mockUseUploadResumeState.mockReturnValue({
      resumeNotice: {
        uploadId: ids.uploadId,
        fileId: ids.resumeFileId,
        fileName: 'audio.ogg',
        attemptId: '',
        status: 1,
      },
      hasActiveSession: true,
    } as any);

    render(
      <TrackAudioUploader
        trackId={ids.trackId}
        processingStatus="TRACK_PROCESSING_STATUS_PENDING"
        audioAttached={false}
        compact
        mode="button-only"
      />,
    );

    expect(mockUseUploadResumeState).toHaveBeenCalledWith(UploadType.TRACK_AUDIO, ids.trackId, {
      entityType: TranscodeEntityType.TRACK,
      fileId: undefined,
      attemptId: undefined,
      pendingFileId: undefined,
      hasDurableSource: false,
    });
  });

  it('does not adopt a resumed session over an already fenced pending attempt', () => {
    const ids = createTrackAudioTestIds();
    mockUseUploadResumeState.mockReturnValue({
      resumeNotice: {
        uploadId: ids.uploadId,
        fileId: ids.resumeFileId,
        fileName: 'audio.ogg',
        attemptId: ids.resumeAttemptId,
        status: 1,
      },
      hasActiveSession: true,
    } as any);

    render(
      <TrackAudioUploader
        trackId={ids.trackId}
        processingStatus="TRACK_PROCESSING_STATUS_PENDING"
        audioAttached={false}
        pendingUploadAttemptId={ids.currentAttemptId}
        compact
        mode="button-only"
      />,
    );

    expect(mockUseUploadResumeState).toHaveBeenCalledWith(UploadType.TRACK_AUDIO, ids.trackId, {
      entityType: TranscodeEntityType.TRACK,
      fileId: undefined,
      attemptId: ids.currentAttemptId,
      pendingFileId: undefined,
      hasDurableSource: false,
    });
  });

  it('does not publish pending upload state before a backend multipart session exists', async () => {
    const ids = createTrackAudioTestIds();
    uploadHookMocks.upload.mockRejectedValue(new Error('Upload interrupted'));

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

    expect(uploadHookMocks.upload).toHaveBeenCalled();
  });

  it('does not issue a secondary browser attach mutation after upload completion', async () => {
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

  it('keeps recoverable pending identity when backend-owned upload completion fails recoverably', async () => {
    const ids = createTrackAudioTestIds();
    uploadHookMocks.upload.mockImplementation(async (_file: File, options: any) => {
      options.onMultipartSession?.({
        uploadId: ids.uploadId,
        fileId: ids.fileId,
        resumed: false,
        resumable: true,
      });
      throw new Error('Upload interrupted');
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

    expect(uploadHookMocks.upload).toHaveBeenCalled();
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

    expect(document.querySelector(ids.cancelButtonSelector)).not.toBeNull();
    expect(mockUseUploadResumeState).toHaveBeenLastCalledWith(UploadType.TRACK_AUDIO, ids.trackId, {
      entityType: TranscodeEntityType.TRACK,
      fileId: ids.fileId,
      attemptId: ids.attemptId,
      pendingFileId: ids.fileId,
      hasDurableSource: false,
    });
  });

  it('shows an upload failure notification when backend failure clears pending state before the local upload rejects', async () => {
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
      await Promise.resolve();
    });

    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        color: 'red',
      }),
    );
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

    await act(async () => {
      document
        .querySelector<HTMLButtonElement>(ids.cancelButtonSelector)
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(findMultipartUploadCandidateAction).toHaveBeenCalledWith({
      uploadType: UploadType.TRACK_AUDIO,
      entityId: ids.trackId,
      entityType: TranscodeEntityType.TRACK,
      expectedCurrentFileId: ids.currentAudioFileId,
      fileId: ids.pendingFileId,
      uploadId: ids.uploadId,
    });
    expect(abortUploadAction).toHaveBeenCalledWith({
      fileId: ids.pendingFileId,
      uploadId: ids.uploadId,
    });
  });
});
