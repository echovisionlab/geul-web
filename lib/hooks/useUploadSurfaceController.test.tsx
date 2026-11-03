// @vitest-environment jsdom

import { randomTestId, randomTestUuid } from '@echovisionlab/geul-common/test/random-id';
import { UploadSessionStatus, UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploadResumeStateCode } from '@/lib/upload/resume-state';
import { forgetUploadSession, readUploadSession, rememberUploadSession } from '@/lib/upload/upload-session-store';
import { clearMultipartUploadCandidateLookupCache } from '@/lib/utils/upload-resume-candidate';
import { act, renderHook } from '@/test/render';
import {
  buildUploadSurfaceKey,
  clearUploadSurfaceActive,
  markUploadSurfaceActive,
  registerUploadSurfaceCancel,
  updateUploadSurfaceLifecycle,
} from './uploadSurfaceActivity';
import { useUploadSurfaceController } from './useUploadSurfaceController';

const mockFindMultipartUploadCandidateAction = vi.fn();
vi.mock('@/lib/actions/file', () => ({
  findMultipartUploadCandidateAction: (...args: unknown[]) => mockFindMultipartUploadCandidateAction(...args),
}));

let activeSurfaceKeys: string[] = [];
let cancelUnsubscribers: Array<() => void> = [];
const rememberedFileIds: string[] = [];

function renderProbe(options: Parameters<typeof useUploadSurfaceController>[0]) {
  return renderHook((props) => useUploadSurfaceController(props), { initialProps: options });
}

afterEach(() => {
  cancelUnsubscribers.forEach((unsubscribe) => unsubscribe());
  activeSurfaceKeys.forEach((key) => clearUploadSurfaceActive(key));
  cancelUnsubscribers = [];
  activeSurfaceKeys = [];
  rememberedFileIds.splice(0).forEach(forgetUploadSession);
  clearMultipartUploadCandidateLookupCache();
  mockFindMultipartUploadCandidateAction.mockReset();
  window.sessionStorage.clear();
});

