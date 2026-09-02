import type {
  abortUploadAction,
  completeUploadAction,
  findMultipartUploadCandidateAction,
  initiateUploadAction,
  recoverCompletedUploadAction,
} from '@/lib/actions/file';
import {
  buildUploadSurfaceKey,
  clearUploadSurfaceActive,
  markUploadSurfaceActive,
  registerUploadSurfaceCancel,
  updateUploadSurfaceLifecycle,
} from '@/lib/hooks/uploadSurfaceActivity';
import { prepareUploadFile } from '@/lib/utils/upload-pipeline';
import { getInitialUploadLifecycleStage, isResumableMultipartUpload } from '@/lib/utils/upload-runtime';
import { UploadType } from '@/lib/types/upload/model';
import type { InFlightServerLifecycle, UploadOptions, UploadResult } from './file-upload-contract';
import { runMultipartUploadSession } from './multipart-session';
import { createUploadCorrelationId } from './remote-import';
import { completeUploadWithRecovery, UploadCompletionPolicyError } from './upload-completion-policy';
import { createUploadError } from './upload-errors';
import { forgetUploadSession, readUploadSession, rememberUploadSession } from './upload-session-store';
import {
  bindUploadProgressIdentity,
  mergeUploadProgress,
  resetUploadProgress,
  type UploadAttemptProgress,
} from './upload-progress';

type AsyncAction<TAction extends (...args: never[]) => unknown> = (
  input: Parameters<TAction>[0],
) => ReturnType<TAction>;

export interface DirectUploadRuntime {
  canTrackServerLifecycle: boolean;
  lifecycleTrackers: Map<string, InFlightServerLifecycle>;
  isAborted: () => boolean;
  resetAborted: () => void;
  abortActiveUpload: () => void;
  registerPartAborter: (aborter: () => void) => () => void;
  clearPartAborters: () => void;
  setUploading: (uploading: boolean) => void;
  initiate: AsyncAction<typeof initiateUploadAction>;
  complete: AsyncAction<typeof completeUploadAction>;
  abort: AsyncAction<typeof abortUploadAction>;
  findCandidate: AsyncAction<typeof findMultipartUploadCandidateAction>;
  recoverCompleted: AsyncAction<typeof recoverCompletedUploadAction>;
}

interface UploadOperation {
  correlationId: string;
  activityId: string;
  serverTarget: {
    entityId: string;
    entityType?: UploadOptions['entityType'];
    slotId?: string;
    expectedCurrentFileId?: string;
  };
  surfaceSlotId?: string;
  resumeSession?: { fileId: string; uploadId: string };
  resumeRequested: boolean;
  surfaceKey: string;
  progress: UploadAttemptProgress;
}

const UNTARGETED_EDITOR_UPLOAD_TYPES = new Set<UploadType>([
  UploadType.EDITOR_IMAGE,
  UploadType.EDITOR_VIDEO,
  UploadType.EDITOR_AUDIO,
  UploadType.EDITOR_ATTACHMENT,
  UploadType.EDITOR_MESH,
]);

function createServerUploadTarget(options: UploadOptions): UploadOperation['serverTarget'] {
  if (UNTARGETED_EDITOR_UPLOAD_TYPES.has(options.uploadType)) {
    return {
      entityId: '',
      entityType: undefined,
      slotId: undefined,
      expectedCurrentFileId: undefined,
    };
  }
  return {
    entityId: options.entityId ?? '',
    entityType: options.entityType,
    slotId: options.slotId,
    expectedCurrentFileId: options.expectedCurrentFileId,
  };
}

function createUploadOperation(options: UploadOptions): UploadOperation {
  const correlationId = options.correlationId ?? createUploadCorrelationId();
  const resumeSession = options.resumeSession;
  const storedSession = resumeSession ? readUploadSession(resumeSession.fileId) : null;
  const surfaceSlotId = options.slotId;
  const resumeRequested = Boolean(resumeSession);

  return {
    correlationId,
    activityId: correlationId,
    serverTarget: createServerUploadTarget(options),
    surfaceSlotId,
    resumeSession,
    resumeRequested,
    surfaceKey: buildUploadSurfaceKey({
      uploadType: options.uploadType,
      entityId: options.entityId ?? '',
      slotId: surfaceSlotId,
      attemptId: storedSession?.attemptId,
    }),
    progress: {
      identity: storedSession?.attemptId || resumeSession?.fileId || correlationId,
      attemptId: storedSession?.attemptId,
      fileId: resumeSession?.fileId,
      loadedBytes: 0,
      percentage: 0,
    },
  };
}

