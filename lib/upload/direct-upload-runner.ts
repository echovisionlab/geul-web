import type {
  abortUploadAction,
  completeUploadAction,
  findMultipartUploadCandidateAction,
  initiateUploadAction,
  prepareClientMediaUploadAction,
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
import {
  getInitialUploadLifecycleStage,
  isResumableMultipartUpload,
  type UploadLifecycleStage,
} from '@/lib/utils/upload-runtime';
import { ClientMediaUnavailableError, type PreparedMedia } from '@/lib/media/client-processing/contracts';
import { FileDerivativeType, UploadType } from '@/lib/types/upload/model';
import { uploadClientMediaArtifact } from './client-media-transport';
import { UPLOAD_ABORTED_MESSAGE } from './failure';
import {
  UploadPausedError,
  type InFlightServerLifecycle,
  type UploadOptions,
  type UploadResult,
} from './file-upload-contract';
import { runMultipartUploadSession } from './multipart-session';
import { createUploadCorrelationId } from './remote-import';
import { completeUploadWithRecovery, UploadCompletionPolicyError } from './upload-completion-policy';
import {
  createUploadError,
  isRetryableUploadPartError,
  isClientMediaArtifactsMissingError,
  isClientMediaRestoreMismatchError,
} from './upload-errors';
import {
  disposePreparedSession,
  forgetUploadSession,
  restorePreparedSession,
  readDurablePreparedSession,
  rememberArtifactReceipt,
  clearArtifactReceipts,
  updatePreparedProgress,
  readUploadSession,
  rememberPreparedSession,
  rememberUploadSession,
} from './upload-session-store';
import {
  bindUploadProgressIdentity,
  clientMediaProcessingPercentage,
  clientMediaUploadPercentage,
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
  isPaused?: () => boolean;
  resetAborted: () => void;
  abortActiveUpload: () => void;
  registerPartAborter: (aborter: () => void) => () => void;
  clearPartAborters: () => void;
  setUploading: (uploading: boolean) => void;
  initiate: AsyncAction<typeof initiateUploadAction>;
  complete: AsyncAction<typeof completeUploadAction>;
  prepareBundle: AsyncAction<typeof prepareClientMediaUploadAction>;
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
  const normalizedError =
    isClientMediaRestoreMismatchError(error) ||
    error instanceof UploadCompletionPolicyError ||
    (error instanceof Error && 'code' in error && error.code === 'CLIENT_MEDIA_UNAVAILABLE')
      ? error
      : createUploadError(error);
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

const CLIENT_MEDIA_UPLOAD_TYPES = new Set<UploadType>([
  UploadType.EDITOR_ATTACHMENT,
  UploadType.EDITOR_AUDIO,
  UploadType.EDITOR_VIDEO,
  UploadType.TRACK_AUDIO,
  UploadType.GENERAL_FILE,
]);

function derivativeTypeForPath(path: string): FileDerivativeType {
  if (path.endsWith('.m3u8') || path.endsWith('.ts')) {
    return FileDerivativeType.HLS;
  }
  if (path === 'spectrogram.png') {
    return FileDerivativeType.SPECTROGRAM;
  }
  if (path === 'waveform.json') {
    return FileDerivativeType.WAVEFORM;
  }
  if (path === 'thumbnail.webp') {
    return FileDerivativeType.THUMBNAIL;
  }
  throw new Error(`Unsupported client media artifact: ${path}`);
}

class ResumeUnavailableError extends Error {
  constructor() {
    super('Prepared media is unavailable for this upload session. Start a new upload.');
    this.name = 'ClientMediaResumeUnavailableError';
  }
}

interface UploadState {
  prepared: PreparedMedia | null;
  cacheOwnsPrepared: boolean;
  ownedIdentity?: { fileId: string; uploadId: string };
  weightedProgress: boolean;
  totalBytes: number;
  completionStarted: boolean;
  completionRetryPending: boolean;
}

interface UploadContext {
  options: UploadOptions;
  operation: UploadOperation;
  runtime: DirectUploadRuntime;
  controller: AbortController;
  unregisterCancel: () => void;
  checkCancelled: () => void;
  emit: (stage: UploadLifecycleStage, percentage: number, loadedBytes?: number) => void;
}

type PreparedSource = Awaited<ReturnType<typeof prepareSource>>;
type OpenSession = Awaited<ReturnType<typeof openSession>>;

type RemoteSession =
  | Awaited<ReturnType<DirectUploadRuntime['initiate']>>
  | NonNullable<Awaited<ReturnType<DirectUploadRuntime['findCandidate']>>>;

function assertSession(
  session: RemoteSession | null | undefined,
  expected?: UploadOperation['resumeSession'],
): asserts session is RemoteSession {
  if (!session?.uploadId || !session.fileId) {
    throw new Error('The explicit multipart upload session is unavailable.');
  }
  if (expected && (session.fileId !== expected.fileId || session.uploadId !== expected.uploadId)) {
    throw new Error('The multipart upload session identity changed.');
  }
}

async function prepareSource(context: UploadContext, state: UploadState, file: File) {
  const { options, operation, runtime, controller, checkCancelled, emit } = context;
  const stored = operation.resumeSession ? readUploadSession(operation.resumeSession.fileId) : null;
  const durable = operation.resumeSession ? readDurablePreparedSession(operation.resumeSession.fileId) : null;
  if (operation.resumeSession && (stored?.clientMediaBundleId || durable)) {
    if (
      stored?.uploadId === operation.resumeSession.uploadId ||
      durable?.uploadId === operation.resumeSession.uploadId
    ) {
      state.ownedIdentity = operation.resumeSession;
    }
    const tracker = runtime.lifecycleTrackers.get(operation.correlationId);
    if (tracker) {
      tracker.clientMediaPrepared = true;
    }
    if (durable) {
      mergeUploadProgress(operation.progress, durable.progress);
      state.totalBytes = Math.max(file.size, operation.progress.loadedBytes);
      emit('validating', operation.progress.percentage);
    }
  }
  const cached = operation.resumeSession
    ? await restorePreparedSession(
        operation.resumeSession.fileId,
        operation.resumeSession.uploadId,
        file,
        options.uploadType,
        { signal: controller.signal },
      )
    : null;
  const { file: processedFile, mimeType } = await prepareUploadFile(cached?.source ?? file, options.uploadType);
  checkCancelled();
  if ((stored?.clientMediaBundleId || durable?.bundleId) && !cached) {
    state.ownedIdentity = operation.resumeSession;
    throw new ResumeUnavailableError();
  }
  const input = {
    uploadType: options.uploadType,
    ...operation.serverTarget,
    fileName: processedFile.name,
    fileSize: processedFile.size,
    mimeType,
    fileLastModified: processedFile.lastModified,
  };
  let resumeCandidate: Awaited<ReturnType<DirectUploadRuntime['findCandidate']>> | undefined;
  if (operation.resumeSession && !cached) {
    resumeCandidate = await runtime.findCandidate({ ...input, ...operation.resumeSession });
    assertSession(resumeCandidate, operation.resumeSession);
    state.ownedIdentity = { fileId: resumeCandidate.fileId, uploadId: resumeCandidate.uploadId };
    checkCancelled();
    if ('clientMediaBundleId' in resumeCandidate && resumeCandidate.clientMediaBundleId) {
      throw new ResumeUnavailableError();
    }
  }
  if (cached) {
    state.prepared = cached.prepared;
    state.cacheOwnsPrepared = true;
    mergeUploadProgress(operation.progress, cached.progress);
    cached.progress = operation.progress;
  } else if (CLIENT_MEDIA_UPLOAD_TYPES.has(options.uploadType) && /^(audio|video)\//.test(mimeType)) {
    const { prepareMedia } = await import('@/lib/media/client-processing/processor');
    checkCancelled();
    state.prepared = await prepareMedia(processedFile, {
      signal: controller.signal,
      onProgress: (progress) => {
        checkCancelled();
        emit('processing', clientMediaProcessingPercentage(progress));
      },
    });
    if (!state.prepared) {
      throw new ClientMediaUnavailableError(
        'This browser cannot prepare this media file. Use a supported browser or device.',
        'capability',
      );
    }
  }
  checkCancelled();
  state.weightedProgress = Boolean(state.prepared) || operation.progress.percentage > 0;
  if (state.prepared) {
    state.totalBytes = processedFile.size + state.prepared.artifacts.reduce((sum, artifact) => sum + artifact.size, 0);
    const tracker = runtime.lifecycleTrackers.get(operation.correlationId);
    if (tracker) {
      tracker.clientMediaPrepared = true;
    }
    if (!cached) {
      emit('processing', 40);
    }
  } else {
    state.totalBytes = processedFile.size;
    if (state.weightedProgress) {
      const tracker = runtime.lifecycleTrackers.get(operation.correlationId);
      if (tracker) {
        tracker.clientMediaPrepared = true;
      }
    }
  }
  if (!operation.resumeRequested || state.weightedProgress) {
    emit(getInitialUploadLifecycleStage(processedFile.size), operation.progress.percentage);
  } else {
    options.onLifecycle?.({
      correlationId: operation.correlationId,
      mode: 'upload',
      stage: getInitialUploadLifecycleStage(processedFile.size),
      totalBytes: state.totalBytes,
      source: 'local',
    });
  }

  return { processedFile, input, cached, resumeCandidate };
}

async function openSession(context: UploadContext, state: UploadState, source: PreparedSource) {
  const { options, operation, runtime, checkCancelled } = context;
  const { processedFile, input, cached, resumeCandidate } = source;
  checkCancelled();
  const initiated = operation.resumeSession
    ? resumeCandidate !== undefined
      ? resumeCandidate
      : await runtime.findCandidate({ ...input, ...operation.resumeSession })
    : await runtime.initiate(input);
  assertSession(initiated, operation.resumeSession);
  const { uploadId, fileId } = initiated;
  state.ownedIdentity = { fileId, uploadId };
  if (!runtime.isPaused?.()) {
    checkCancelled();
  }
  const activeSlotId = initiated.slotId || operation.surfaceSlotId || '';
  const activeAttemptId = initiated.attemptId || '';
  const resumed = Boolean(operation.resumeSession || ('resumed' in initiated && initiated.resumed));
  if (options.uploadType === UploadType.TRACK_AUDIO && activeAttemptId) {
    const nextSurfaceKey = buildUploadSurfaceKey({
      uploadType: options.uploadType,
      entityId: options.entityId ?? '',
      slotId: operation.surfaceSlotId,
      attemptId: activeAttemptId,
    });
    if (nextSurfaceKey !== operation.surfaceKey) {
      markUploadSurfaceActive(nextSurfaceKey, operation.activityId);
      updateUploadSurfaceLifecycle(
        nextSurfaceKey,
        { stage: 'uploading', progress: operation.progress.percentage },
        operation.activityId,
      );
      context.unregisterCancel();
      clearUploadSurfaceActive(operation.surfaceKey, operation.activityId);
      operation.surfaceKey = nextSurfaceKey;
      context.unregisterCancel = registerUploadSurfaceCancel(
        nextSurfaceKey,
        runtime.abortActiveUpload,
        operation.activityId,
      );
      const tracker = runtime.lifecycleTrackers.get(operation.correlationId);
      if (tracker) {
        tracker.uploadSurfaceKey = nextSurfaceKey;
      }
    }
  }
  const candidateBundleId = 'clientMediaBundleId' in initiated ? initiated.clientMediaBundleId : undefined;
  if (candidateBundleId && (!cached || candidateBundleId !== cached.bundleId)) {
    throw new ResumeUnavailableError();
  }
  if (resumed || state.weightedProgress) {
    bindUploadProgressIdentity(operation.progress, { attemptId: activeAttemptId, fileId, fallback: uploadId });
  } else {
    resetUploadProgress(operation.progress, { attemptId: activeAttemptId, fileId, fallback: uploadId });
  }
  rememberUploadSession({
    fileId,
    uploadId,
    ...(activeAttemptId ? { attemptId: activeAttemptId } : {}),
    ...(cached ? { clientMediaBundleId: cached.bundleId } : {}),
  });
  options.onMultipartSession?.({
    uploadId,
    fileId,
    slotId: activeSlotId || undefined,
    attemptId: activeAttemptId || undefined,
    resumed,
    resumable:
      Boolean(state.prepared) ||
      isResumableMultipartUpload({
        fileSize: processedFile.size,
        chunkSize: initiated.chunkSize,
        totalParts: initiated.totalParts,
      }),
  });

  return { initiated, activeSlotId, activeAttemptId, resumed };
}

async function bindBundle(
  context: UploadContext,
  state: UploadState,
  source: PreparedSource,
  session: OpenSession,
  file: File,
) {
  const { options, operation, runtime, checkCancelled } = context;
  const { cached } = source;
  const { fileId, uploadId } = session.initiated;
  const { activeAttemptId } = session;
  if (!runtime.isPaused?.()) {
    checkCancelled();
  }
  let bundleId = cached?.bundleId;
  if (state.prepared && !bundleId) {
    const plan = await runtime.prepareBundle({
      fileId,
      uploadId,
      kind: state.prepared.metadata.kind,
      durationSeconds: state.prepared.metadata.durationSeconds,
      artifacts: state.prepared.artifacts.map(({ path, mimeType: artifactMime, size, sha256 }) => ({
        path,
        mimeType: artifactMime,
        size,
        sha256,
        derivativeType: derivativeTypeForPath(path),
      })),
    });
    if (!plan.ok) {
      throw new Error(plan.error);
    }
    bundleId = plan.bundleId;
    if (!bundleId) {
      throw new Error('The client media upload bundle is unavailable.');
    }
    rememberPreparedSession(fileId, {
      source: file,
      uploadType: options.uploadType,
      uploadId,
      bundleId,
      prepared: state.prepared,
      progress: operation.progress,
    });
    state.cacheOwnsPrepared = true;
    rememberUploadSession({
      fileId,
      uploadId,
      ...(activeAttemptId ? { attemptId: activeAttemptId } : {}),
      clientMediaBundleId: bundleId,
    });
    checkCancelled();
  }
  return bundleId;
}

async function transferFiles(
  context: UploadContext,
  state: UploadState,
  source: PreparedSource,
  session: OpenSession,
  bundleId: string | undefined,
) {
  const { options, operation, runtime, controller, checkCancelled, emit } = context;
  const { processedFile, cached } = source;
  const { initiated } = session;
  const { fileId, uploadId } = initiated;
  let originalLoaded = 0;
  const artifactLoaded = new Map<string, number>();
  const emitTransfer = () => {
    const loaded = originalLoaded + Array.from(artifactLoaded.values()).reduce((sum, bytes) => sum + bytes, 0);
    emit(
      'uploading',
      state.weightedProgress
        ? clientMediaUploadPercentage(loaded, state.totalBytes)
        : Math.round((loaded / state.totalBytes) * 100),
      loaded,
    );
  };
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
    onProgress: ({ loadedBytes }) => {
      originalLoaded = Math.max(originalLoaded, loadedBytes);
      emitTransfer();
    },
  });
  checkCancelled();
  if (state.prepared && bundleId) {
    for (const artifact of state.prepared.artifacts) {
      checkCancelled();
      const cachedReceipt = cached?.receipts?.find(
        ({ path, sha256 }) => path === artifact.path && sha256 === artifact.sha256,
      );
      if (cachedReceipt && cached?.bundleId === bundleId) {
        artifactLoaded.set(artifact.path, artifact.size);
        emitTransfer();
        continue;
      }
      await uploadClientMediaArtifact({
        fileId,
        uploadId,
        bundleId,
        path: artifact.path,
        file: artifact.file,
        signal: controller.signal,
        onProgress: ({ loaded }) => {
          artifactLoaded.set(
            artifact.path,
            Math.max(artifactLoaded.get(artifact.path) ?? 0, Math.min(artifact.size, loaded)),
          );
          emitTransfer();
        },
      });
      rememberArtifactReceipt(fileId, { path: artifact.path, sha256: artifact.sha256 });
      artifactLoaded.set(artifact.path, artifact.size);
      emitTransfer();
    }
  }
  checkCancelled();
}

