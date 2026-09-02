'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { IconCheck, IconPlayerStop, IconTriangle, IconUpload, IconX } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Group, Loader, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconButton } from '@/components/core/IconButton';
import { Tooltip } from '@/components/core/Tooltip';
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
import { readUploadSession } from '@/lib/upload/upload-session-store';
import { createClientLogger } from '@/lib/utils/client-logger';
import {
  RELEASE_TRACK_PROCESSING_STATUS,
  type ReleaseTrackProcessingStatus,
} from './ReleaseEditor/track-processing-status';

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
  const [localPendingUploadIdentity, setLocalPendingUploadIdentity] = useState<{
    fileId: string;
    attemptId: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cancelRequestedRef = useRef(false);
  const lastReportedUploadProgressRef = useRef<string | null>(null);
  const activePendingAttemptRef = useRef(String(pendingUploadAttemptId || ''));
  const activePendingFileRef = useRef(String(pendingUploadFileId || ''));
  const activeUploadRunRef = useRef<symbol | null>(null);
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

  const cancelPendingUpload = useMutation({
    mutationFn: async () => {
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

      const suppressedIdentity = {
        attemptId: cancelIdentity.attemptId || undefined,
        fileId: resumableFileId || cancelIdentity.fileId || undefined,
      };
      suppressedResumeRef.current = suppressedIdentity;
      clearPendingUpload(cancelAttemptId);
      return suppressedIdentity;
    },
    onSuccess: (identity) => {
      onPendingUploadCancelled?.(identity);
      if (!isUploading) {
        notifications.show({
          message: tCommon('statuses.cancelled'),
          color: 'gray',
        });
      }
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : tCommon('messages.uploadFailed'),
        color: 'red',
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
    let activeUploadAttemptId = resumeAttemptId;
    const isCurrentUploadRun = () => activeUploadRunRef.current === activeUploadRun;
    if (!resumeRequested) {
      setUploadProgress(0);
    }
    setUploadStage(null);
    setIsResumingCurrentUpload(false);
    setIsFinalizingUpload(false);
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
          if (!session.resumed) {
            setUploadProgress(0);
          }
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
          setIsFinalizingUpload(false);
          setUploadProgress(progress.percentage);
          setUploadStage(progress.stage ?? 'uploading');
        },
      });

      if (!isCurrentUploadRun()) {
        return;
      }
      setIsFinalizingUpload(true);
      setUploadStage('finalizing');
      setUploadProgress((current) => Math.max(current, 100));
      notifications.show({ message: t('uploaded'), color: 'green' });
      clearPendingUpload(activeUploadAttemptId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (cancelRequestedRef.current || message === UPLOAD_ABORTED_MESSAGE) {
        cancelRequestedRef.current = false;
        suppressedResumeRef.current = {
          attemptId: activeUploadAttemptId,
          fileId: activePendingFileRef.current || trackedPendingFileId || resumeNotice?.fileId || undefined,
        };
        clearPendingUpload(activeUploadAttemptId);
        notifications.show({
          message: tCommon('statuses.cancelled'),
          color: 'gray',
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
        color: 'red',
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleUpload(file);
    }
    event.target.value = '';
  };

  const getStatusDisplay = (): {
    label: string | null;
    tone: 'dimmed' | 'gray' | 'blue' | 'cyan' | 'green' | 'red' | 'yellow';
    kind: 'idle' | 'warning' | 'processing' | 'ready' | 'failed';
  } => {
    const hasActiveProcessingLifecycle = Boolean(audioAttached && processingActive);

    if (isAnyUploadActive && isResumingCurrentUpload) {
      return {
        label: activeUploadLabel,
        tone: activeUploadDisplay.color,
        kind: 'processing',
      };
    }

    if (isAnyUploadActive) {
      return { label: activeUploadLabel, tone: activeUploadDisplay.color, kind: 'processing' };
    }

    if (isPendingExpired) {
      return { label: resumeInstruction ?? t('resumeExpired'), tone: 'red', kind: 'warning' };
    }

    if (hasActiveProcessingLifecycle) {
      return { label: activeLifecycleLabel ?? t('processing'), tone: 'yellow', kind: 'processing' };
    }

    if (processingStatus === TRACK_PROCESSING_STATUS_COMPLETED) {
      return { label: t('ready'), tone: 'green', kind: 'ready' };
    }

    if (
      processingStatus === TRACK_PROCESSING_STATUS_PENDING ||
      processingStatus === TRACK_PROCESSING_STATUS_PROCESSING
    ) {
      if (audioAttached) {
        return {
          label: activeLifecycleLabel ?? t('processing'),
          tone: 'yellow',
          kind: 'processing',
        };
      }

      return {
        label: resumeInstruction ?? (hasTrackedPendingUpload ? tIngestDialog('resumeAvailable') : null),
        tone: hasTrackedPendingUpload ? 'yellow' : 'dimmed',
        kind: hasTrackedPendingUpload ? 'warning' : 'idle',
      };
    }

    if (processingStatus === TRACK_PROCESSING_STATUS_FAILED) {
      return { label: tCommon('statuses.failed'), tone: 'red', kind: 'failed' };
    }

    return {
      label: resumeInstruction ?? (hasTrackedPendingUpload ? tIngestDialog('resumeAvailable') : null),
      tone: hasTrackedPendingUpload ? 'yellow' : 'dimmed',
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

  const uploadInput = (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      accept={ACCEPT_TRACK_AUDIO}
      style={{ display: 'none' }}
      onChange={handleFileSelect}
      disabled={isBusy}
    />
  );
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
        <Text size={compact ? 'xs' : 'sm'} c="dimmed" span>
          -
        </Text>
      );
    }

    return (
      <Tooltip label={status.label}>
        <Text span>{statusIcon}</Text>
      </Tooltip>
    );
  }

  const uploadButton = showUploadButton ? (
    <div id={uploadButtonWrapperId}>
      <Tooltip label={resumeInstruction ?? t('uploadTooltip')}>
        <label style={{ cursor: isBusy ? 'wait' : 'pointer' }}>
          {uploadInput}
          <IconButton
            id={uploadButtonId}
            size={compact ? 'sm' : 'md'}
            loading={isBusy}
            component="span"
            aria-label={t('uploadTooltip')}
          >
            <IconUpload size={14} />
          </IconButton>
        </label>
      </Tooltip>
    </div>
  ) : null;

  const cancelButton = showCancelButton ? (
    <div id={cancelButtonWrapperId}>
      <Tooltip label={tCommon('actions.cancel')}>
        <IconButton
          id={cancelButtonId}
          size={compact ? 'sm' : 'md'}
          tone={isPendingExpired ? 'danger' : 'neutral'}
          emphasis="low"
          loading={cancelPendingUpload.isPending}
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
      <Group gap={compact ? 4 : 'xs'} wrap="nowrap">
        {uploadButton}
        {cancelButton}
      </Group>
    );
  }

  return (
    <Box>
      <Group gap={compact ? 6 : 'xs'} wrap="nowrap">
        <Tooltip label={status.label}>{statusIcon}</Tooltip>
        {uploadButton}
        {cancelButton}
      </Group>

      {(isResumingCurrentUpload ? activeResumeLabel : resumeInstruction) &&
      !isAnyUploadActive &&
      !cancelPendingUpload.isPending ? (
        <Text id={resumeMessageId} size="xs" c={isPendingExpired ? 'red' : 'dimmed'} mt="xs">
          {isResumingCurrentUpload ? activeResumeLabel : resumeInstruction}
        </Text>
      ) : null}
    </Box>
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
  tone: 'dimmed' | 'gray' | 'blue' | 'cyan' | 'green' | 'red' | 'yellow';
  label: string;
  compact: boolean;
}) {
  const iconSize = compact ? 14 : 16;
  const stateIconId = id ? `${id}-${kind}` : undefined;

  if (kind === 'idle') {
    return (
      <Text
        id={id}
        size={compact ? 'sm' : 'md'}
        c="dimmed"
        aria-label={label}
        component="span"
        style={{ display: 'inline-flex', lineHeight: 1 }}
      >
        -
      </Text>
    );
  }

  if (kind === 'processing') {
    return (
      <Text id={id} size={compact ? 'sm' : 'md'} component="span" style={{ display: 'inline-flex', lineHeight: 1 }}>
        <Loader id={stateIconId} size={iconSize} color={tone} aria-label={label} style={{ display: 'inline-flex' }} />
      </Text>
    );
  }

  const Icon = kind === 'ready' ? IconCheck : kind === 'failed' ? IconX : IconTriangle;

  return (
    <Text
      id={id}
      size={compact ? 'sm' : 'md'}
      c={tone}
      aria-label={label}
      component="span"
      style={{ display: 'inline-flex', lineHeight: 1 }}
    >
      <Icon id={stateIconId} size={iconSize} stroke={2.2} />
    </Text>
  );
}
