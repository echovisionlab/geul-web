import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { describe, expect, it } from 'vitest';
import type { ReleaseTrackItem } from '@/lib/collab/schemas/release-fields.schema';
import type { EditorFileStatusSnapshot } from '@/lib/media/editor-file-status-runtime';
import { DEFAULT_MEDIA_STATUS_LABELS } from '@/lib/media/status';
import { RELEASE_TRACK_PROCESSING_STATUS } from './track-processing-status';
import {
  applyReleaseTrackRuntimeState,
  getTrackProcessingLifecycle,
  resolveReleaseTrackRuntimeState,
  resolveTrackProgressIndicator,
  resolveTrackResumeIndicator,
} from './track-runtime';

function track(overrides: Partial<ReleaseTrackItem> = {}): ReleaseTrackItem {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    track_number: 1,
    title: 'Track',
    duration_seconds: null,
    audio_attached: false,
    processing_status: null,
    credits: [],
    ...overrides,
  };
}

function status(overrides: Partial<EditorFileStatusSnapshot>): EditorFileStatusSnapshot {
  return {
    completed: false,
    failed: false,
    unavailable: false,
    url: '',
    originalUrl: '',
    waveformUrl: '',
    spectrogramUrl: '',
    thumbnailUrl: '',
    hlsUrl: '',
    durationSeconds: 0,
    processingStatus: MediaProcessingStatus.UNSPECIFIED,
    ...overrides,
  };
}

describe('release track runtime model', () => {
  it('prefers upload lifecycle display and maps processing display', () => {
    expect(resolveTrackProgressIndicator(DEFAULT_MEDIA_STATUS_LABELS, { progress: 20 }, null)).toMatchObject({
      progress: 20,
      label: 'Uploading 20%',
    });
    expect(resolveTrackProgressIndicator(DEFAULT_MEDIA_STATUS_LABELS, null, { progress: 50 })).toMatchObject({
      progress: 50,
    });
    expect(resolveTrackProgressIndicator(DEFAULT_MEDIA_STATUS_LABELS, null, null)).toBeNull();
  });

  it('resolves pending upload availability and expiry deterministically', () => {
    const labels = { resumeAvailable: 'Resume', resumeExpired: 'Expired' };
    const now = Date.parse('2026-08-09T00:00:00.000Z');
    expect(resolveTrackResumeIndicator(track(), labels, now)).toBeNull();
    expect(
      resolveTrackResumeIndicator(
        track({ pending_upload_file_id: 'file', pending_upload_started_at: 'invalid' }),
        labels,
        now,
      ),
    ).toMatchObject({ label: 'Resume', color: 'yellow' });
    expect(
      resolveTrackResumeIndicator(
        track({ pending_upload_file_id: 'file', pending_upload_started_at: '2026-08-01T00:00:00.000Z' }),
        labels,
        now,
      ),
    ).toMatchObject({ label: 'Expired', color: 'red' });
    expect(
      resolveTrackResumeIndicator(
        track({ pending_upload_file_id: 'file', pending_upload_status: 'expired' }),
        labels,
        now,
      ),
    ).toMatchObject({ label: 'Expired' });
    expect(
      resolveTrackResumeIndicator(track({ audio_attached: true, pending_upload_file_id: 'file' }), labels, now),
    ).toBeNull();
  });

  it('maps file runtime snapshots into release track state', () => {
    expect(resolveReleaseTrackRuntimeState(status({}))).toBeNull();
    expect(
      resolveReleaseTrackRuntimeState(status({ completed: true, durationSeconds: 123.4, originalUrl: '/track.wav' })),
    ).toEqual({
      processing_status: RELEASE_TRACK_PROCESSING_STATUS.completed,
      processing_progress: null,
      duration_seconds: 123.4,
    });
    expect(resolveReleaseTrackRuntimeState(status({ failed: true }))).toEqual({
      processing_status: RELEASE_TRACK_PROCESSING_STATUS.failed,
      processing_progress: 0,
      duration_seconds: null,
    });
    expect(
      resolveReleaseTrackRuntimeState(
        status({ processingStatus: MediaProcessingStatus.PROCESSING, processingPercentage: 42 }),
      ),
    ).toEqual({
      processing_status: RELEASE_TRACK_PROCESSING_STATUS.processing,
      processing_progress: 42,
      duration_seconds: null,
    });
  });

  it('applies runtime state while retaining authoritative duration fallback', () => {
    const source = track({ duration_seconds: 60 });
    expect(applyReleaseTrackRuntimeState(source, null)).toBe(source);
    expect(
      applyReleaseTrackRuntimeState(source, {
        processing_status: RELEASE_TRACK_PROCESSING_STATUS.processing,
        processing_progress: 25,
        duration_seconds: null,
      }),
    ).toMatchObject({
      audio_attached: true,
      processing_status: RELEASE_TRACK_PROCESSING_STATUS.processing,
      processing_progress: 25,
      duration_seconds: 60,
    });
    expect(
      getTrackProcessingLifecycle(
        track({ processing_status: RELEASE_TRACK_PROCESSING_STATUS.processing, processing_progress: 100 }),
      ),
    ).toEqual({ progress: 100 });
    expect(getTrackProcessingLifecycle(track({ processing_status: 'unknown' }))).toBeNull();
  });
});