async function completeSession(
  context: UploadContext,
  state: UploadState,
  session: OpenSession,
  bundleId: string | undefined,
): Promise<UploadResult> {
  const { options, operation, runtime, emit, checkCancelled } = context;
  checkCancelled();
  const { fileId, uploadId } = session.initiated;
  const { activeSlotId, activeAttemptId } = session;
  const completionInput = {
    fileId,
    uploadId,
    uploadType: options.uploadType,
    correlationId: operation.correlationId,
    ...(bundleId ? { clientMediaBundleId: bundleId } : {}),
  };
  state.completionStarted = true;
  state.completionRetryPending = true;
  emit('finalizing', state.weightedProgress ? 99 : 100, state.totalBytes);
  const result = await completeUploadWithRecovery({
    identity: { uploadId, fileId },
    complete: () => runtime.complete(completionInput),
    findCandidate: () =>
      runtime.findCandidate({ uploadType: options.uploadType, ...operation.serverTarget, fileId, uploadId }),
    recoverCompleted: () => runtime.recoverCompleted(completionInput),
  });
  state.completionRetryPending = false;
  emit('completed', 100, state.totalBytes);
  runtime.lifecycleTrackers.delete(operation.correlationId);
  forgetUploadSession(fileId);
  if (state.cacheOwnsPrepared) {
    state.cacheOwnsPrepared = false;
    state.prepared = null;
    try {
      await disposePreparedSession(fileId);
    } catch {
      /* Commit already acknowledged; cleanup cannot undo it. */
    }
  }
  return {
    url: result.url,
    fileId: result.fileId,
    slotId: activeSlotId || undefined,
    attemptId: activeAttemptId || undefined,
  };
}

