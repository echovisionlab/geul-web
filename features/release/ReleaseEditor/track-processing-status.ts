export const RELEASE_TRACK_PROCESSING_STATUS = {
  pending: 'TRACK_PROCESSING_STATUS_PENDING',
  processing: 'TRACK_PROCESSING_STATUS_PROCESSING',
  completed: 'TRACK_PROCESSING_STATUS_COMPLETED',
  failed: 'TRACK_PROCESSING_STATUS_FAILED',
} as const;

export type ReleaseTrackProcessingStatus =
  (typeof RELEASE_TRACK_PROCESSING_STATUS)[keyof typeof RELEASE_TRACK_PROCESSING_STATUS];

const TRACK_PROCESSING_STATUS_PENDING = RELEASE_TRACK_PROCESSING_STATUS.pending;
const TRACK_PROCESSING_STATUS_PROCESSING = RELEASE_TRACK_PROCESSING_STATUS.processing;
const TRACK_PROCESSING_STATUS_COMPLETED = RELEASE_TRACK_PROCESSING_STATUS.completed;
const TRACK_PROCESSING_STATUS_FAILED = RELEASE_TRACK_PROCESSING_STATUS.failed;

export function isTrackProcessingStatus(status: string | null | undefined): boolean {
  return status === TRACK_PROCESSING_STATUS_PENDING || status === TRACK_PROCESSING_STATUS_PROCESSING;
}

export function resolveReleaseTrackProcessingStatus(
  status: string | null | undefined,
): ReleaseTrackProcessingStatus | null {
  switch (status) {
    case TRACK_PROCESSING_STATUS_PENDING:
    case TRACK_PROCESSING_STATUS_PROCESSING:
    case TRACK_PROCESSING_STATUS_COMPLETED:
    case TRACK_PROCESSING_STATUS_FAILED:
      return status;
    default:
      return null;
  }
}
