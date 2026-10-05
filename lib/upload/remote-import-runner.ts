import type { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import {
  buildUploadSurfaceKey,
  clearUploadSurfaceActive,
  markUploadSurfaceActive,
  registerUploadSurfaceCancel,
  updateUploadSurfaceLifecycle,
} from '@/lib/hooks/uploadSurfaceActivity';
import {
  UploadPausedError,
  type DownloadFromUrlOptions,
  type FileIngestLifecycleUpdate,
  type UploadOptions,
  type UploadResult,
} from './file-upload-contract';
import { UPLOAD_ABORTED_MESSAGE } from './failure';
import { checkAbort } from '@/lib/media/client-processing/contracts';
import { createUploadCorrelationId } from './remote-import';
import { downloadRemoteSource } from './remote-source';
import { readDurablePreparedSession, readPreparedSession, rememberPreparedSession } from './upload-session-store';

interface RemoteImportRuntime {
  upload: (file: File, options: UploadOptions) => Promise<UploadResult>;
  isAborted: () => boolean;
  isPaused: () => boolean;
  abortActiveUpload: () => void;
  registerPartAborter: (aborter: () => void) => () => void;
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
  const surfaceKey = buildUploadSurfaceKey({
    uploadType,
    entityId,
    slotId: options?.surfaceSlotId ?? options?.slotId,
    attemptId: options?.attemptId,
  });
  let activeSurfaceKey = surfaceKey;
  const controller = new AbortController();
  let percentage = 0;
  let uploadStarted = false;
  let sourceTransferred = false;
  let multipartSession = options?.resumeSession;
  let source: Awaited<ReturnType<typeof downloadRemoteSource>> | undefined;
  const emit = (update: FileIngestLifecycleUpdate) => {
    percentage = Math.max(percentage, update.percentage ?? percentage);
    const embedded = { ...update, correlationId, mode: 'embed' as const, percentage };
    options?.onLifecycle?.(embedded);
    updateUploadSurfaceLifecycle(
      activeSurfaceKey,
      { stage: embedded.stage, progress: percentage, error: embedded.error },
      correlationId,
    );
  };
  const checkCancelled = () => {
    if (runtime.isAborted() || controller.signal.aborted) {
      throw runtime.isPaused() ? new UploadPausedError() : new Error(UPLOAD_ABORTED_MESSAGE);
    }
  };
  const uploadOptions: UploadOptions = {
    uploadType,
    entityId,
    entityType,
    correlationId,
    slotId: options?.slotId,
    surfaceSlotId: options?.surfaceSlotId,
    attemptId: options?.attemptId,
    expectedCurrentFileId: options?.expectedCurrentFileId,
    resumeSession: options?.resumeSession,
    onMultipartSession: (session) => {
      multipartSession = session;
      if (uploadType === UploadType.TRACK_AUDIO && session.attemptId) {
        activeSurfaceKey = buildUploadSurfaceKey({
          uploadType,
          entityId,
          slotId: options?.surfaceSlotId ?? options?.slotId,
          attemptId: session.attemptId,
        });
      }
      options?.onMultipartSession?.(session);
    },
    onLifecycle: (update) =>
      emit({ ...update, percentage: update.percentage === undefined ? undefined : 20 + update.percentage * 0.8 }),
  };
  markUploadSurfaceActive(surfaceKey, correlationId);
  const unregisterCancel = registerUploadSurfaceCancel(surfaceKey, runtime.abortActiveUpload, correlationId);
  const unregisterDownload = runtime.registerPartAborter(() => controller.abort());
  try {
    checkCancelled();
    emit({ correlationId, mode: 'embed', stage: 'downloading', percentage: 0, source: 'local' });
    const retained = options?.resumeSession ? readDurablePreparedSession(options.resumeSession.fileId) : null;
    let sourceFile: File | undefined;
    if (
      retained?.sourceStorageId &&
      retained.uploadId === options?.resumeSession?.uploadId &&
      retained.uploadType === uploadType
    ) {
      try {
        const root = await navigator.storage.getDirectory();
        checkAbort(controller.signal);
        const directory = await root.getDirectoryHandle(retained.sourceStorageId);
        checkAbort(controller.signal);
        const handle = await directory.getFileHandle('source');
        checkAbort(controller.signal);
        const storedFile = await handle.getFile();
        checkAbort(controller.signal);
        if (storedFile.size !== retained.source.size) {
          throw new Error('Retained remote upload source size changed in storage.');
        }
        sourceFile = new File([storedFile], retained.source.name, {
          type: retained.source.type,
          lastModified: retained.source.lastModified,
        });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'NotFoundError')) {
          throw error;
        }
      }
    }
    if (!sourceFile) {
      source = await downloadRemoteSource(url, uploadOptions, controller.signal, (loadedBytes, totalBytes) => {
        emit({
          correlationId,
          mode: 'embed',
          stage: 'downloading',
          percentage: totalBytes ? Math.min(20, (loadedBytes / totalBytes) * 20) : 0,
          loadedBytes,
          totalBytes,
          source: 'local',
        });
      });
      sourceFile = source.file;
    } else {
      emit({
        correlationId,
        mode: 'embed',
        stage: 'downloading',
        percentage: 20,
        loadedBytes: sourceFile.size,
        totalBytes: sourceFile.size,
        source: 'local',
      });
    }
    checkCancelled();
    unregisterDownload();
    uploadStarted = true;
    const result = await runtime.upload(sourceFile, uploadOptions);
    return result;
  } catch (error) {
    if (!uploadStarted) {
      emit({
        correlationId,
        mode: 'embed',
        stage: 'failed',
        error: runtime.isAborted()
          ? UPLOAD_ABORTED_MESSAGE
          : error instanceof Error
            ? error.message
            : 'Remote import failed',
        source: 'local',
      });
      checkCancelled();
    }
    if (source && multipartSession) {
      const resident = readPreparedSession(multipartSession.fileId, multipartSession.uploadId, source.file, uploadType);
      if (resident && !resident.sourceStorageId) {
        resident.sourceStorageId = source.storageId;
        rememberPreparedSession(multipartSession.fileId, resident);
        sourceTransferred = true;
      }
    }
    throw error;
  } finally {
    unregisterDownload();
    unregisterCancel();
    clearUploadSurfaceActive(surfaceKey, correlationId);
    if (!sourceTransferred) {
      await source?.dispose();
    }
  }
}