async function handleUploadFailure(context: UploadContext, state: UploadState, error: unknown): Promise<never> {
  const { options, operation, runtime, controller } = context;
  const paused = runtime.isPaused?.() === true;
  const cancelled = !paused && (runtime.isAborted() || controller.signal.aborted);
  if (paused) {
    runtime.lifecycleTrackers.delete(operation.correlationId);
    throw new UploadPausedError();
  }
  if (state.completionStarted && state.ownedIdentity && state.prepared && isClientMediaArtifactsMissingError(error)) {
    // A missing remote staging object must be re-sent; commit independently verifies every object.
    clearArtifactReceipts(state.ownedIdentity.fileId);
  }
  const hasHttpStatus = error instanceof Error && 'status' in error && typeof error.status === 'number';
  const resumeUnavailable = error instanceof ResumeUnavailableError;
  const terminal =
    resumeUnavailable ||
    (error instanceof UploadCompletionPolicyError && !error.retryable) ||
    (hasHttpStatus && !isRetryableUploadPartError(error));
  if ((cancelled || resumeUnavailable || (terminal && state.cacheOwnsPrepared)) && state.ownedIdentity) {
    try {
      await runtime.abort({ ...state.ownedIdentity, correlationId: operation.correlationId });
    } catch {
      /* Best effort server cleanup. */
    }
    forgetUploadSession(state.ownedIdentity.fileId);
  }
  if (state.completionStarted) {
    state.completionRetryPending = error instanceof UploadCompletionPolicyError && error.retryable;
  }
  if (state.ownedIdentity && (resumeUnavailable || (state.cacheOwnsPrepared && (cancelled || terminal)))) {
    try {
      await disposePreparedSession(state.ownedIdentity.fileId);
    } catch {
      /* Preserve the operation failure. */
    }
    state.cacheOwnsPrepared = false;
    state.prepared = null;
  }
  throw emitUploadFailure(
    cancelled ? createUploadError(UPLOAD_ABORTED_MESSAGE) : error,
    state.completionRetryPending,
    options,
    operation,
    runtime,
  );
}

