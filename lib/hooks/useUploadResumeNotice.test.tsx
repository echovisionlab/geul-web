// @vitest-environment jsdom

import { useLayoutEffect } from 'react';
import { randomTestId, randomTestUuid } from '@echovisionlab/geul-common/test/random-id';
import { UploadSessionStatus, UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploadResumeStateCode } from '@/lib/upload/resume-state';
import { forgetUploadSession, readUploadSession, rememberUploadSession } from '@/lib/upload/upload-session-store';
import { act, renderHook, waitFor } from '@/test/render';
import { clearMultipartUploadCandidateLookupCache } from '@/lib/utils/upload-resume-candidate';
import { buildUploadSurfaceKey, clearUploadSurfaceActive, markUploadSurfaceActive } from './uploadSurfaceActivity';
import { useUploadResumeState, type UploadResumeState } from './useUploadResumeNotice';

const mockFindMultipartUploadCandidateAction = vi.fn();
vi.mock('@/lib/actions/file', () => ({
  findMultipartUploadCandidateAction: (...args: unknown[]) => mockFindMultipartUploadCandidateAction(...args),
}));

const activeSurfaceKeys: string[] = [];
const rememberedFileIds: string[] = [];

function rememberSession(fileId: string, uploadId: string) {
  rememberUploadSession({ fileId, uploadId });
  rememberedFileIds.push(fileId);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type Candidate = Awaited<ReturnType<typeof import('@/lib/actions/file').findMultipartUploadCandidateAction>>;

function candidate(fileId: string, uploadId: string): NonNullable<Candidate> {
  return {
    uploadId,
    fileId,
    extension: 'ogg',
    uploadedParts: [],
    totalParts: 4,
    chunkSize: 10 * 1024 * 1024,
    status: UploadSessionStatus.UPLOADING,
    fileName: 'track.ogg',
    fileSize: 1024,
    mimeType: 'audio/ogg',
    fileLastModified: 123,
    lastActivityAt: new Date(),
    slotId: '',
    attemptId: '',
    clientMediaBundleId: undefined,
  };
}

function createProbeOptions(): NonNullable<Parameters<typeof useUploadResumeState>[2]> {
  return {
    pendingFileId: randomTestUuid(),
  };
}

let releaseId = randomTestUuid();
let probeOptions = createProbeOptions();

function renderProbe() {
  return renderHook(({ entityId, options }) => useUploadResumeState(UploadType.TRACK_AUDIO, entityId, options), {
    initialProps: {
      entityId: releaseId as string | null,
      options: { ...probeOptions, hasDurableSource: false },
    },
  });
}

afterEach(() => {
  activeSurfaceKeys.splice(0).forEach((key) => clearUploadSurfaceActive(key));
  rememberedFileIds.splice(0).forEach(forgetUploadSession);
  clearMultipartUploadCandidateLookupCache();
  releaseId = randomTestUuid();
  probeOptions = createProbeOptions();
  mockFindMultipartUploadCandidateAction.mockReset();
  window.sessionStorage.clear();
});

describe('useUploadResumeState', () => {
  it.each(['available', 'absent', 'error'] as const)('keeps lookup pending until it settles as %s', async (outcome) => {
    const fileId = probeOptions.pendingFileId!;
    const uploadId = randomTestId('upload');
    rememberSession(fileId, uploadId);
    const lookup = deferred<Candidate>();
    mockFindMultipartUploadCandidateAction.mockReturnValue(lookup.promise);

    const { result } = renderProbe();

    expect(result.current).toEqual({
      code: UploadResumeStateCode.LOOKUP_PENDING,
      resumeNotice: null,
      hasActiveSession: false,
    });

    await act(async () => {
      if (outcome === 'error') {
        lookup.reject(new Error('lookup failed'));
      } else {
        lookup.resolve(outcome === 'available' ? candidate(fileId, uploadId) : null);
      }
    });

    expect(result.current.code).toBe(
      {
        available: UploadResumeStateCode.AVAILABLE,
        absent: UploadResumeStateCode.MISSING_SESSION,
        error: UploadResumeStateCode.LOOKUP_ERROR,
      }[outcome],
    );
    expect(result.current.resumeNotice?.fileId ?? null).toBe(outcome === 'available' ? fileId : null);
    expect(readUploadSession(fileId)).toMatchObject({ fileId, uploadId });
  });

  it('keeps settled absence distinct from pending when a durable source exists', async () => {
    const fileId = probeOptions.pendingFileId!;
    rememberSession(fileId, randomTestId('upload'));
    const lookup = deferred<Candidate>();
    mockFindMultipartUploadCandidateAction.mockReturnValue(lookup.promise);
    const { result } = renderHook(() =>
      useUploadResumeState(UploadType.TRACK_AUDIO, releaseId, {
        pendingFileId: fileId,
        hasDurableSource: true,
      }),
    );

    expect(result.current.code).toBe(UploadResumeStateCode.LOOKUP_PENDING);
    await act(async () => lookup.resolve(null));
    expect(result.current.code).toBe(UploadResumeStateCode.IDLE);
    expect(result.current.resumeNotice).toBeNull();
  });

  it.each(['entity', 'attempt', 'slot', 'current file', 'session'] as const)(
    'hides the previous notice on the first commit after the %s changes',
    async (identity) => {
      const fileId = probeOptions.pendingFileId!;
      const uploadId = randomTestId('upload');
      rememberSession(fileId, uploadId);
      mockFindMultipartUploadCandidateAction.mockResolvedValueOnce(candidate(fileId, uploadId));
      const committedStates: UploadResumeState[] = [];
      const { result, rerender } = renderHook(
        ({ entityId, options }) => {
          const state = useUploadResumeState(UploadType.TRACK_AUDIO, entityId, options);
          useLayoutEffect(() => {
            committedStates.push(state);
          });
          return state;
        },
        { initialProps: { entityId: releaseId, options: probeOptions } },
      );
      await waitFor(() => expect(result.current.code).toBe(UploadResumeStateCode.AVAILABLE));

      const replacement = deferred<Candidate>();
      clearMultipartUploadCandidateLookupCache();
      mockFindMultipartUploadCandidateAction.mockReturnValueOnce(replacement.promise);
      if (identity === 'session') {
        rememberSession(fileId, randomTestId('replacement-upload'));
      }
      const previousCommitCount = committedStates.length;
      rerender({
        entityId: identity === 'entity' ? randomTestUuid() : releaseId,
        options: {
          ...probeOptions,
          ...(identity === 'attempt' ? { attemptId: randomTestUuid() } : {}),
          ...(identity === 'slot' ? { slotId: randomTestId('slot') } : {}),
          ...(identity === 'current file' ? { expectedCurrentFileId: randomTestUuid() } : {}),
        },
      });
      expect(committedStates[previousCommitCount]).toEqual({
        code: UploadResumeStateCode.LOOKUP_PENDING,
        resumeNotice: null,
        hasActiveSession: false,
      });
      await act(async () => replacement.resolve(null));
      expect(result.current.code).toBe(UploadResumeStateCode.MISSING_SESSION);
    },
  );

  it.each(['success', 'error'] as const)(
    'ignores a late %s after the pending file identity changes',
    async (outcome) => {
      const fileId = probeOptions.pendingFileId!;
      const uploadId = randomTestId('upload');
      const nextFileId = randomTestUuid();
      const nextUploadId = randomTestId('upload');
      rememberSession(fileId, uploadId);
      rememberSession(nextFileId, nextUploadId);
      const previous = deferred<Candidate>();
      const next = deferred<Candidate>();
      mockFindMultipartUploadCandidateAction.mockReturnValueOnce(previous.promise).mockReturnValueOnce(next.promise);
      const { result, rerender } = renderProbe();
      rerender({ entityId: releaseId, options: { pendingFileId: nextFileId, hasDurableSource: false } });

      expect(result.current.code).toBe(UploadResumeStateCode.LOOKUP_PENDING);
      await act(async () => next.resolve(candidate(nextFileId, nextUploadId)));
      expect(result.current.resumeNotice?.fileId).toBe(nextFileId);
      await act(async () => {
        if (outcome === 'error') {
          previous.reject(new Error('obsolete lookup'));
        } else {
          previous.resolve(candidate(fileId, uploadId));
        }
      });
      expect(result.current.code).toBe(UploadResumeStateCode.AVAILABLE);
      expect(result.current.resumeNotice?.fileId).toBe(nextFileId);
    },
  );

  it.each(['success', 'error'] as const)(
    'detaches a pending lookup on unmount without disposing its session (%s)',
    async (outcome) => {
      const fileId = probeOptions.pendingFileId!;
      const uploadId = randomTestId('upload');
      rememberSession(fileId, uploadId);
      const lookup = deferred<Candidate>();
      mockFindMultipartUploadCandidateAction.mockReturnValueOnce(lookup.promise);
      const { unmount } = renderProbe();
      unmount();

      await act(async () => {
        if (outcome === 'error') {
          lookup.reject(new Error('detached lookup'));
        } else {
          lookup.resolve(candidate(fileId, uploadId));
        }
      });
      expect(readUploadSession(fileId)).toMatchObject({ fileId, uploadId });

      probeOptions = { pendingFileId: randomTestUuid() };
      const { result } = renderProbe();
      expect(result.current.code).toBe(UploadResumeStateCode.MISSING_SESSION);
      expect(result.current.resumeNotice).toBeNull();
    },
  );

  it('reports a missing resumable session without clearing pending identity locally', async () => {
    mockFindMultipartUploadCandidateAction.mockResolvedValue(null);

    const { result } = renderProbe();

    await waitFor(() =>
      expect(result.current).toEqual({
        code: UploadResumeStateCode.MISSING_SESSION,
        resumeNotice: null,
        hasActiveSession: false,
      }),
    );
  });

  it('keeps an active resumable session instead of clearing it', async () => {
    const uploadId = randomTestId('upload');
    rememberSession(probeOptions.pendingFileId!, uploadId);

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

    const { result } = renderProbe();

    await waitFor(() =>
      expect(result.current).toEqual({
        code: UploadResumeStateCode.AVAILABLE,
        resumeNotice: {
          uploadId,
          fileId: probeOptions.pendingFileId,
          fileName: 'track.ogg',
          attemptId: undefined,
          status: UploadSessionStatus.UPLOADING,
        },
        hasActiveSession: true,
      }),
    );
  });

  it('ignores a single-part upload session because it is not resumable', async () => {
    const uploadId = randomTestId('upload');
    rememberSession(probeOptions.pendingFileId!, uploadId);
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

    const { result } = renderProbe();

    await waitFor(() =>
      expect(result.current).toEqual({
        code: UploadResumeStateCode.MISSING_SESSION,
        resumeNotice: null,
        hasActiveSession: false,
      }),
    );
  });

  it('keeps a stale single-part FINALIZING session available for authoritative completion recovery', async () => {
    const uploadId = randomTestId('upload');
    rememberSession(probeOptions.pendingFileId!, uploadId);

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

    const { result } = renderProbe();

    await waitFor(() =>
      expect(result.current).toEqual({
        code: UploadResumeStateCode.AVAILABLE,
        resumeNotice: {
          uploadId,
          fileId: probeOptions.pendingFileId,
          fileName: 'track.ogg',
          attemptId: undefined,
          status: UploadSessionStatus.FINALIZING,
        },
        hasActiveSession: true,
      }),
    );
  });

  it('still ignores a stale UPLOADING session outside the resume window', async () => {
    const uploadId = randomTestId('upload');
    rememberSession(probeOptions.pendingFileId!, uploadId);
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

    const { result } = renderProbe();

    await waitFor(() =>
      expect(result.current).toEqual({
        code: UploadResumeStateCode.MISSING_SESSION,
        resumeNotice: null,
        hasActiveSession: false,
      }),
    );
  });

  it('keeps pending upload identity when candidate lookup fails transiently', async () => {
    rememberSession(probeOptions.pendingFileId!, randomTestId('upload'));
    mockFindMultipartUploadCandidateAction.mockRejectedValue(new Error('temporary failure'));

    const { result } = renderProbe();

    await waitFor(() =>
      expect(result.current).toEqual({
        code: UploadResumeStateCode.LOOKUP_ERROR,
        resumeNotice: null,
        hasActiveSession: false,
      }),
    );
  });

  it('does not query the server when only slot identity exists', async () => {
    probeOptions = {
      slotId: randomTestId('slot-audio'),
    };
    mockFindMultipartUploadCandidateAction.mockResolvedValue(null);

    const { result } = renderProbe();

    expect(mockFindMultipartUploadCandidateAction).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(result.current).toEqual({
        code: UploadResumeStateCode.IDLE,
        resumeNotice: null,
        hasActiveSession: false,
      }),
    );
  });

  it('fails closed without an exact local file and upload identity', async () => {
    const slotId = randomTestId('slot-image');
    const attemptId = randomTestUuid();
    probeOptions = {
      slotId,
      attemptId,
    };

    const { result } = renderProbe();

    expect(mockFindMultipartUploadCandidateAction).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(result.current).toEqual({
        code: UploadResumeStateCode.MISSING_SESSION,
        resumeNotice: null,
        hasActiveSession: false,
      }),
    );
  });

  it('does not show a resume notice while any upload is active for the same slot', async () => {
    const key = buildUploadSurfaceKey({ uploadType: UploadType.TRACK_AUDIO, entityId: releaseId });
    markUploadSurfaceActive(key);
    activeSurfaceKeys.push(key);

    const { result } = renderProbe();

    expect(mockFindMultipartUploadCandidateAction).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(result.current).toEqual({
        code: UploadResumeStateCode.ACTIVE_SURFACE,
        resumeNotice: null,
        hasActiveSession: false,
      }),
    );
  });
});
