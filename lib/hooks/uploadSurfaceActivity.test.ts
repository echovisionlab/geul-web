import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { describe, expect, it } from 'vitest';
import { buildUploadSurfaceKey, mergeUploadSurfaceLifecycle } from './uploadSurfaceActivity';

describe('uploadSurfaceActivity', () => {
  it('builds stable upload surface keys from upload identity', () => {
    expect(
      buildUploadSurfaceKey({
        uploadType: UploadType.EDITOR_AUDIO,
        entityId: 'entity-1',
        slotId: 'slot-1',
        attemptId: 'attempt-1',
      }),
    ).toBe(`${UploadType.EDITOR_AUDIO}:entity-1:slot-1:attempt-1`);
  });

  it('keeps progress monotonic for one upload attempt', () => {
    const atOne = mergeUploadSurfaceLifecycle(null, { stage: 'uploading', progress: 1 });
    const atTwo = mergeUploadSurfaceLifecycle(atOne, { stage: 'uploading', progress: 2 });
    const staleAtOne = mergeUploadSurfaceLifecycle(atTwo, { stage: 'uploading', progress: 1 });

    expect(staleAtOne.progress).toBe(2);
  });
});
