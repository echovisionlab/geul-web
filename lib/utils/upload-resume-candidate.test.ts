import { randomTestId, randomTestUuid } from '@echovisionlab/geul-common/test/random-id';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildUploadResumeCandidateLookupKey,
  clearMultipartUploadCandidateLookupCache,
  findMultipartUploadCandidateShared,
} from './upload-resume-candidate';

afterEach(() => {
  clearMultipartUploadCandidateLookupCache();
  vi.useRealTimers();
});

describe('upload resume candidate lookup cache', () => {
  it('builds a stable lookup key from upload identity fields', () => {
    const entityId = randomTestUuid();
    const slotId = randomTestId('slot');
    const fileId = randomTestUuid();
    const uploadId = randomTestId('upload');

    expect(
      buildUploadResumeCandidateLookupKey({
        uploadType: UploadType.TRACK_AUDIO,
        entityId,
        entityType: 4 as never,
        slotId,
        fileId,
        uploadId,
      }),
    ).toBe(`10:${entityId}:4:${slotId}::${fileId}:${uploadId}`);
  });

  it('dedupes concurrent lookups for the same upload identity', async () => {
    const lookup = vi.fn().mockResolvedValue(null);
    const input = {
      uploadType: UploadType.TRACK_AUDIO,
      entityId: randomTestUuid(),
      entityType: 4 as never,
      slotId: randomTestId('slot'),
      fileId: randomTestUuid(),
      uploadId: randomTestId('upload'),
    };

    const [first, second] = await Promise.all([
      findMultipartUploadCandidateShared(input, lookup),
      findMultipartUploadCandidateShared(input, lookup),
    ]);

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('reuses a recent result briefly before re-querying', async () => {
    vi.useFakeTimers();
    const lookup = vi
      .fn()
      .mockResolvedValueOnce({ uploadId: randomTestId('upload') })
      .mockResolvedValueOnce({ uploadId: randomTestId('upload') });
    const input = {
      uploadType: UploadType.TRACK_AUDIO,
      entityId: randomTestUuid(),
      fileId: randomTestUuid(),
      uploadId: randomTestId('upload'),
    };

    const first = await findMultipartUploadCandidateShared(input, lookup);
    const second = await findMultipartUploadCandidateShared(input, lookup);
    vi.advanceTimersByTime(300);
    const third = await findMultipartUploadCandidateShared(input, lookup);

    expect(first).toEqual(second);
    expect(third).not.toEqual(first);
    expect(lookup).toHaveBeenCalledTimes(2);
  });
});