async function disposeUncachedMedia(state: UploadState): Promise<void> {
  if (!state.prepared || state.cacheOwnsPrepared) {
    return;
  }
  try {
    await state.prepared.dispose();
  } catch {
    /* Disposal is best effort after a failed operation. */
  }
}

export async function runDirectFileUpload(
  file: File,
  options: UploadOptions,
  runtime: DirectUploadRuntime,
): Promise<UploadResult> {
  const operation = createUploadOperation(options);
  const controller = new AbortController();
  const state: UploadState = {
    prepared: null,
    cacheOwnsPrepared: false,
    weightedProgress: false,
    totalBytes: file.size,
    completionStarted: false,
    completionRetryPending: false,
  };
  const context: UploadContext = {
    options,
    operation,
    runtime,
    controller,
    unregisterCancel: startUploadOperation(file, options, operation, runtime),
    checkCancelled: () => {
      if (runtime.isAborted() || controller.signal.aborted) {
        throw createUploadError(UPLOAD_ABORTED_MESSAGE);
      }
    },
    emit: (stage, percentage, loadedBytes) => {
      if (!stage) {
        return;
      }
      mergeUploadProgress(operation.progress, { percentage, loadedBytes });
      if (state.ownedIdentity) {
        updatePreparedProgress(state.ownedIdentity.fileId, operation.progress);
      }
      updateUploadSurfaceLifecycle(
        operation.surfaceKey,
        { stage, progress: operation.progress.percentage },
        operation.activityId,
      );
      options.onProgress?.({
        loaded: operation.progress.loadedBytes,
        total: state.totalBytes,
        percentage: operation.progress.percentage,
        stage,
      });
      options.onLifecycle?.({
        correlationId: operation.correlationId,
        mode: 'upload',
        stage,
        percentage: operation.progress.percentage,
        loadedBytes: operation.progress.loadedBytes,
        totalBytes: state.totalBytes,
        fileId: operation.progress.fileId,
        source: 'local',
      });
    },
  };
  const unregisterPreparation = runtime.registerPartAborter(() => controller.abort());
  try {
    const source = await prepareSource(context, state, file);
    const session = await openSession(context, state, source);
    const bundleId = await bindBundle(context, state, source, session, file);
    await transferFiles(context, state, source, session, bundleId);
    return await completeSession(context, state, session, bundleId);
  } catch (error) {
    return await handleUploadFailure(context, state, error);
  } finally {
    unregisterPreparation();
    await disposeUncachedMedia(state);
    finishUploadOperation(operation, runtime, context.unregisterCancel);
  }
}