function startUploadOperation(
  file: File,
  options: UploadOptions,
  operation: UploadOperation,
  runtime: DirectUploadRuntime,
): () => void {
  runtime.resetAborted();
  runtime.setUploading(true);
  markUploadSurfaceActive(operation.surfaceKey, operation.activityId);
  const unregisterCancel = registerUploadSurfaceCancel(
    operation.surfaceKey,
    runtime.abortActiveUpload,
    operation.activityId,
  );

  if (!operation.resumeRequested) {
    options.onProgress?.({ loaded: 0, total: file.size, percentage: 0, stage: 'validating' });
  }
  options.onLifecycle?.({
    correlationId: operation.correlationId,
    mode: 'upload',
    stage: 'validating',
    percentage: operation.resumeRequested ? undefined : 0,
    loadedBytes: operation.resumeRequested ? undefined : 0,
    totalBytes: file.size,
    source: 'local',
  });
  if (!operation.resumeRequested) {
    updateUploadSurfaceLifecycle(operation.surfaceKey, { stage: 'validating', progress: 0 }, operation.activityId);
  }

  if (runtime.canTrackServerLifecycle) {
    runtime.lifecycleTrackers.set(operation.correlationId, {
      onLifecycle: options.onLifecycle,
      uploadSurfaceKey: operation.surfaceKey,
      activityId: operation.activityId,
      progress: operation.progress,
    });
  }

  return unregisterCancel;
}

function finishUploadOperation(
  operation: UploadOperation,
  runtime: DirectUploadRuntime,
  unregisterCancel: () => void,
): void {
  unregisterCancel();
  clearUploadSurfaceActive(operation.surfaceKey, operation.activityId);
  runtime.clearPartAborters();
  runtime.setUploading(false);
}

function emitUploadFailure(
  error: unknown,
  completionRetryPending: boolean,
  options: UploadOptions,
  operation: UploadOperation,
  runtime: DirectUploadRuntime,
): Error {
  const normalizedError = createUploadError(error);
  const lifecycleStage = completionRetryPending ? 'finalizing' : 'failed';
  updateUploadSurfaceLifecycle(
    operation.surfaceKey,
    {
      stage: lifecycleStage,
      progress: operation.progress.percentage,
      error: normalizedError.message,
    },
    operation.activityId,
  );
  options.onLifecycle?.({
    correlationId: operation.correlationId,
    mode: 'upload',
    stage: lifecycleStage,
    percentage: undefined,
    error: normalizedError.message,
    source: 'local',
  });
  runtime.lifecycleTrackers.delete(operation.correlationId);
  return normalizedError;
}

