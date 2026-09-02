'use client';

import { useCallback, useMemo } from 'react';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import {
  buildUploadSurfaceKey,
  cancelUploadSurface,
  useCanCancelUploadSurface,
  useIsUploadSurfaceActive,
  useUploadSurfaceLifecycle,
} from '@/lib/hooks/uploadSurfaceActivity';
import { useUploadResumeState } from '@/lib/hooks/useUploadResumeNotice';

interface UseUploadSurfaceControllerOptions {
  uploadType: UploadType;
  entityId?: string | null;
  resumeEntityId?: string | null;
  entityType?: TranscodeEntityType;
  slotId?: string | null;
  expectedCurrentFileId?: string | null;
  surfaceSlotId?: string | null;
  attemptId?: string | null;
  fileId?: string | null;
  pendingFileId?: string | null;
  hasDurableSource?: boolean;
}

export function useUploadSurfaceController({
  uploadType,
  entityId,
  resumeEntityId = entityId,
  entityType,
  slotId,
  expectedCurrentFileId,
  surfaceSlotId = slotId,
  attemptId,
  fileId,
  pendingFileId,
  hasDurableSource = false,
}: UseUploadSurfaceControllerOptions) {
  const surfaceEntityId = entityId || '';
  const surfaceKey = useMemo(
    () =>
      buildUploadSurfaceKey({
        uploadType,
        entityId: surfaceEntityId,
        slotId: surfaceSlotId,
        attemptId,
      }),
    [attemptId, surfaceEntityId, surfaceSlotId, uploadType],
  );
  const resumeState = useUploadResumeState(uploadType, resumeEntityId || null, {
    entityType,
    ...(slotId ? { slotId } : {}),
    ...(expectedCurrentFileId ? { expectedCurrentFileId } : {}),
    ...(attemptId ? { attemptId } : {}),
    ...(fileId ? { fileId } : {}),
    ...(pendingFileId ? { pendingFileId } : {}),
    hasDurableSource,
  });
  const isActiveUpload = useIsUploadSurfaceActive(surfaceKey);
  const canCancelActiveUpload = useCanCancelUploadSurface(surfaceKey);
  const activeUploadLifecycle = useUploadSurfaceLifecycle(surfaceKey);

  const cancelActiveUpload = useCallback(() => {
    return cancelUploadSurface(surfaceKey);
  }, [surfaceKey]);

  return {
    surfaceKey,
    resumeState,
    resumeNotice: resumeState.resumeNotice,
    isActiveUpload,
    activeUploadLifecycle,
    canCancelActiveUpload,
    cancelActiveUpload,
  };
}
