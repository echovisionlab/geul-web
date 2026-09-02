// @vitest-environment jsdom

import { act } from 'react';
import { randomTestId, randomTestUuid } from '@echovisionlab/geul-common/test/random-id';
import { UploadSessionStatus, UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploadResumeStateCode } from '@/lib/upload/resume-state';
import { rememberUploadSession } from '@/lib/upload/upload-session-store';
import { clearMultipartUploadCandidateLookupCache } from '@/lib/utils/upload-resume-candidate';
import { useUploadResumeState, type UploadResumeState } from './useUploadResumeNotice';

const mockFindMultipartUploadCandidateAction = vi.fn();
const mockUseIsUploadSurfaceActive = vi.fn(() => false);
const mockUseIsUploadSurfaceSlotActive = vi.fn(() => false);

vi.mock('@/lib/actions/file', () => ({
  findMultipartUploadCandidateAction: (...args: unknown[]) => mockFindMultipartUploadCandidateAction(...args),
}));

vi.mock('@/lib/hooks/uploadSurfaceActivity', () => ({
  buildUploadSurfaceKey: () => 'surface-key',
  useIsUploadSurfaceActive: () => mockUseIsUploadSurfaceActive(),
  useIsUploadSurfaceSlotActive: () => mockUseIsUploadSurfaceSlotActive(),
}));

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let latestState: UploadResumeState | null = null;

function createProbeOptions(): {
  pendingFileId?: string;
  slotId?: string;
  attemptId?: string;
} {
  return {
    pendingFileId: randomTestUuid(),
  };
}

let releaseId = randomTestUuid();
let probeOptions = createProbeOptions();

function HookProbe() {
  latestState = useUploadResumeState(UploadType.TRACK_AUDIO, releaseId, {
    pendingFileId: probeOptions.pendingFileId,
    slotId: probeOptions.slotId,
    attemptId: probeOptions.attemptId,
    hasDurableSource: false,
  });
  return null;
}

async function renderProbe() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(<HookProbe />);
    await Promise.resolve();
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  vi.useRealTimers();
  container?.remove();
  container = null;
  root = null;
  latestState = null;
  clearMultipartUploadCandidateLookupCache();
  releaseId = randomTestUuid();
  probeOptions = createProbeOptions();
  mockFindMultipartUploadCandidateAction.mockReset();
  mockUseIsUploadSurfaceActive.mockReset();
  mockUseIsUploadSurfaceActive.mockReturnValue(false);
  mockUseIsUploadSurfaceSlotActive.mockReset();
  mockUseIsUploadSurfaceSlotActive.mockReturnValue(false);
  window.sessionStorage.clear();
});

