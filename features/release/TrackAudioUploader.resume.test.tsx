// @vitest-environment jsdom

import type { ReactElement } from 'react';
import { randomTestId, randomTestUuid } from '@echovisionlab/geul-common/test/random-id';
import { UploadSessionStatus } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { abortUploadAction, findMultipartUploadCandidateAction } from '@/lib/actions/file';
import { UploadPausedError } from '@/lib/upload/file-upload-contract';
import { UploadResumeStateCode } from '@/lib/upload/resume-state';
import { readUploadSession, rememberUploadSession } from '@/lib/upload/upload-session-store';
import { clearMultipartUploadCandidateLookupCache } from '@/lib/utils/upload-resume-candidate';
import { render, screen, waitFor } from '@/test/render';
import { TrackAudioUploader } from './TrackAudioUploader';

// Resume behaviour runs through the real resume hook and session store; only the server actions and the
// upload transport are replaced.
const upload = vi.fn();

vi.mock('@/lib/hooks/useFileUpload', () => ({
  UPLOAD_ABORTED_MESSAGE: 'Upload aborted',
  UPLOAD_FINALIZATION_FAILED_MESSAGE: 'Upload finalization failed',
  UPLOAD_FAILED_MESSAGE: 'Upload failed',
  UPLOAD_INTERRUPTED_MESSAGE: 'Upload interrupted',
  useFileUpload: () => ({ upload, abort: vi.fn(), isUploading: false }),
}));

vi.mock('@/lib/actions/file', () => ({
  abortUploadAction: vi.fn(),
  findMultipartUploadCandidateAction: vi.fn(),
}));

const INPUT_ID = 'track-audio-input';

function ids() {
  return {
    trackId: randomTestUuid(),
    uploadId: randomTestId('upload'),
    fileId: randomTestUuid(),
    attemptId: randomTestUuid(),
  };
}

// Mirrors the shape findMultipartUploadCandidateAction returns for an active, resumable multipart session.
function serverCandidate({ uploadId, fileId, attemptId }: { uploadId: string; fileId: string; attemptId: string }) {
  return {
    uploadId,
    fileId,
    attemptId,
    extension: 'ogg',
    fileName: 'audio.ogg',
    mimeType: 'audio/ogg',
    fileSize: 10,
    fileLastModified: 123,
    chunkSize: 5,
    totalParts: 2,
    uploadedParts: [{ partNumber: 1, etag: 'etag-1' }],
    status: UploadSessionStatus.UPLOADING,
    lastActivityAt: new Date(),
    slotId: '',
  };
}

