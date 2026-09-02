// @vitest-environment jsdom

import { act } from 'react';
import { randomTestId, randomTestUuid } from '@echovisionlab/geul-common/test/random-id';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildUploadSurfaceKey,
  clearUploadSurfaceActive,
  markUploadSurfaceActive,
  registerUploadSurfaceCancel,
  updateUploadSurfaceLifecycle,
} from './uploadSurfaceActivity';
import { useUploadSurfaceController } from './useUploadSurfaceController';

const mockUseUploadResumeState = vi.fn((_uploadType: UploadType, _entityId: string | null, _options: unknown) => ({
  code: 'U-RESUME-IDLE',
  resumeNotice: null,
  hasActiveSession: false,
}));

vi.mock('@/lib/hooks/useUploadResumeNotice', () => ({
  useUploadResumeState: (uploadType: UploadType, entityId: string | null, options: unknown) =>
    mockUseUploadResumeState(uploadType, entityId, options),
}));

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let latestController: ReturnType<typeof useUploadSurfaceController> | null = null;
let activeSurfaceKeys: string[] = [];
let cancelUnsubscribers: Array<() => void> = [];

function renderProbe(options: Parameters<typeof useUploadSurfaceController>[0]) {
  function Probe() {
    latestController = useUploadSurfaceController(options);
    return null;
  }

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<Probe />);
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  cancelUnsubscribers.forEach((unsubscribe) => unsubscribe());
  activeSurfaceKeys.forEach((key) => clearUploadSurfaceActive(key));
  cancelUnsubscribers = [];
  activeSurfaceKeys = [];
  container?.remove();
  container = null;
  root = null;
  latestController = null;
  mockUseUploadResumeState.mockClear();
});

describe('useUploadSurfaceController', () => {
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

    renderProbe({
      uploadType: UploadType.EDITOR_AUDIO,
      entityId,
      resumeEntityId: null,
      surfaceSlotId: slotId,
      attemptId,
      hasDurableSource: false,
    });

    expect(mockUseUploadResumeState).toHaveBeenCalledWith(
      UploadType.EDITOR_AUDIO,
      null,
      expect.objectContaining({
        attemptId,
      }),
    );
    expect(latestController?.isActiveUpload).toBe(true);
    expect(latestController?.activeUploadLifecycle).toEqual({
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

    renderProbe({
      uploadType: UploadType.TRACK_AUDIO,
      entityId,
      slotId,
      attemptId,
      resumeEntityId: entityId,
    });

    expect(latestController?.canCancelActiveUpload).toBe(true);
    expect(latestController?.cancelActiveUpload()).toBe(true);
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

    renderProbe({
      uploadType: UploadType.EDITOR_VIDEO,
      entityId,
      surfaceSlotId: slotId,
      resumeEntityId: null,
    });

    expect(latestController?.activeUploadLifecycle?.progress).toBe(2);

    act(() => {
      markUploadSurfaceActive(surfaceKey, replacementActivityId);
      updateUploadSurfaceLifecycle(surfaceKey, { stage: 'uploading', progress: 99 }, firstActivityId);
      updateUploadSurfaceLifecycle(surfaceKey, { stage: 'validating', progress: 0 }, replacementActivityId);
    });

    expect(latestController?.isActiveUpload).toBe(true);
    expect(latestController?.activeUploadLifecycle).toEqual({
      stage: 'validating',
      progress: 0,
    });
  });
});
