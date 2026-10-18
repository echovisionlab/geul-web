import { UploadSessionStatus } from '@echovisionlab/geul-proto/secure/file_pb.ts';

interface TrackAudioUploadFinalizationState {
  lifecycleStage?: string | null;
  sessionStatus?: UploadSessionStatus | null;
  completionRetryPending?: boolean;
}

export function isTrackAudioUploadFinalizing({
  lifecycleStage,
  sessionStatus,
  completionRetryPending = false,
}: TrackAudioUploadFinalizationState): boolean {
  return lifecycleStage === 'finalizing' || sessionStatus === UploadSessionStatus.FINALIZING || completionRetryPending;
}

interface TrackAudioResumeAdoptionState {
  trackedPendingFileId: string;
  trackedAttemptId: string;
  resumeNotice: { fileId: string; attemptId?: string } | null;
  audioAttached: boolean;
  suppressed: boolean;
}

/**
 * A resumable session found for the track becomes the track's pending upload only when nothing is tracked
 * yet, no audio is attached, the user has not dismissed it, and it belongs to the attempt the track has
 * already fenced (if any).
 */
export function shouldAdoptResumeNotice({
  trackedPendingFileId,
  trackedAttemptId,
  resumeNotice,
  audioAttached,
  suppressed,
}: TrackAudioResumeAdoptionState): boolean {
  if (trackedPendingFileId || !resumeNotice?.fileId || audioAttached || suppressed) {
    return false;
  }
  return !trackedAttemptId || trackedAttemptId === resumeNotice.attemptId;
}
