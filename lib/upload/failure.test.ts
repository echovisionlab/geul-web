import { describe, expect, it } from 'vitest';
import {
  isRecoverableUploadFailure,
  resolveUploadFailureCode,
  UPLOAD_ABORTED_MESSAGE,
  UPLOAD_FAILED_MESSAGE,
  UPLOAD_FINALIZATION_FAILED_MESSAGE,
  UPLOAD_INTERRUPTED_MESSAGE,
  UploadFailureCode,
} from './failure';

describe('upload failure codes', () => {
  it('classifies user aborts as cancelled', () => {
    const code = resolveUploadFailureCode(UPLOAD_ABORTED_MESSAGE, { resumable: true });

    expect(code).toBe(UploadFailureCode.ABORTED);
    expect(isRecoverableUploadFailure(code)).toBe(false);
  });

  it('keeps interrupted uploads recoverable when a resumable session exists', () => {
    const code = resolveUploadFailureCode(UPLOAD_INTERRUPTED_MESSAGE, { resumable: true });

    expect(code).toBe(UploadFailureCode.INTERRUPTED_RECOVERABLE);
    expect(isRecoverableUploadFailure(code)).toBe(true);
  });

  it('treats interrupted uploads without a resumable session as terminal', () => {
    const code = resolveUploadFailureCode(UPLOAD_INTERRUPTED_MESSAGE, { resumable: false });

    expect(code).toBe(UploadFailureCode.INTERRUPTED_TERMINAL);
    expect(isRecoverableUploadFailure(code)).toBe(false);
  });

  it('keeps generic upload failures recoverable when a resumable session exists', () => {
    const code = resolveUploadFailureCode(UPLOAD_FAILED_MESSAGE, { resumable: true });

    expect(code).toBe(UploadFailureCode.FAILED_RECOVERABLE);
    expect(isRecoverableUploadFailure(code)).toBe(true);
  });

  it('treats unknown failures as terminal', () => {
    const code = resolveUploadFailureCode('unexpected', { resumable: true });

    expect(code).toBe(UploadFailureCode.FAILED_TERMINAL);
    expect(isRecoverableUploadFailure(code)).toBe(false);
  });

  it('keeps finalization failures recoverable when the completion session still owns retry', () => {
    const code = resolveUploadFailureCode(UPLOAD_FINALIZATION_FAILED_MESSAGE, {
      resumable: false,
    });

    expect(code).toBe(UploadFailureCode.FAILED_RECOVERABLE);
    expect(isRecoverableUploadFailure(code)).toBe(true);
  });

  it('treats finalization failures without a completion session as terminal', () => {
    const code = resolveUploadFailureCode(UPLOAD_FINALIZATION_FAILED_MESSAGE);

    expect(code).toBe(UploadFailureCode.FAILED_TERMINAL);
    expect(isRecoverableUploadFailure(code)).toBe(false);
  });
});
