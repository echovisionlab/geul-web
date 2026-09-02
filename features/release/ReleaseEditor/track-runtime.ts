import type { ReleaseTrackItem } from '@/lib/collab/schemas/release-fields.schema';
import { resolveAudioFileStatusRuntime, type EditorFileStatusSnapshot } from '@/lib/media/editor-file-status-runtime';
import { createMediaStatusLabels, resolveMediaLifecycleDisplay, resolveMediaStatusDisplay } from '@/lib/media/status';
import {
  RELEASE_TRACK_PROCESSING_STATUS,
  isTrackProcessingStatus,
  type ReleaseTrackProcessingStatus,
} from './track-processing-status';

const TRACK_UPLOAD_RESUME_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface TrackUploadProgressState {
  progress: number;
  stage?: string | null;
}

export interface TrackProcessingLifecycle {
  progress: number | null;
}

export interface ReleaseTrackRuntimeState {
  processing_status: ReleaseTrackProcessingStatus | null;
  processing_progress: number | null;
  duration_seconds: number | null;
}

export function resolveTrackProgressIndicator(
  mediaStatusLabels: ReturnType<typeof createMediaStatusLabels>,
  uploadProgress: TrackUploadProgressState | null,
  processingLifecycle: TrackProcessingLifecycle | null,
) {
  if (uploadProgress != null) {
    const uploadDisplay = resolveMediaLifecycleDisplay(
      uploadProgress.stage ?? 'uploading',
      uploadProgress.progress,
      mediaStatusLabels,
    );

    return {
      label: uploadDisplay.label ?? mediaStatusLabels.stage.uploading,
      progress: uploadProgress.progress,
      color: uploadDisplay.color,
    };
  }

  if (!processingLifecycle) {
    return null;
  }

  const display = resolveMediaStatusDisplay({
    status: 'processing',
    progress: processingLifecycle.progress,
    labels: mediaStatusLabels,
  });
  if (!display.label) {
    return null;
  }

  return { label: display.label, progress: processingLifecycle.progress, color: display.color };
}

export function resolveTrackResumeIndicator(
  track: Pick<
    ReleaseTrackItem,
    'audio_attached' | 'pending_upload_file_id' | 'pending_upload_status' | 'pending_upload_started_at'
  >,
  labels: { resumeAvailable: string; resumeExpired: string },
  now = Date.now(),
) {
  if (track.audio_attached || !track.pending_upload_file_id) {
    return null;
  }

  const pendingStartedAtMs = track.pending_upload_started_at ? Date.parse(track.pending_upload_started_at) : Number.NaN;
  const isExpiredByAge =
    Number.isFinite(pendingStartedAtMs) && now - pendingStartedAtMs >= TRACK_UPLOAD_RESUME_WINDOW_MS;
  const isExpired = track.pending_upload_status === 'expired' || isExpiredByAge;

  return {
    kind: 'warning' as const,
    label: isExpired ? labels.resumeExpired : labels.resumeAvailable,
    color: isExpired ? ('red' as const) : ('yellow' as const),
  };
}

export function getTrackProcessingLifecycle(
  track: Pick<ReleaseTrackItem, 'processing_status' | 'processing_progress'>,
): TrackProcessingLifecycle | null {
  if (!isTrackProcessingStatus(track.processing_status)) {
    return null;
  }
  return { progress: track.processing_progress ?? null };
}

export function resolveReleaseTrackRuntimeState(status: EditorFileStatusSnapshot): ReleaseTrackRuntimeState | null {
  const audioRuntime = resolveAudioFileStatusRuntime(status);
  if (!audioRuntime) {
    return null;
  }

  if (audioRuntime.processingStatus === 'ready') {
    return {
      processing_status: RELEASE_TRACK_PROCESSING_STATUS.completed,
      processing_progress: null,
      duration_seconds: Number.parseFloat(audioRuntime.duration) || null,
    };
  }
  if (audioRuntime.processingStatus === 'failed') {
    return {
      processing_status: RELEASE_TRACK_PROCESSING_STATUS.failed,
      processing_progress: 0,
      duration_seconds: null,
    };
  }
  return {
    processing_status: RELEASE_TRACK_PROCESSING_STATUS.processing,
    processing_progress: Number.parseInt(audioRuntime.processingProgress, 10) || 0,
    duration_seconds: null,
  };
}

type ReleaseTrackRuntimeTarget = Pick<
  ReleaseTrackItem,
  'audio_attached' | 'processing_status' | 'processing_progress' | 'duration_seconds'
>;

export function applyReleaseTrackRuntimeState<T extends ReleaseTrackRuntimeTarget>(
  track: T,
  runtime: ReleaseTrackRuntimeState | null,
): T {
  if (!runtime) {
    return track;
  }
  return {
    ...track,
    audio_attached: track.audio_attached || Boolean(runtime.processing_status),
    processing_status: runtime.processing_status,
    processing_progress: runtime.processing_progress,
    duration_seconds: runtime.duration_seconds ?? track.duration_seconds,
  };
}
