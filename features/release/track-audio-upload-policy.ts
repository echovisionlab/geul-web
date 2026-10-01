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
