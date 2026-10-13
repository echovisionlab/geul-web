'use client';

import type { StatusBadgeTone } from '@/components/core/Badge';

import { Text as DsText } from '@/components/core/Typography';
import { LayoutInline as DsLayoutInline, LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { UploadSessionStatus } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { IconCheck, IconPlayerStop, IconTriangle, IconUpload, IconX } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Spinner as Loader } from '@/components/core/Display';
import { notifications } from '@/components/core/Notification';
import { IconButton } from '@/components/core/IconButton';
import { FilePicker } from '@/components/core/Input';
import { Tooltip } from '@/components/core/Tooltip';
import { isClientMediaRestoreMismatchError } from '@/lib/upload/upload-errors';
import { UploadPausedError } from '@/lib/upload/file-upload-contract';
import { abortUploadAction, findMultipartUploadCandidateAction } from '@/lib/actions/file';
import {
  UPLOAD_ABORTED_MESSAGE,
  UPLOAD_FAILED_MESSAGE,
  UPLOAD_FINALIZATION_FAILED_MESSAGE,
  UPLOAD_INTERRUPTED_MESSAGE,
  useFileUpload,
} from '@/lib/hooks/useFileUpload';
import type { UploadResumeState } from '@/lib/hooks/useUploadResumeNotice';
import { useUploadSurfaceController } from '@/lib/hooks/useUploadSurfaceController';
import { resolveMediaLifecycleDisplay, resolveMediaStatusDisplay, type MediaStatusLabels } from '@/lib/media/status';
import { UploadType } from '@/lib/types/upload/model';
import { isRecoverableUploadFailure, resolveUploadFailureCode } from '@/lib/upload/failure';
import { isUploadResumeSuppressed, type UploadResumeSuppressionIdentity } from '@/lib/upload/resume-suppression';
import { readUploadSession, disposePreparedSession, forgetUploadSession } from '@/lib/upload/upload-session-store';
import { createClientLogger } from '@/lib/utils/client-logger';
import {
  RELEASE_TRACK_PROCESSING_STATUS,
  type ReleaseTrackProcessingStatus,
} from './ReleaseEditor/track-processing-status';
import { isTrackAudioUploadFinalizing } from './track-audio-upload-policy';

const logger = createClientLogger('TrackAudioUploader');
const ACCEPT_TRACK_AUDIO = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.oga', '.m4a', '.aif', '.aiff'].join(',');
const TRACK_UPLOAD_RESUME_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const TRACK_PROCESSING_STATUS_PENDING = RELEASE_TRACK_PROCESSING_STATUS.pending;
const TRACK_PROCESSING_STATUS_PROCESSING = RELEASE_TRACK_PROCESSING_STATUS.processing;
const TRACK_PROCESSING_STATUS_COMPLETED = RELEASE_TRACK_PROCESSING_STATUS.completed;
const TRACK_PROCESSING_STATUS_FAILED = RELEASE_TRACK_PROCESSING_STATUS.failed;

type MediaStatusMessageKey =
  | 'statuses.uploading'
  | 'statuses.processing'
  | 'statuses.ready'
  | 'statuses.failed'
  | 'statuses.unknown'
  | 'statuses.stage.validating'
  | 'statuses.stage.uploading'
  | 'statuses.stage.downloading'
  | 'statuses.stage.finalizing'
  | 'statuses.stage.processing';

function createLocalizedMediaStatusLabels(tMedia: (key: MediaStatusMessageKey) => string): MediaStatusLabels {
  return {
    uploading: tMedia('statuses.uploading'),
    processing: tMedia('statuses.processing'),
    ready: tMedia('statuses.ready'),
    failed: tMedia('statuses.failed'),
    unknown: tMedia('statuses.unknown'),
    stage: {
      validating: tMedia('statuses.stage.validating'),
      uploading: tMedia('statuses.stage.uploading'),
      downloading: tMedia('statuses.stage.downloading'),
      finalizing: tMedia('statuses.stage.finalizing'),
      processing: tMedia('statuses.stage.processing'),
    },
  };
}

