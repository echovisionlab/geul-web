import { describe, expect, it } from 'vitest';
import { shouldAdoptResumeNotice } from './track-audio-upload-policy';

const untracked = {
  trackedPendingFileId: '',
  trackedAttemptId: '',
  resumeNotice: { fileId: 'resume-file', attemptId: 'resume-attempt' },
  audioAttached: false,
  suppressed: false,
};

describe('shouldAdoptResumeNotice', () => {
  it('adopts a found session for a track with nothing tracked and no audio', () => {
    expect(shouldAdoptResumeNotice(untracked)).toBe(true);
  });

  it('adopts the session that belongs to the attempt the track already fenced', () => {
    expect(shouldAdoptResumeNotice({ ...untracked, trackedAttemptId: 'resume-attempt' })).toBe(true);
  });

  it.each([
    ['the track fenced a different attempt', { trackedAttemptId: 'current-attempt' }],
    [
      'the track fenced an attempt and the session names none',
      { trackedAttemptId: 'current-attempt', resumeNotice: { fileId: 'resume-file' } },
    ],
    ['a pending file is already tracked', { trackedPendingFileId: 'pending-file' }],
    ['audio is already attached', { audioAttached: true }],
    ['the user dismissed the session', { suppressed: true }],
    ['no session was found', { resumeNotice: null }],
  ])('does not adopt when %s', (_case, overrides) => {
    expect(shouldAdoptResumeNotice({ ...untracked, ...overrides })).toBe(false);
  });
});