describe('useUploadResumeState', () => {
  it('reports a missing resumable session without clearing pending identity locally', async () => {
    mockFindMultipartUploadCandidateAction.mockResolvedValue(null);

    await renderProbe();

    expect(latestState).toEqual({
      code: UploadResumeStateCode.MISSING_SESSION,
      resumeNotice: null,
      hasActiveSession: false,
    });
  });

  it('keeps an active resumable session instead of clearing it', async () => {
    const uploadId = randomTestId('upload');
    rememberUploadSession({ fileId: probeOptions.pendingFileId!, uploadId });

    mockFindMultipartUploadCandidateAction.mockResolvedValue({
      uploadId,
      fileId: probeOptions.pendingFileId,
      totalParts: 4,
      chunkSize: 10 * 1024 * 1024,
      status: UploadSessionStatus.UPLOADING,
      fileName: 'track.ogg',
      fileSize: 1024,
      mimeType: 'audio/ogg',
      fileLastModified: 123,
      lastActivityAt: new Date(),
    });

    await renderProbe();

    expect(latestState).toEqual({
      code: UploadResumeStateCode.AVAILABLE,
      resumeNotice: {
        uploadId,
        fileId: probeOptions.pendingFileId,
        fileName: 'track.ogg',
        attemptId: undefined,
        status: UploadSessionStatus.UPLOADING,
      },
      hasActiveSession: true,
    });
  });

  it('ignores a single-part upload session because it is not resumable', async () => {
    const uploadId = randomTestId('upload');
    rememberUploadSession({ fileId: probeOptions.pendingFileId!, uploadId });
    mockFindMultipartUploadCandidateAction.mockResolvedValue({
      uploadId,
      fileId: probeOptions.pendingFileId,
      totalParts: 1,
      chunkSize: 10 * 1024 * 1024,
      status: UploadSessionStatus.UPLOADING,
      fileName: 'track.ogg',
      fileSize: 1024,
      mimeType: 'audio/ogg',
      fileLastModified: 123,
      lastActivityAt: new Date(),
    });

    await renderProbe();

    expect(latestState).toEqual({
      code: UploadResumeStateCode.MISSING_SESSION,
      resumeNotice: null,
      hasActiveSession: false,
    });
  });

  it('keeps a stale single-part FINALIZING session available for authoritative completion recovery', async () => {
    const uploadId = randomTestId('upload');
    rememberUploadSession({ fileId: probeOptions.pendingFileId!, uploadId });

    mockFindMultipartUploadCandidateAction.mockResolvedValue({
      uploadId,
      fileId: probeOptions.pendingFileId,
      totalParts: 1,
      chunkSize: 10 * 1024 * 1024,
      status: UploadSessionStatus.FINALIZING,
      fileName: 'track.ogg',
      fileSize: 1024,
      mimeType: 'audio/ogg',
      fileLastModified: 123,
      lastActivityAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    });

    await renderProbe();

    expect(latestState).toEqual({
      code: UploadResumeStateCode.AVAILABLE,
      resumeNotice: {
        uploadId,
        fileId: probeOptions.pendingFileId,
        fileName: 'track.ogg',
        attemptId: undefined,
        status: UploadSessionStatus.FINALIZING,
      },
      hasActiveSession: true,
    });
  });

  it('still ignores a stale UPLOADING session outside the resume window', async () => {
    const uploadId = randomTestId('upload');
    rememberUploadSession({ fileId: probeOptions.pendingFileId!, uploadId });
    mockFindMultipartUploadCandidateAction.mockResolvedValue({
      uploadId,
      fileId: probeOptions.pendingFileId,
      totalParts: 4,
      chunkSize: 10 * 1024 * 1024,
      status: UploadSessionStatus.UPLOADING,
      fileName: 'track.ogg',
      fileSize: 40 * 1024 * 1024,
      mimeType: 'audio/ogg',
      fileLastModified: 123,
      lastActivityAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    });

    await renderProbe();

    expect(latestState).toEqual({
      code: UploadResumeStateCode.MISSING_SESSION,
      resumeNotice: null,
      hasActiveSession: false,
    });
  });

  it('keeps pending upload identity when candidate lookup fails transiently', async () => {
    rememberUploadSession({ fileId: probeOptions.pendingFileId!, uploadId: randomTestId('upload') });
    mockFindMultipartUploadCandidateAction.mockRejectedValue(new Error('temporary failure'));

    await renderProbe();

    expect(latestState).toEqual({
      code: UploadResumeStateCode.LOOKUP_ERROR,
      resumeNotice: null,
      hasActiveSession: false,
    });
  });

  it('does not query the server when only slot identity exists', async () => {
    probeOptions = {
      slotId: randomTestId('slot-audio'),
    };
    mockFindMultipartUploadCandidateAction.mockResolvedValue(null);

    await renderProbe();

    expect(mockFindMultipartUploadCandidateAction).not.toHaveBeenCalled();
    expect(latestState).toEqual({
      code: UploadResumeStateCode.IDLE,
      resumeNotice: null,
      hasActiveSession: false,
    });
  });

  it('fails closed without an exact local file and upload identity', async () => {
    const slotId = randomTestId('slot-image');
    const attemptId = randomTestUuid();
    probeOptions = {
      slotId,
      attemptId,
    };

    await renderProbe();

    expect(mockFindMultipartUploadCandidateAction).not.toHaveBeenCalled();
    expect(latestState).toEqual({
      code: UploadResumeStateCode.MISSING_SESSION,
      resumeNotice: null,
      hasActiveSession: false,
    });
  });

  it('reports missing slot-scoped attempt identity after backend lookup finds no session', async () => {
    const slotId = randomTestId('slot-image');
    const attemptId = randomTestUuid();

    probeOptions = {
      slotId,
      attemptId,
    };
    mockFindMultipartUploadCandidateAction.mockResolvedValue(null);

    await renderProbe();

    expect(mockFindMultipartUploadCandidateAction).not.toHaveBeenCalled();
    expect(latestState).toEqual({
      code: UploadResumeStateCode.MISSING_SESSION,
      resumeNotice: null,
      hasActiveSession: false,
    });
  });

  it('does not show a resume notice while any upload is active for the same slot', async () => {
    mockUseIsUploadSurfaceSlotActive.mockReturnValue(true);

    await renderProbe();

    expect(mockFindMultipartUploadCandidateAction).not.toHaveBeenCalled();
    expect(latestState).toEqual({
      code: UploadResumeStateCode.ACTIVE_SURFACE,
      resumeNotice: null,
      hasActiveSession: false,
    });
  });
});