function renderUploader(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// The native input sits hidden behind the upload button without an accessible name; jsdom cannot open the
// file dialog the button triggers, so the selection goes to the input directly.
function audioInput() {
  // eslint-disable-next-line testing-library/no-node-access
  const input = document.getElementById(INPUT_ID);
  expect(input).toBeInstanceOf(HTMLInputElement);
  return input as HTMLInputElement;
}

afterEach(() => {
  vi.clearAllMocks();
  clearMultipartUploadCandidateLookupCache();
  window.sessionStorage.clear();
});

describe('TrackAudioUploader resume ownership', () => {
  it('leaves a stale pending upload marker untouched in the passive status renderer', () => {
    const track = ids();
    rememberUploadSession({ fileId: track.fileId, uploadId: track.uploadId, attemptId: track.attemptId });
    const onPendingUploadCancelled = vi.fn();

    renderUploader(
      <TrackAudioUploader
        trackId={track.trackId}
        processingStatus={null}
        audioAttached={false}
        pendingUploadFileId={track.fileId}
        pendingUploadAttemptId={track.attemptId}
        pendingUploadStatus="pending"
        pendingUploadStartedAt="2020-01-01T00:00:00.000Z"
        onPendingUploadCancelled={onPendingUploadCancelled}
        compact
        mode="status-only"
      />,
    );

    expect(screen.getByRole('img', { name: 'Upload session expired. Start a fresh upload.' })).toBeTruthy();
    expect(findMultipartUploadCandidateAction).not.toHaveBeenCalled();
    expect(abortUploadAction).not.toHaveBeenCalled();
    expect(onPendingUploadCancelled).not.toHaveBeenCalled();
    expect(readUploadSession(track.fileId)).toMatchObject({ fileId: track.fileId, uploadId: track.uploadId });
  });

  it('does not look up or offer a server resume session from the passive status renderer', () => {
    const track = ids();
    rememberUploadSession({ fileId: track.fileId, uploadId: track.uploadId });
    vi.mocked(findMultipartUploadCandidateAction).mockResolvedValue(serverCandidate(track) as never);

    renderUploader(
      <TrackAudioUploader
        trackId={track.trackId}
        processingStatus="TRACK_PROCESSING_STATUS_PENDING"
        audioAttached={false}
        pendingUploadFileId={track.fileId}
        compact
        mode="status-only"
      />,
    );

    expect(findMultipartUploadCandidateAction).not.toHaveBeenCalled();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByRole('img', { name: 'Interrupted upload found' })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('audio.ogg');
  });

  it('keeps a server resume candidate local to the button renderer until the user resumes it', async () => {
    const candidate = ids();
    const onUploadProgressChange = vi.fn();
    const onPendingUploadCancelled = vi.fn();
    upload.mockReturnValue(new Promise(() => {}));

    const { user } = renderUploader(
      <TrackAudioUploader
        trackId={candidate.trackId}
        inputId={INPUT_ID}
        processingStatus="TRACK_PROCESSING_STATUS_PENDING"
        audioAttached={false}
        onUploadProgressChange={onUploadProgressChange}
        onPendingUploadCancelled={onPendingUploadCancelled}
        resumeStateOverride={{
          code: UploadResumeStateCode.AVAILABLE,
          hasActiveSession: true,
          resumeNotice: {
            uploadId: candidate.uploadId,
            fileId: candidate.fileId,
            fileName: 'audio.ogg',
            attemptId: candidate.attemptId,
            status: UploadSessionStatus.UPLOADING,
          },
        }}
        compact
        mode="button-only"
      />,
    );

    expect(screen.getByRole('button', { name: 'Upload audio file' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(onPendingUploadCancelled).not.toHaveBeenCalled();
    for (const [, state] of onUploadProgressChange.mock.calls) {
      expect(state).toEqual({ active: false, progress: 0, stage: null });
    }

    await user.upload(audioInput(), new File(['audio'], 'audio.ogg', { type: 'audio/ogg' }));

    expect(upload).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({
        entityId: candidate.trackId,
        resumeSession: { fileId: candidate.fileId, uploadId: candidate.uploadId },
      }),
    );
  });

  it('resumes a server session without an attempt id without inventing one', async () => {
    const track = ids();
    rememberUploadSession({ fileId: track.fileId, uploadId: track.uploadId });
    vi.mocked(findMultipartUploadCandidateAction).mockResolvedValue(
      serverCandidate({ ...track, attemptId: '' }) as never,
    );
    vi.mocked(abortUploadAction).mockResolvedValue({ success: true } as never);
    upload.mockImplementation(async (_file: File, options: { onMultipartSession?: (session: object) => void }) => {
      options.onMultipartSession?.({ uploadId: track.uploadId, fileId: track.fileId, resumed: true, resumable: true });
      throw new UploadPausedError();
    });
    const onPendingUploadCancelled = vi.fn();

    const { user } = renderUploader(
      <TrackAudioUploader
        trackId={track.trackId}
        inputId={INPUT_ID}
        processingStatus="TRACK_PROCESSING_STATUS_PENDING"
        audioAttached={false}
        pendingUploadFileId={track.fileId}
        onPendingUploadCancelled={onPendingUploadCancelled}
        compact
        mode="button-only"
      />,
    );
    await waitFor(() =>
      expect(findMultipartUploadCandidateAction).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: track.trackId, fileId: track.fileId, uploadId: track.uploadId }),
      ),
    );

    await user.upload(audioInput(), new File(['audio'], 'audio.ogg', { type: 'audio/ogg' }));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    const [, uploadOptions] = upload.mock.calls[0]!;
    expect(uploadOptions.resumeSession).toEqual({ fileId: track.fileId, uploadId: track.uploadId });
    expect(uploadOptions.attemptId).toBeUndefined();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(onPendingUploadCancelled).toHaveBeenCalledWith({ attemptId: undefined, fileId: track.fileId }),
    );
    expect(abortUploadAction).toHaveBeenCalledWith({ fileId: track.fileId, uploadId: track.uploadId });
  });
});