interface TrackAudioUploaderProps {
  trackId: string;
  audioOriginalFileId?: string | null;
  inputId?: string;
  processingStatus: ReleaseTrackProcessingStatus | null;
  processingActive?: boolean;
  processingProgress?: number | null;
  activeUploadState?: { active: boolean; progress: number; stage?: string | null } | null;
  audioAttached?: boolean;
  pendingUploadFileId?: string | null;
  pendingUploadAttemptId?: string | null;
  pendingUploadStatus?: 'pending' | 'expired' | null;
  pendingUploadStartedAt?: string | null;
  onUploadProgressChange?: (
    trackId: string,
    state: { active: boolean; progress: number; stage?: string | null },
  ) => void;
  onPendingUploadCancelled?: (identity: UploadResumeSuppressionIdentity) => void;
  suppressedResumeIdentity?: UploadResumeSuppressionIdentity | null;
  resumeStateOverride?: UploadResumeState | null;
  compact?: boolean;
  mode?: 'default' | 'status-only' | 'button-only';
}

export function TrackAudioUploader({
  trackId,
  audioOriginalFileId = '',
  inputId,
  processingStatus,
  processingActive = false,
  processingProgress = null,
  activeUploadState = null,
  audioAttached = false,
  pendingUploadFileId = '',
  pendingUploadAttemptId = '',
  pendingUploadStatus = undefined,
  pendingUploadStartedAt = undefined,
  onUploadProgressChange,
  onPendingUploadCancelled,
  suppressedResumeIdentity = null,
  resumeStateOverride = null,
  compact = false,
  mode = 'default',
}: TrackAudioUploaderProps) {
  const tCommon = useTranslations('common');
  const t = useTranslations('releaseEditor.tracks.audio');
  const tMedia = useTranslations('editorCommon.media');
  const tIngestDialog = useTranslations('editorCommon.media.ingestDialog');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<string | null>(null);
  const [isResumingCurrentUpload, setIsResumingCurrentUpload] = useState(false);
  const [isFinalizingUpload, setIsFinalizingUpload] = useState(false);
  const [isCompletionRetryPending, setIsCompletionRetryPending] = useState(false);
  const [localPendingUploadIdentity, setLocalPendingUploadIdentity] = useState<{
    fileId: string;
    attemptId: string;
  } | null>(null);
  const cancelRequestedRef = useRef(false);
  const lastReportedUploadProgressRef = useRef<string | null>(null);
  const activePendingAttemptRef = useRef(String(pendingUploadAttemptId || ''));
  const activePendingFileRef = useRef(String(pendingUploadFileId || ''));
  const activeUploadRunRef = useRef<symbol | null>(null);
  const isFinalizingOperationRef = useRef(false);
  const isCompletionRetryPendingRef = useRef(false);
  const suppressedResumeRef = useRef<{ attemptId?: string; fileId?: string } | null>(null);
  const pendingMultipartSessionRef = useRef<{ fileId: string; resumable: boolean } | null>(null);

  const { upload, abort, isUploading } = useFileUpload();
  const managesPendingState = mode !== 'status-only';
  const trackedPendingFileId = String(pendingUploadFileId || localPendingUploadIdentity?.fileId || '');
  const trackedPendingAttemptId = String(pendingUploadAttemptId || localPendingUploadIdentity?.attemptId || '');

  const hasTrackedPendingUpload = Boolean(
    trackedPendingFileId || trackedPendingAttemptId || pendingUploadStatus || pendingUploadStartedAt,
  );

  useEffect(() => {
    activePendingAttemptRef.current = trackedPendingAttemptId;
  }, [trackedPendingAttemptId]);
  useEffect(() => {
    activePendingFileRef.current = trackedPendingFileId;
  }, [trackedPendingFileId]);
  const pendingStartedAtMs = useMemo(() => {
    if (!pendingUploadStartedAt) {
      return null;
    }
    const parsed = Date.parse(pendingUploadStartedAt);
    return Number.isNaN(parsed) ? null : parsed;
  }, [pendingUploadStartedAt]);
  const isPendingExpiredByAge = Boolean(
    pendingUploadStatus === 'pending' &&
    pendingStartedAtMs != null &&
    Date.now() - pendingStartedAtMs >= TRACK_UPLOAD_RESUME_WINDOW_MS,
  );
  const isPendingExpired = pendingUploadStatus === 'expired' || isPendingExpiredByAge;

  const clearPendingUpload = useCallback((attemptId?: string) => {
    if (attemptId && activePendingAttemptRef.current && activePendingAttemptRef.current !== attemptId) {
      return;
    }
    activePendingAttemptRef.current = '';
    activePendingFileRef.current = '';
    setLocalPendingUploadIdentity((current) => {
      if (attemptId && current?.attemptId && current.attemptId !== attemptId) {
        return current;
      }
      return null;
    });
  }, []);

  const markPendingUpload = useCallback((fileId: string, attemptId: string) => {
    activePendingAttemptRef.current = attemptId;
    activePendingFileRef.current = fileId;
    setLocalPendingUploadIdentity({ fileId, attemptId });
  }, []);

  const internalUploadSurface = useUploadSurfaceController({
    uploadType: UploadType.TRACK_AUDIO,
    entityId: trackId,
    resumeEntityId:
      managesPendingState && !resumeStateOverride && (!audioAttached || hasTrackedPendingUpload) ? trackId : null,
    entityType: TranscodeEntityType.TRACK,
    expectedCurrentFileId: audioOriginalFileId || undefined,
    fileId: trackedPendingFileId || undefined,
    attemptId: trackedPendingAttemptId || undefined,
    pendingFileId: trackedPendingFileId || undefined,
    hasDurableSource: audioAttached,
  });
  const internalResumeState = internalUploadSurface.resumeState;
  const resumeState = resumeStateOverride ?? internalResumeState;
  const resumeNotice = resumeState.resumeNotice;
  const externalUploadActive = Boolean(activeUploadState?.active);
  const effectiveUploadProgress = externalUploadActive ? (activeUploadState?.progress ?? 0) : uploadProgress;
  const effectiveUploadStage = externalUploadActive ? (activeUploadState?.stage ?? null) : uploadStage;
  const isAnyUploadActive = isUploading || isFinalizingUpload || externalUploadActive;
  const isFinalizingOperation = isTrackAudioUploadFinalizing({
    lifecycleStage: effectiveUploadStage,
    sessionStatus: resumeNotice?.status,
    completionRetryPending: isCompletionRetryPending,
  });
  isFinalizingOperationRef.current = isFinalizingOperation;
  const isResumeNoticeSuppressed =
    isUploadResumeSuppressed(resumeNotice, suppressedResumeRef.current) ||
    isUploadResumeSuppressed(resumeNotice, suppressedResumeIdentity);

  useEffect(() => {
    if (!managesPendingState) {
      return;
    }
    const trackedAttemptId = trackedPendingAttemptId || activePendingAttemptRef.current;
    if (trackedPendingFileId || !resumeNotice?.fileId || audioAttached || isResumeNoticeSuppressed) {
      return;
    }
    if (trackedAttemptId && (!resumeNotice.attemptId || trackedAttemptId !== resumeNotice.attemptId)) {
      return;
    }

    markPendingUpload(resumeNotice.fileId, resumeNotice.attemptId || trackedPendingAttemptId || '');
  }, [
    audioAttached,
    markPendingUpload,
    trackedPendingAttemptId,
    trackedPendingFileId,
    resumeNotice?.attemptId,
    resumeNotice?.fileId,
    isResumeNoticeSuppressed,
    managesPendingState,
  ]);

  const resumeInstruction = useMemo(() => {
    if (isResumeNoticeSuppressed) {
      return null;
    }

    if (isPendingExpired) {
      return t('resumeExpired');
    }

    if (!resumeNotice) {
      return null;
    }

    return resumeNotice.fileName
      ? tIngestDialog('resumeInstructionNamed', { name: resumeNotice.fileName })
      : tIngestDialog('resumeAvailable');
  }, [isPendingExpired, isResumeNoticeSuppressed, resumeNotice, t, tIngestDialog]);
  const mediaStatusLabels = useMemo(() => createLocalizedMediaStatusLabels(tMedia), [tMedia]);
  const activeUploadDisplay = useMemo(
    () => resolveMediaLifecycleDisplay(effectiveUploadStage ?? 'uploading', effectiveUploadProgress, mediaStatusLabels),
    [effectiveUploadProgress, effectiveUploadStage, mediaStatusLabels],
  );
  const activeUploadLabel = activeUploadDisplay.label || tCommon('statuses.uploading');
  const activeLifecycleLabel = useMemo(() => {
    if (!audioAttached || !processingActive) {
      return null;
    }

    const display = resolveMediaStatusDisplay({
      status: 'processing',
      progress: processingProgress,
      labels: mediaStatusLabels,
    });

    return display.label || t('processing');
  }, [audioAttached, mediaStatusLabels, processingActive, processingProgress, t]);

  const setCompletionRetryPending = (pending: boolean) => {
    isCompletionRetryPendingRef.current = pending;
    setIsCompletionRetryPending(pending);
  };

  const cancelPendingUpload = useMutation({
    mutationFn: async () => {
      if (isFinalizingOperationRef.current) {
        return null;
      }

      const cancelAttemptId = activePendingAttemptRef.current;
      const cancelIdentity: UploadResumeSuppressionIdentity = {
        attemptId: cancelAttemptId || trackedPendingAttemptId || resumeNotice?.attemptId || undefined,
        fileId: activePendingFileRef.current || trackedPendingFileId || resumeNotice?.fileId || undefined,
      };
      if (isUploading) {
        cancelRequestedRef.current = true;
        abort();
        return cancelIdentity;
      }

      let didAbortRemoteSession = false;
      if (resumeNotice?.uploadId && resumeNotice.fileId) {
        await abortUploadAction({
          fileId: resumeNotice.fileId,
          uploadId: resumeNotice.uploadId,
        });
        didAbortRemoteSession = true;
      }

      const resumableFileId = activePendingFileRef.current || trackedPendingFileId || resumeNotice?.fileId;
      const resumableSession = resumableFileId ? readUploadSession(resumableFileId) : null;
      if (!didAbortRemoteSession && resumableSession) {
        const candidate = await findMultipartUploadCandidateAction({
          uploadType: UploadType.TRACK_AUDIO,
          entityId: trackId,
          entityType: TranscodeEntityType.TRACK,
          expectedCurrentFileId: audioOriginalFileId || undefined,
          fileId: resumableSession.fileId,
          uploadId: resumableSession.uploadId,
        });

        if (candidate?.uploadId && candidate.fileId) {
          await abortUploadAction({
            fileId: candidate.fileId,
            uploadId: candidate.uploadId,
          });
        }
      }

      if (resumableFileId) {
        await disposePreparedSession(resumableFileId);
        forgetUploadSession(resumableFileId);
      }
      const suppressedIdentity = {
        attemptId: cancelIdentity.attemptId || undefined,
        fileId: resumableFileId || cancelIdentity.fileId || undefined,
      };
      suppressedResumeRef.current = suppressedIdentity;
      clearPendingUpload(cancelAttemptId);
      return suppressedIdentity;
    },
    onSuccess: (identity) => {
      if (!identity) {
        return;
      }
      onPendingUploadCancelled?.(identity);
      if (!isUploading) {
        notifications.show({
          message: tCommon('statuses.cancelled'),
          tone: 'neutral',
        });
      }
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('messages.uploadFailed'),
        tone: 'danger',
      });
    },
  });

  const handleUpload = async (file: File) => {
    const activeUploadRun = Symbol('track-audio-upload');
    const resumeAttemptId = trackedPendingAttemptId || resumeNotice?.attemptId || '';
    const resumeFileId = trackedPendingFileId || resumeNotice?.fileId || '';
    const persistedResumeSession = resumeFileId ? readUploadSession(resumeFileId) : null;
    const resumeSession = resumeNotice
      ? { fileId: resumeNotice.fileId, uploadId: resumeNotice.uploadId }
      : persistedResumeSession
        ? { fileId: persistedResumeSession.fileId, uploadId: persistedResumeSession.uploadId }
        : undefined;
    const resumeRequested = Boolean(resumeSession);
    const retryingFinalization =
      isCompletionRetryPendingRef.current ||
      resumeNotice?.status === UploadSessionStatus.FINALIZING ||
      effectiveUploadStage === 'finalizing';
    let activeUploadAttemptId = resumeAttemptId;
    const isCurrentUploadRun = () => activeUploadRunRef.current === activeUploadRun;
    if (!resumeRequested) {
      setUploadProgress(0);
    }
    setUploadStage(null);
    setIsResumingCurrentUpload(false);
    setIsFinalizingUpload(false);
    setCompletionRetryPending(retryingFinalization);
    isFinalizingOperationRef.current = retryingFinalization;
    cancelRequestedRef.current = false;
    suppressedResumeRef.current = null;
    pendingMultipartSessionRef.current = null;
    activeUploadRunRef.current = activeUploadRun;
    activePendingAttemptRef.current = activeUploadAttemptId;
    activePendingFileRef.current = trackedPendingFileId || resumeNotice?.fileId || '';

    try {
      await upload(file, {
        uploadType: UploadType.TRACK_AUDIO,
        entityId: trackId,
        entityType: TranscodeEntityType.TRACK,
        expectedCurrentFileId: audioOriginalFileId || undefined,
        resumeSession,
        onMultipartSession: (session) => {
          const sessionAttemptId = session.attemptId || activeUploadAttemptId;
          if (!isCurrentUploadRun()) {
            return;
          }
          if (
            activePendingAttemptRef.current &&
            activePendingAttemptRef.current !== activeUploadAttemptId &&
            activePendingAttemptRef.current !== sessionAttemptId
          ) {
            return;
          }
          activeUploadAttemptId = sessionAttemptId;
          pendingMultipartSessionRef.current = {
            fileId: session.fileId,
            resumable: session.resumable,
          };
          setIsResumingCurrentUpload(session.resumed);
          if (session.resumable) {
            markPendingUpload(session.fileId, activeUploadAttemptId);
          }
        },
        onProgress: (progress) => {
          if (!isCurrentUploadRun()) {
            return;
          }
          if (progress.stage !== 'finalizing') {
            setIsFinalizingUpload(false);
          }
          setUploadProgress(progress.percentage);
          setUploadStage(progress.stage ?? 'uploading');
        },
        onLifecycle: (lifecycle) => {
          if (!isCurrentUploadRun()) {
            return;
          }

          if (lifecycle.stage === 'finalizing') {
            isFinalizingOperationRef.current = true;
            setIsFinalizingUpload(true);
            setUploadStage('finalizing');
            setUploadProgress((current) => Math.max(current, lifecycle.percentage ?? current));
            if (lifecycle.error) {
              setCompletionRetryPending(true);
            }
            return;
          }

          if (lifecycle.stage === 'completed' || lifecycle.stage === 'failed') {
            setCompletionRetryPending(false);
          }
        },
      });

      if (!isCurrentUploadRun()) {
        return;
      }
      setIsFinalizingUpload(true);
      setUploadStage('finalizing');
      setUploadProgress((current) => Math.max(current, 100));
      notifications.show({ message: t('uploaded'), tone: 'positive' });
      setCompletionRetryPending(false);
      clearPendingUpload(activeUploadAttemptId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof UploadPausedError || isClientMediaRestoreMismatchError(error)) {
        const session = pendingMultipartSessionRef.current as { fileId: string; resumable: boolean } | null;
        if (session?.fileId) {
          markPendingUpload(session.fileId, activeUploadAttemptId);
        }
        if (isClientMediaRestoreMismatchError(error)) {
          notifications.show({ message: error.message, tone: 'danger' });
        }
        return;
      }

      if (message === UPLOAD_FINALIZATION_FAILED_MESSAGE) {
        setCompletionRetryPending(true);
        isFinalizingOperationRef.current = true;
      } else if (!resumeNotice || resumeNotice.status !== UploadSessionStatus.FINALIZING) {
        setCompletionRetryPending(false);
        isFinalizingOperationRef.current = false;
      }

      if (cancelRequestedRef.current || message === UPLOAD_ABORTED_MESSAGE) {
        cancelRequestedRef.current = false;
        suppressedResumeRef.current = {
          attemptId: activeUploadAttemptId,
          fileId: activePendingFileRef.current || trackedPendingFileId || resumeNotice?.fileId || undefined,
        };
        clearPendingUpload(activeUploadAttemptId);
        notifications.show({
          message: tCommon('statuses.cancelled'),
          tone: 'neutral',
        });
        return;
      }

      if (!isCurrentUploadRun()) {
        return;
      }

      const failureCode = resolveUploadFailureCode(message, pendingMultipartSessionRef.current);
      if (isRecoverableUploadFailure(failureCode)) {
        const session = pendingMultipartSessionRef.current as {
          fileId: string;
          resumable: boolean;
        } | null;
        if (session?.fileId) {
          markPendingUpload(session.fileId, activeUploadAttemptId);
        }
      } else if (message === UPLOAD_INTERRUPTED_MESSAGE) {
        suppressedResumeRef.current = {
          attemptId: activeUploadAttemptId,
          fileId: activePendingFileRef.current || trackedPendingFileId || resumeNotice?.fileId || undefined,
        };
        clearPendingUpload(activeUploadAttemptId);
      } else if (!isRecoverableUploadFailure(failureCode)) {
        clearPendingUpload(activeUploadAttemptId);
      }

      logger.error('Upload error', { error: message });
      notifications.show({
        message:
          message === UPLOAD_INTERRUPTED_MESSAGE ||
          message === UPLOAD_FAILED_MESSAGE ||
          message === UPLOAD_FINALIZATION_FAILED_MESSAGE
            ? tCommon('messages.uploadFailed')
            : error instanceof Error
              ? error.message
              : tCommon('messages.uploadFailed'),
        tone: 'danger',
      });
    } finally {
      if (isCurrentUploadRun()) {
        activeUploadRunRef.current = null;
        setIsFinalizingUpload(false);
        setUploadStage(null);
        setIsResumingCurrentUpload(false);
        setUploadProgress(0);
      }
    }
  };

  const handleFileSelect = (files: File[]) => {
    if (files[0]) {
      void handleUpload(files[0]);
    }
  };

  const getStatusDisplay = (): {
    label: string | null;
    tone: StatusBadgeTone;
    kind: 'idle' | 'warning' | 'processing' | 'ready' | 'failed';
  } => {
    const hasActiveProcessingLifecycle = Boolean(audioAttached && processingActive);

    if (isFinalizingOperation) {
      return {
        label: mediaStatusLabels.stage.finalizing,
        tone: 'accent',
        kind: 'processing',
      };
    }

    if (isAnyUploadActive && isResumingCurrentUpload) {
      return {
        label: activeUploadLabel,
        tone: 'accent',
        kind: 'processing',
      };
    }

    if (isAnyUploadActive) {
      return { label: activeUploadLabel, tone: 'accent', kind: 'processing' };
    }

    if (isPendingExpired) {
      return { label: resumeInstruction ?? t('resumeExpired'), tone: 'warning', kind: 'warning' };
    }

    if (hasActiveProcessingLifecycle) {
      return { label: activeLifecycleLabel ?? t('processing'), tone: 'accent', kind: 'processing' };
    }

    if (processingStatus === TRACK_PROCESSING_STATUS_COMPLETED) {
      return { label: t('ready'), tone: 'positive', kind: 'ready' };
    }

    if (
      processingStatus === TRACK_PROCESSING_STATUS_PENDING ||
      processingStatus === TRACK_PROCESSING_STATUS_PROCESSING
    ) {
      if (audioAttached) {
        return {
          label: activeLifecycleLabel ?? t('processing'),
          tone: 'accent',
          kind: 'processing',
        };
      }

      return {
        label: resumeInstruction ?? (hasTrackedPendingUpload ? tIngestDialog('resumeAvailable') : null),
        tone: hasTrackedPendingUpload ? 'warning' : 'neutral',
        kind: hasTrackedPendingUpload ? 'warning' : 'idle',
      };
    }

    if (processingStatus === TRACK_PROCESSING_STATUS_FAILED) {
      return { label: tCommon('statuses.failed'), tone: 'danger', kind: 'failed' };
    }

    return {
      label: resumeInstruction ?? (hasTrackedPendingUpload ? tIngestDialog('resumeAvailable') : null),
      tone: hasTrackedPendingUpload ? 'warning' : 'neutral',
      kind: hasTrackedPendingUpload ? 'warning' : 'idle',
    };
  };

  const status = getStatusDisplay();
  const activeResumeLabel = resumeInstruction ?? tIngestDialog('resumeAvailable');
  const showCancelButton =
    hasTrackedPendingUpload || isAnyUploadActive || Boolean(resumeNotice && !isResumeNoticeSuppressed);
  const isBusy = isUploading || isFinalizingUpload || cancelPendingUpload.isPending;
  const showUploadButton = !isAnyUploadActive && !cancelPendingUpload.isPending;
  const reportUploadProgress = useCallback(
    (nextState: { active: boolean; progress: number; stage?: string | null }) => {
      const nextKey = `${nextState.active ? 1 : 0}:${nextState.progress}:${nextState.stage ?? ''}`;
      if (lastReportedUploadProgressRef.current === nextKey) {
        return;
      }

      lastReportedUploadProgressRef.current = nextKey;
      onUploadProgressChange?.(trackId, nextState);
    },
    [onUploadProgressChange, trackId],
  );

  useEffect(() => {
    reportUploadProgress({
      active: isUploading || isFinalizingUpload,
      progress: isUploading || isFinalizingUpload ? uploadProgress : 0,
      stage: isUploading || isFinalizingUpload ? uploadStage : null,
    });
  }, [isFinalizingUpload, isUploading, reportUploadProgress, uploadProgress, uploadStage]);

  useEffect(() => {
    return () => {
      reportUploadProgress({ active: false, progress: 0, stage: null });
    };
  }, [reportUploadProgress]);

  const uploadButtonId = `release-track-audio-upload-button-${trackId}`;
  const uploadButtonWrapperId = `release-track-audio-upload-action-${trackId}`;
  const cancelButtonId = `release-track-audio-cancel-button-${trackId}`;
  const cancelButtonWrapperId = `release-track-audio-cancel-action-${trackId}`;
  const resumeMessageId = `release-track-audio-resume-message-${trackId}`;
  const statusIconId = `release-track-audio-status-${trackId}`;

  const statusIcon = (
    <TrackAudioStatusIcon
      id={statusIconId}
      kind={status.kind}
      tone={status.tone}
      label={status.label ?? '-'}
      compact={compact}
    />
  );

  if (mode === 'status-only') {
    if (status.kind === 'idle' || !status.label) {
      return (
        <DsText size={compact ? 'xs' : 'sm'} tone="secondary" as="span">
          -
        </DsText>
      );
    }

    return (
      <Tooltip label={status.label}>
        <DsText as="span">{statusIcon}</DsText>
      </Tooltip>
    );
  }

  const uploadButton = showUploadButton ? (
    <div id={uploadButtonWrapperId}>
      <Tooltip label={resumeInstruction ?? t('uploadTooltip')}>
        <span>
          <FilePicker id={inputId} accept={ACCEPT_TRACK_AUDIO} disabled={isBusy} onChange={handleFileSelect}>
            {(onBrowse) => (
              <IconButton
                id={uploadButtonId}
                size={compact ? 'sm' : 'md'}
                loading={isBusy}
                disabled={isBusy}
                onClick={onBrowse}
                aria-label={t('uploadTooltip')}
              >
                <IconUpload size={14} />
              </IconButton>
            )}
          </FilePicker>
        </span>
      </Tooltip>
    </div>
  ) : null;

  const cancelButton = showCancelButton ? (
    <div id={cancelButtonWrapperId}>
      <Tooltip label={isFinalizingOperation ? mediaStatusLabels.stage.finalizing : tCommon('actions.cancel')}>
        <IconButton
          id={cancelButtonId}
          size={compact ? 'sm' : 'md'}
          tone={isPendingExpired ? 'warning' : 'neutral'}
          emphasis="low"
          loading={cancelPendingUpload.isPending}
          disabled={isFinalizingOperation}
          title={isFinalizingOperation ? mediaStatusLabels.stage.finalizing : undefined}
          onClick={() => {
            void cancelPendingUpload.mutateAsync();
          }}
          aria-label={tCommon('actions.cancel')}
        >
          <IconPlayerStop size={14} />
        </IconButton>
      </Tooltip>
    </div>
  ) : null;

  if (mode === 'button-only') {
    return (
      <DsLayoutInline gap={compact ? 'xxs' : 'xs'} wrap="nowrap">
        {uploadButton}
        {cancelButton}
      </DsLayoutInline>
    );
  }

  return (
    <div>
      <DsLayoutInline gap={compact ? 'xxs' : 'xs'} wrap="nowrap">
        <Tooltip label={status.label}>{statusIcon}</Tooltip>
        {uploadButton}
        {cancelButton}
      </DsLayoutInline>

      {(isResumingCurrentUpload ? activeResumeLabel : resumeInstruction) &&
      !isAnyUploadActive &&
      !cancelPendingUpload.isPending ? (
        <DsLayoutInset blockStart="xs">
          <DsText id={resumeMessageId} size="xs" tone={isPendingExpired ? 'warning' : 'secondary'}>
            {isResumingCurrentUpload ? activeResumeLabel : resumeInstruction}
          </DsText>
        </DsLayoutInset>
      ) : null}
    </div>
  );
}

function TrackAudioStatusIcon({
  id,
  kind,
  tone,
  label,
  compact,
}: {
  id?: string;
  kind: 'idle' | 'warning' | 'processing' | 'ready' | 'failed';
  tone: StatusBadgeTone;
  label: string;
  compact: boolean;
}) {
  const iconSize = compact ? 14 : 16;
  const stateIconId = id ? `${id}-${kind}` : undefined;

  if (kind === 'idle') {
    return (
      <DsText id={id} size={compact ? 'sm' : 'md'} tone="secondary" aria-label={label} as="span">
        -
      </DsText>
    );
  }

  if (kind === 'processing') {
    return (
      <DsText id={id} size={compact ? 'sm' : 'md'} as="span">
        <Loader id={stateIconId} size="xs" tone={tone} aria-label={label} />
      </DsText>
    );
  }

  const Icon = kind === 'ready' ? IconCheck : kind === 'failed' ? IconX : IconTriangle;

  return (
    <DsText id={id} size={compact ? 'sm' : 'md'} tone={tone} aria-label={label} as="span">
      <Icon id={stateIconId} size={iconSize} stroke={2.2} />
    </DsText>
  );
}
