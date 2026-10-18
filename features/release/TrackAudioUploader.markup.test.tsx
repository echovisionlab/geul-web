// @vitest-environment jsdom

import { randomTestUuid } from '@echovisionlab/geul-common/test/random-id';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploadType } from '@/lib/types/upload/model';
import { render, screen } from '@/test/render';
import { TrackAudioUploader } from './TrackAudioUploader';

const hooks = vi.hoisted(() => ({
  isUploading: false,
  useUploadResumeState: vi.fn((_uploadType: UploadType, _entityId: string | null, _options: object) => ({
    code: 'U-RESUME-IDLE',
    resumeNotice: null,
    hasActiveSession: false,
  })),
}));

vi.mock('@/lib/hooks/useFileUpload', () => ({
  UPLOAD_ABORTED_MESSAGE: 'Upload aborted',
  UPLOAD_FINALIZATION_FAILED_MESSAGE: 'Upload finalization failed',
  UPLOAD_FAILED_MESSAGE: 'Upload failed',
  UPLOAD_INTERRUPTED_MESSAGE: 'Upload interrupted',
  useFileUpload: () => ({ upload: vi.fn(), abort: vi.fn(), isUploading: hooks.isUploading }),
}));

vi.mock('@/lib/hooks/useUploadResumeNotice', () => ({ useUploadResumeState: hooks.useUploadResumeState }));

afterEach(() => {
  hooks.isUploading = false;
  hooks.useUploadResumeState.mockClear();
  vi.restoreAllMocks();
});

function renderUploader(props: ComponentProps<typeof TrackAudioUploader>) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <TrackAudioUploader {...props} />
    </QueryClientProvider>,
  );
}

describe('TrackAudioUploader presentation', () => {
  it('limits the native picker to audio file extensions without enabling mp4 video files', async () => {
    const pickerClick = vi.spyOn(HTMLInputElement.prototype, 'click');
    const { user } = renderUploader({
      trackId: randomTestUuid(),
      inputId: 'track-audio-input',
      processingStatus: 'TRACK_PROCESSING_STATUS_PENDING',
    });

    await user.click(screen.getByRole('button', { name: 'Upload audio file' }));
    const pickerInput = pickerClick.mock.contexts.at(-1) as HTMLInputElement | undefined;
    expect(pickerInput).toBeDefined();
    const accept = pickerInput?.accept;
    expect(accept?.split(',')).toContain('.m4a');
    expect(accept).not.toContain('audio/mp4');
    expect(accept).not.toContain('.mp4');
  });

  describe('status-only cell', () => {
    it('shows an icon-only processing status while detailed lifecycle progress stays out of the cell', () => {
      renderUploader({
        trackId: randomTestUuid(),
        processingStatus: 'TRACK_PROCESSING_STATUS_PROCESSING',
        processingActive: true,
        processingProgress: 42,
        audioAttached: true,
        compact: true,
        mode: 'status-only',
      });

      expect(screen.getByRole('progressbar', { name: 'Processing 42%' })).toBeInTheDocument();
      expect(screen.queryByText(/Processing/)).not.toBeInTheDocument();
    });

    it('does not expose ready text while an active lifecycle stage is still running', () => {
      renderUploader({
        trackId: randomTestUuid(),
        processingStatus: 'TRACK_PROCESSING_STATUS_COMPLETED',
        processingActive: true,
        processingProgress: 84,
        audioAttached: true,
        compact: true,
        mode: 'status-only',
      });

      expect(screen.getByRole('progressbar', { name: 'Processing 84%' })).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: 'Audio ready' })).not.toBeInTheDocument();
      expect(screen.queryByText(/Processing/)).not.toBeInTheDocument();
    });

    it('shows a ready icon when lifecycle has already completed', () => {
      renderUploader({
        trackId: randomTestUuid(),
        processingStatus: 'TRACK_PROCESSING_STATUS_COMPLETED',
        processingProgress: 100,
        audioAttached: true,
        compact: true,
        mode: 'status-only',
      });

      expect(screen.getByRole('img', { name: 'Audio ready' })).toBeInTheDocument();
      expect(screen.queryByText('Audio ready')).not.toBeInTheDocument();
    });

    it('shows idle for a bare pending track with no audio or resumable upload', () => {
      renderUploader({
        trackId: randomTestUuid(),
        processingStatus: 'TRACK_PROCESSING_STATUS_PENDING',
        audioAttached: false,
        compact: true,
        mode: 'status-only',
      });

      expect(screen.getByText('-')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Upload audio file' })).not.toBeInTheDocument();
    });

    it('prioritizes active local upload state over interrupted upload warnings in the status cell', () => {
      const trackId = randomTestUuid();
      renderUploader({
        trackId,
        processingStatus: 'TRACK_PROCESSING_STATUS_PENDING',
        activeUploadState: { active: true, progress: 21, stage: 'uploading' },
        audioAttached: false,
        pendingUploadFileId: randomTestUuid(),
        pendingUploadAttemptId: randomTestUuid(),
        pendingUploadStatus: 'pending',
        pendingUploadStartedAt: '2026-04-10T00:00:00.000Z',
        compact: true,
        mode: 'status-only',
      });

      expect(screen.getByRole('progressbar', { name: 'Uploading 21%' })).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.queryByText('Interrupted upload found')).not.toBeInTheDocument();
    });
  });

  it('hides the upload trigger while a local upload is active and leaves cancel available', () => {
    const trackId = randomTestUuid();
    hooks.isUploading = true;

    renderUploader({
      trackId,
      processingStatus: 'TRACK_PROCESSING_STATUS_PENDING',
      audioAttached: false,
      compact: true,
      mode: 'button-only',
    });

    expect(screen.queryByRole('button', { name: 'Upload audio file' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });

  it('uses the current original file as the CAS fence for replacement resume lookup', () => {
    const trackId = randomTestUuid();
    const currentAudioFileId = randomTestUuid();
    const pendingFileId = randomTestUuid();
    const pendingAttemptId = randomTestUuid();

    renderUploader({
      trackId,
      audioOriginalFileId: currentAudioFileId,
      processingStatus: 'TRACK_PROCESSING_STATUS_PENDING',
      audioAttached: true,
      pendingUploadFileId: pendingFileId,
      pendingUploadAttemptId: pendingAttemptId,
      pendingUploadStatus: 'pending',
      compact: true,
      mode: 'button-only',
    });

    expect(hooks.useUploadResumeState).toHaveBeenCalledWith(UploadType.TRACK_AUDIO, trackId, {
      entityType: TranscodeEntityType.TRACK,
      expectedCurrentFileId: currentAudioFileId,
      fileId: pendingFileId,
      attemptId: pendingAttemptId,
      pendingFileId,
      hasDurableSource: true,
    });
  });
});
