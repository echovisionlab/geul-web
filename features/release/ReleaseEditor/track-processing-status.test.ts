import { describe, expect, it } from 'vitest';
import { isTrackProcessingStatus, resolveReleaseTrackProcessingStatus } from './track-processing-status';

describe('track-processing-status', () => {
  it('treats only pending and processing statuses as active processing', () => {
    expect(isTrackProcessingStatus('TRACK_PROCESSING_STATUS_PENDING')).toBe(true);
    expect(isTrackProcessingStatus('TRACK_PROCESSING_STATUS_PROCESSING')).toBe(true);
    expect(isTrackProcessingStatus('TRACK_PROCESSING_STATUS_COMPLETED')).toBe(false);
    expect(isTrackProcessingStatus('TRACK_PROCESSING_STATUS_FAILED')).toBe(false);
    expect(isTrackProcessingStatus(null)).toBe(false);
  });

  it('narrows known release track processing statuses and rejects stale unknown values', () => {
    expect(resolveReleaseTrackProcessingStatus('TRACK_PROCESSING_STATUS_PENDING')).toBe(
      'TRACK_PROCESSING_STATUS_PENDING',
    );
    expect(resolveReleaseTrackProcessingStatus('TRACK_PROCESSING_STATUS_PROCESSING')).toBe(
      'TRACK_PROCESSING_STATUS_PROCESSING',
    );
    expect(resolveReleaseTrackProcessingStatus('TRACK_PROCESSING_STATUS_COMPLETED')).toBe(
      'TRACK_PROCESSING_STATUS_COMPLETED',
    );
    expect(resolveReleaseTrackProcessingStatus('TRACK_PROCESSING_STATUS_FAILED')).toBe(
      'TRACK_PROCESSING_STATUS_FAILED',
    );
    expect(resolveReleaseTrackProcessingStatus('processing')).toBeNull();
    expect(resolveReleaseTrackProcessingStatus(null)).toBeNull();
  });
});
