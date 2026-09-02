import { randomTestId, randomTestUuid } from '@echovisionlab/geul-common/test/random-id';
import { describe, expect, it } from 'vitest';
import {
  getUploadResumeLookupFileId,
  hasUploadResumeAttemptIdentity,
  hasUploadResumeBackendLookupIdentity,
} from './resume-state';

describe('upload resume identity helpers', () => {
  it('prefers pending file id for backend lookup', () => {
    const pendingFileId = randomTestUuid();
    const durableFileId = randomTestUuid();

    expect(
      getUploadResumeLookupFileId({
        pendingFileId,
        fileId: durableFileId,
      }),
    ).toBe(pendingFileId);
  });

  it('uses slot identity as a backend lookup identity', () => {
    const slotId = randomTestId('slot');

    expect(
      hasUploadResumeBackendLookupIdentity({
        slotId,
      }),
    ).toBe(true);
  });

  it('allows entity-scoped backend lookup for surfaces whose entity is the upload identity', () => {
    expect(
      hasUploadResumeBackendLookupIdentity({
        allowEntityLookup: true,
      }),
    ).toBe(true);
  });

  it('treats pending file or attempt as client-visible pending identity', () => {
    expect(hasUploadResumeAttemptIdentity({ pendingFileId: randomTestUuid() })).toBe(true);
    expect(hasUploadResumeAttemptIdentity({ attemptId: randomTestUuid() })).toBe(true);
    expect(hasUploadResumeAttemptIdentity({ slotId: randomTestId('slot') })).toBe(false);
  });
});