it.each([
  [UploadResumeStateCode.LOOKUP_PENDING, 'progressbar', 'Loading...'],
  [UploadResumeStateCode.LOOKUP_ERROR, 'img', 'Failed to load data.'],
  [UploadResumeStateCode.MISSING_SESSION, 'img', 'Not available'],
] as const)('shows %s recovery without inventing resume availability or losing identity', (code, role, name) => {
  const track = ids();
  rememberUploadSession({ fileId: track.fileId, uploadId: track.uploadId, attemptId: track.attemptId });
  const onCancelled = vi.fn();
  renderUploader(
    <TrackAudioUploader
      trackId={track.trackId}
      processingStatus="TRACK_PROCESSING_STATUS_PENDING"
      pendingUploadFileId={track.fileId}
      pendingUploadAttemptId={track.attemptId}
      pendingUploadStatus="pending"
      onPendingUploadCancelled={onCancelled}
      resumeStateOverride={{ code, resumeNotice: null, hasActiveSession: false }}
      mode="status-only"
    />,
  );
  expect(screen.getByRole(role, { name })).toBeInTheDocument();
  expect(screen.queryByRole('img', { name: 'Interrupted upload found' })).not.toBeInTheDocument();
  expect(readUploadSession(track.fileId)).toMatchObject({ fileId: track.fileId, uploadId: track.uploadId });
  expect(onCancelled).not.toHaveBeenCalled();
});

it.each([UploadResumeStateCode.IDLE, UploadResumeStateCode.ACTIVE_SURFACE])(
  'does not infer availability from persisted identity in %s',
  (code) => {
    const track = ids();
    renderUploader(
      <TrackAudioUploader
        trackId={track.trackId}
        processingStatus={null}
        pendingUploadFileId={track.fileId}
        pendingUploadStatus="pending"
        resumeStateOverride={{ code, resumeNotice: null, hasActiveSession: false }}
        mode="status-only"
      />,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  },
);

it.each([
  [{ activeUploadState: { active: true, progress: 35, stage: 'uploading' } }, 'Uploading 35%'],
  [{ activeUploadState: { active: true, progress: 100, stage: 'finalizing' } }, 'Finalizing'],
  [{ audioAttached: true, processingActive: true, processingProgress: 42 }, 'Processing 42%'],
] as const)('keeps transfer and processing ahead of recovery: %s', (props, label) => {
  renderUploader(
    <TrackAudioUploader
      trackId={ids().trackId}
      processingStatus={null}
      pendingUploadFileId="pending-file"
      pendingUploadStatus="expired"
      resumeStateOverride={{ code: UploadResumeStateCode.LOOKUP_ERROR, resumeNotice: null, hasActiveSession: false }}
      mode="status-only"
      {...props}
    />,
  );
  expect(screen.getByRole('progressbar', { name: label })).toBeInTheDocument();
  expect(screen.queryByRole('img', { name: 'Failed to load data.' })).not.toBeInTheDocument();
});

it('keeps a suppressed recovery identity hidden while lookup is pending', () => {
  const track = ids();
  renderUploader(
    <TrackAudioUploader
      trackId={track.trackId}
      processingStatus={null}
      pendingUploadFileId={track.fileId}
      pendingUploadAttemptId={track.attemptId}
      suppressedResumeIdentity={{ attemptId: track.attemptId }}
      resumeStateOverride={{ code: UploadResumeStateCode.LOOKUP_PENDING, resumeNotice: null, hasActiveSession: false }}
      mode="status-only"
    />,
  );
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it('hides recovery instructions while attached audio is processing without a live progress event', () => {
  renderUploader(
    <TrackAudioUploader
      trackId={ids().trackId}
      processingStatus="TRACK_PROCESSING_STATUS_PROCESSING"
      audioAttached
      pendingUploadFileId="pending-file"
      resumeStateOverride={{ code: UploadResumeStateCode.LOOKUP_ERROR, resumeNotice: null, hasActiveSession: false }}
    />,
  );
  expect(screen.getByRole('progressbar', { name: 'Processing...' })).toBeInTheDocument();
  expect(screen.queryByText('Failed to load data.')).not.toBeInTheDocument();
});
