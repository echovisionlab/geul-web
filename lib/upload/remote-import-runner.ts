import type { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import type { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import type { downloadFromUrlAction } from '@/lib/actions/file';
import {
  buildUploadSurfaceKey,
  clearUploadSurfaceActive,
  markUploadSurfaceActive,
  updateUploadSurfaceLifecycle,
} from '@/lib/hooks/uploadSurfaceActivity';
import type { DownloadFromUrlOptions, InFlightServerLifecycle, UploadResult } from './file-upload-contract';
import { createUploadCorrelationId, isRetryableRemoteImportFailure } from './remote-import';
import type { UploadAttemptProgress } from './upload-progress';

interface RemoteImportRuntime {
  canTrackServerLifecycle: boolean;
  lifecycleTrackers: Map<string, InFlightServerLifecycle>;
  download: (input: Parameters<typeof downloadFromUrlAction>[0]) => ReturnType<typeof downloadFromUrlAction>;
}

export async function runRemoteFileImport(
  uploadType: UploadType,
  entityId: string,
  url: string,
  entityType: TranscodeEntityType | undefined,
  options: DownloadFromUrlOptions | undefined,
  runtime: RemoteImportRuntime,
): Promise<UploadResult> {
  const correlationId = options?.correlationId ?? createUploadCorrelationId();
  const activityId = correlationId;
  const progress: UploadAttemptProgress = {
    identity: options?.attemptId || correlationId,
    attemptId: options?.attemptId || undefined,
    loadedBytes: 0,
    percentage: 0,
  };
  const surfaceKey = buildUploadSurfaceKey({
    uploadType,
    entityId,
    slotId: options?.surfaceSlotId ?? options?.slotId,
    attemptId: options?.attemptId,
  });
  markUploadSurfaceActive(surfaceKey, activityId);

  if (runtime.canTrackServerLifecycle) {
    runtime.lifecycleTrackers.set(correlationId, {
      onLifecycle: options?.onLifecycle,
      uploadSurfaceKey: surfaceKey,
      activityId,
      progress,
    });
  }

  options?.onLifecycle?.({
    correlationId,
    mode: 'embed',
    stage: 'validating',
    percentage: 0,
    source: 'local',
  });
  updateUploadSurfaceLifecycle(surfaceKey, { stage: 'validating', progress: 0 }, activityId);

  try {
    const result = await runtime.download({
      uploadType,
      entityId,
      url,
      entityType,
      correlationId,
      slotId: options?.slotId,
      expectedCurrentFileId: options?.expectedCurrentFileId,
    });
    options?.onLifecycle?.({
      correlationId,
      mode: 'embed',
      stage: 'completed',
      percentage: 100,
      fileId: result.fileId,
      source: 'local',
    });
    updateUploadSurfaceLifecycle(surfaceKey, { stage: 'completed', progress: 100 }, activityId);
    runtime.lifecycleTrackers.delete(correlationId);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Remote import failed';
    const stage = isRetryableRemoteImportFailure(error) ? 'finalizing' : 'failed';
    if (runtime.lifecycleTrackers.delete(correlationId)) {
      options?.onLifecycle?.({
        correlationId,
        mode: 'embed',
        stage,
        error: message,
        source: 'local',
      });
    }
    updateUploadSurfaceLifecycle(surfaceKey, { stage, progress: progress.percentage, error: message }, activityId);
    throw error;
  } finally {
    clearUploadSurfaceActive(surfaceKey, activityId);
  }
}
