// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { forgetUploadSession, readUploadSession, rememberUploadSession } from './upload-session-store';

const fileId = '01b3db42-75f1-4bf1-8cb9-9b3baf57e795';

afterEach(() => {
  forgetUploadSession(fileId);
  sessionStorage.clear();
});

describe('upload-session-store', () => {
  it('retains only the explicit File/upload capability used for exact resume', () => {
    rememberUploadSession({ fileId, uploadId: 'multipart-1', attemptId: 'attempt-1' });

    expect(readUploadSession(fileId)).toEqual({
      fileId,
      uploadId: 'multipart-1',
      attemptId: 'attempt-1',
    });
    expect(sessionStorage.getItem(`geul-upload-session:${fileId}`)).not.toContain('blockId');
  });

  it('fails closed on malformed persisted state', () => {
    sessionStorage.setItem(`geul-upload-session:${fileId}`, JSON.stringify({ fileId }));

    expect(readUploadSession(fileId)).toBeNull();
    expect(sessionStorage.getItem(`geul-upload-session:${fileId}`)).toBeNull();
  });
});