export async function runDirectFileUpload(
  file: File,
  options: UploadOptions,
  runtime: DirectUploadRuntime,
): Promise<UploadResult> {
  const operation = createUploadOperation(options);
  const unregisterCancel = startUploadOperation(file, options, operation, runtime);
  let completionRetryPending = false;

  try {
    const { file: processedFile, mimeType } = await prepareUploadFile(file, options.uploadType);
    const initialStage = getInitialUploadLifecycleStage(processedFile.size);
    options.onLifecycle?.({
      correlationId: operation.correlationId,
      mode: 'upload',
      stage: initialStage,
      percentage: operation.resumeRequested ? undefined : 0,
      loadedBytes: operation.resumeRequested ? undefined : 0,
      totalBytes: processedFile.size,
      source: 'local',
    });
    if (!operation.resumeRequested) {
      updateUploadSurfaceLifecycle(operation.surfaceKey, { stage: initialStage, progress: 0 }, operation.activityId);
    }

    const initiated = operation.resumeSession
      ? await runtime.findCandidate({
          uploadType: options.uploadType,
          ...operation.serverTarget,
          fileId: operation.resumeSession.fileId,
          uploadId: operation.resumeSession.uploadId,
          fileName: processedFile.name,
          fileSize: processedFile.size,
          mimeType,
          fileLastModified: processedFile.lastModified,
        })
      : await runtime.initiate({
          uploadType: options.uploadType,
          ...operation.serverTarget,
          fileSize: processedFile.size,
          mimeType,
          fileName: processedFile.name,
          fileLastModified: processedFile.lastModified,
        });
    if (!initiated?.uploadId || !initiated.fileId) {
      throw new Error('The explicit multipart upload session is unavailable.');
    }
    if (
      operation.resumeSession &&
      (initiated.fileId !== operation.resumeSession.fileId || initiated.uploadId !== operation.resumeSession.uploadId)
    ) {
      throw new Error('The multipart upload session identity changed.');
    }
    const uploadId = initiated.uploadId;
    const fileId = initiated.fileId;
    const activeSlotId = initiated.slotId || operation.surfaceSlotId || '';
    const activeAttemptId = initiated.attemptId || '';
    const resumed = Boolean(operation.resumeSession || ('resumed' in initiated && initiated.resumed));

    rememberUploadSession({
      fileId,
      uploadId,
      ...(activeAttemptId ? { attemptId: activeAttemptId } : {}),
    });

    if (resumed) {
      bindUploadProgressIdentity(operation.progress, {
        attemptId: activeAttemptId,
        fileId,
        fallback: uploadId,
      });
    } else {
      resetUploadProgress(operation.progress, {
        attemptId: activeAttemptId,
        fileId,
        fallback: uploadId,
      });
    }

    options.onMultipartSession?.({
      uploadId,
      fileId,
      slotId: activeSlotId || undefined,
      attemptId: activeAttemptId || undefined,
      resumed,
      resumable: isResumableMultipartUpload({
        fileSize: processedFile.size,
        chunkSize: initiated.chunkSize,
        totalParts: initiated.totalParts,
      }),
    });

    const completionInput = {
      fileId,
      uploadId,
      uploadType: options.uploadType,
      correlationId: operation.correlationId,
    };
    let completionStarted = false;

    try {
      await runMultipartUploadSession({
        uploadType: options.uploadType,
        file: processedFile,
        fileId,
        uploadId,
        chunkSize: initiated.chunkSize,
        totalParts: initiated.totalParts,
        uploadedParts: initiated.uploadedParts ?? [],
        correlationId: operation.correlationId,
        concurrency: options.concurrency ?? 3,
        isAborted: runtime.isAborted,
        registerAborter: runtime.registerPartAborter,
        onProgress: ({ loadedBytes, percentage, stage }) => {
          mergeUploadProgress(operation.progress, { loadedBytes, percentage });
          updateUploadSurfaceLifecycle(
            operation.surfaceKey,
            { stage, progress: operation.progress.percentage },
            operation.activityId,
          );
          options.onProgress?.({
            loaded: operation.progress.loadedBytes,
            total: processedFile.size,
            percentage: operation.progress.percentage,
            stage,
          });
          options.onLifecycle?.({
            correlationId: operation.correlationId,
            mode: 'upload',
            stage,
            percentage: operation.progress.percentage,
            loadedBytes: operation.progress.loadedBytes,
            totalBytes: processedFile.size,
            fileId,
            source: 'local',
          });
        },
      });

      completionStarted = true;
      completionRetryPending = true;
      mergeUploadProgress(operation.progress, { percentage: 100, loadedBytes: processedFile.size });
      options.onLifecycle?.({
        correlationId: operation.correlationId,
        mode: 'upload',
        stage: 'finalizing',
        percentage: operation.progress.percentage,
        loadedBytes: operation.progress.loadedBytes,
        totalBytes: processedFile.size,
        fileId,
        source: 'local',
      });
      updateUploadSurfaceLifecycle(
        operation.surfaceKey,
        { stage: 'finalizing', progress: operation.progress.percentage },
        operation.activityId,
      );

      const result = await completeUploadWithRecovery({
        identity: { uploadId, fileId },
        complete: () => runtime.complete(completionInput),
        findCandidate: () =>
          runtime.findCandidate({
            uploadType: options.uploadType,
            ...operation.serverTarget,
            fileId,
            uploadId,
          }),
        recoverCompleted: () => runtime.recoverCompleted(completionInput),
      });

      completionRetryPending = false;
      mergeUploadProgress(operation.progress, { percentage: 100, loadedBytes: processedFile.size });
      options.onLifecycle?.({
        correlationId: operation.correlationId,
        mode: 'upload',
        stage: 'completed',
        percentage: 100,
        loadedBytes: processedFile.size,
        totalBytes: processedFile.size,
        fileId: result.fileId,
        source: 'local',
      });
      updateUploadSurfaceLifecycle(operation.surfaceKey, { stage: 'completed', progress: 100 }, operation.activityId);
      runtime.lifecycleTrackers.delete(operation.correlationId);
      forgetUploadSession(fileId);

      return {
        url: result.url,
        fileId: result.fileId,
        slotId: activeSlotId || undefined,
        attemptId: activeAttemptId || undefined,
      };
    } catch (error) {
      if (runtime.isAborted()) {
        try {
          await runtime.abort({ fileId, uploadId, correlationId: operation.correlationId });
          forgetUploadSession(fileId);
        } catch {
          // The local operation is already cancelled; server cleanup is best-effort.
        }
      }
      if (!completionStarted) {
        throw createUploadError(error);
      }
      completionRetryPending = error instanceof UploadCompletionPolicyError && error.retryable;
      throw error;
    }
  } catch (error) {
    throw emitUploadFailure(error, completionRetryPending, options, operation, runtime);
  } finally {
    finishUploadOperation(operation, runtime, unregisterCancel);
  }
}