describe('useUploadSurfaceController', () => {
  it.each(['available', 'absent', 'error'] as const)(
    'forwards pending lookup and its %s result from the real resume hook',
    async (outcome) => {
      const fileId = randomTestUuid();
      const uploadId = randomTestId('upload');
      rememberUploadSession({ fileId, uploadId });
      rememberedFileIds.push(fileId);
      let resolve!: (value: unknown) => void;
      let reject!: (error: Error) => void;
      mockFindMultipartUploadCandidateAction.mockReturnValue(
        new Promise((res, rej) => {
          resolve = res;
          reject = rej;
        }),
      );
      const { result } = renderProbe({
        uploadType: UploadType.TRACK_AUDIO,
        entityId: randomTestUuid(),
        pendingFileId: fileId,
      });

      expect(result.current.isResumeLookupPending).toBe(true);
      expect(result.current.resumeStateCode).toBe(UploadResumeStateCode.LOOKUP_PENDING);
      expect(result.current.resumeNotice).toBeNull();
      expect(result.current.isActiveUpload).toBe(false);

      await act(async () => {
        if (outcome === 'error') {
          reject(new Error('lookup failed'));
        } else {
          resolve(
            outcome === 'available'
              ? {
                  fileId,
                  uploadId,
                  fileName: 'track.ogg',
                  status: UploadSessionStatus.FINALIZING,
                }
              : null,
          );
        }
      });

      expect(result.current.isResumeLookupPending).toBe(false);
      expect(result.current.resumeStateCode).toBe(
        {
          available: UploadResumeStateCode.AVAILABLE,
          absent: UploadResumeStateCode.MISSING_SESSION,
          error: UploadResumeStateCode.LOOKUP_ERROR,
        }[outcome],
      );
      expect(result.current.resumeStateCode).toBe(result.current.resumeState.code);
      expect(result.current.resumeNotice?.fileId ?? null).toBe(outcome === 'available' ? fileId : null);
      expect(result.current.resumeNotice?.status ?? null).toBe(
        outcome === 'available' ? UploadSessionStatus.FINALIZING : null,
      );
      expect(readUploadSession(fileId)).toMatchObject({ fileId, uploadId });
    },
  );

  it('retains active transfer and cancellation ownership after a pending lookup is detached', async () => {
    const entityId = randomTestUuid();
    const fileId = randomTestUuid();
    const uploadId = randomTestId('upload');
    rememberUploadSession({ fileId, uploadId });
    rememberedFileIds.push(fileId);
    let reject!: (error: Error) => void;
    mockFindMultipartUploadCandidateAction.mockReturnValue(
      new Promise((_res, rej) => {
        reject = rej;
      }),
    );
    const options = { uploadType: UploadType.TRACK_AUDIO, entityId, pendingFileId: fileId };
    const { result, unmount } = renderProbe(options);
    expect(result.current.isResumeLookupPending).toBe(true);
    const key = result.current.surfaceKey;
    const cancel = vi.fn();

    act(() => {
      markUploadSurfaceActive(key);
      activeSurfaceKeys.push(key);
      updateUploadSurfaceLifecycle(key, { stage: 'uploading', progress: 41 });
      cancelUnsubscribers.push(registerUploadSurfaceCancel(key, cancel));
    });
    await act(async () => reject(new Error('obsolete lookup')));

    expect(result.current.resumeStateCode).toBe(UploadResumeStateCode.ACTIVE_SURFACE);
    expect(result.current.isResumeLookupPending).toBe(false);
    expect(result.current.activeUploadLifecycle).toMatchObject({ stage: 'uploading', progress: 41 });
    unmount();
    expect(cancel).not.toHaveBeenCalled();
    expect(readUploadSession(fileId)).toMatchObject({ fileId, uploadId });

    const remounted = renderProbe(options);
    expect(remounted.result.current.isActiveUpload).toBe(true);
    expect(remounted.result.current.canCancelActiveUpload).toBe(true);
    expect(remounted.result.current.activeUploadLifecycle?.progress).toBe(41);
  });

  it('keeps active upload surface identity separate from resume lookup identity', () => {
    const entityId = randomTestUuid();
    const slotId = randomTestId('slot');
    const attemptId = randomTestUuid();
    const surfaceKey = buildUploadSurfaceKey({
      uploadType: UploadType.EDITOR_AUDIO,
      entityId,
      slotId,
      attemptId,
    });
    markUploadSurfaceActive(surfaceKey);
    activeSurfaceKeys.push(surfaceKey);
    updateUploadSurfaceLifecycle(surfaceKey, {
      stage: 'uploading',
      progress: 41,
    });

    const { result } = renderProbe({
      uploadType: UploadType.EDITOR_AUDIO,
      entityId,
      resumeEntityId: null,
      surfaceSlotId: slotId,
      attemptId,
      hasDurableSource: false,
    });

    expect(mockFindMultipartUploadCandidateAction).not.toHaveBeenCalled();
    expect(result.current.resumeState.code).toBe(UploadResumeStateCode.IDLE);
    expect(result.current.isActiveUpload).toBe(true);
    expect(result.current.activeUploadLifecycle).toEqual({
      stage: 'uploading',
      progress: 41,
    });
  });

  it('exposes the registered surface canceler for the exact upload identity', () => {
    const entityId = randomTestUuid();
    const slotId = randomTestId('slot');
    const attemptId = randomTestUuid();
    const cancel = vi.fn();
    const surfaceKey = buildUploadSurfaceKey({
      uploadType: UploadType.TRACK_AUDIO,
      entityId,
      slotId,
      attemptId,
    });
    markUploadSurfaceActive(surfaceKey);
    activeSurfaceKeys.push(surfaceKey);
    cancelUnsubscribers.push(registerUploadSurfaceCancel(surfaceKey, cancel));

    const { result } = renderProbe({
      uploadType: UploadType.TRACK_AUDIO,
      entityId,
      slotId,
      attemptId,
      resumeEntityId: entityId,
    });

    expect(result.current.canCancelActiveUpload).toBe(true);
    expect(result.current.cancelActiveUpload()).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('keeps one attempt monotonic and ignores stale updates after a new attempt resets the surface', () => {
    const entityId = randomTestUuid();
    const slotId = randomTestId('slot');
    const surfaceKey = buildUploadSurfaceKey({
      uploadType: UploadType.EDITOR_VIDEO,
      entityId,
      slotId,
    });
    const firstActivityId = randomTestId('activity');
    const replacementActivityId = randomTestId('activity');
    markUploadSurfaceActive(surfaceKey, firstActivityId);
    activeSurfaceKeys.push(surfaceKey);
    updateUploadSurfaceLifecycle(surfaceKey, { stage: 'uploading', progress: 1 }, firstActivityId);
    updateUploadSurfaceLifecycle(surfaceKey, { stage: 'uploading', progress: 2 }, firstActivityId);
    updateUploadSurfaceLifecycle(surfaceKey, { stage: 'uploading', progress: 1 }, firstActivityId);

    const { result } = renderProbe({
      uploadType: UploadType.EDITOR_VIDEO,
      entityId,
      surfaceSlotId: slotId,
      resumeEntityId: null,
    });

    expect(result.current.activeUploadLifecycle?.progress).toBe(2);

    act(() => {
      markUploadSurfaceActive(surfaceKey, replacementActivityId);
      updateUploadSurfaceLifecycle(surfaceKey, { stage: 'uploading', progress: 99 }, firstActivityId);
      updateUploadSurfaceLifecycle(surfaceKey, { stage: 'validating', progress: 0 }, replacementActivityId);
    });

    expect(result.current.isActiveUpload).toBe(true);
    expect(result.current.activeUploadLifecycle).toEqual({
      stage: 'validating',
      progress: 0,
    });
  });
});
