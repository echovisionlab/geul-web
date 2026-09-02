import { describe, expect, it } from 'vitest';
import {
  isResumableMultipartUpload,
  isSameSelectedUploadFileCandidate,
  shouldResumeUploadIdentityCandidate,
} from './upload-runtime';

describe('upload runtime helpers', () => {
  it('requires more than one multipart part before treating an upload as resumable', () => {
    expect(
      isResumableMultipartUpload({
        fileSize: 10,
        chunkSize: 20,
        totalParts: 1,
      }),
    ).toBe(false);
    expect(
      isResumableMultipartUpload({
        fileSize: 40,
        chunkSize: 20,
        totalParts: 2,
      }),
    ).toBe(true);
  });

  it('matches a resumable candidate only when selected file metadata is identical', () => {
    const selectedFile = {
      size: 1234,
      name: 'audio.ogg',
      lastModified: 1770000000000,
    };

    expect(
      isSameSelectedUploadFileCandidate(
        {
          fileSize: selectedFile.size,
          fileName: selectedFile.name,
          mimeType: 'audio/ogg',
          fileLastModified: selectedFile.lastModified,
        },
        selectedFile,
        'audio/ogg',
      ),
    ).toBe(true);
    expect(
      isSameSelectedUploadFileCandidate(
        {
          fileSize: selectedFile.size,
          fileName: 'different.ogg',
          mimeType: 'audio/ogg',
          fileLastModified: selectedFile.lastModified,
        },
        selectedFile,
        'audio/ogg',
      ),
    ).toBe(false);
  });

  it('does not resume an identity candidate when the selected file differs', () => {
    const selectedFile = {
      size: 1234,
      name: 'replacement.ogg',
      lastModified: 1770000000000,
    };

    expect(
      shouldResumeUploadIdentityCandidate(
        {
          fileSize: selectedFile.size,
          fileName: 'previous.ogg',
          mimeType: 'audio/ogg',
          fileLastModified: selectedFile.lastModified,
          chunkSize: 20,
          totalParts: 2,
        },
        selectedFile,
        'audio/ogg',
      ),
    ).toBe(false);
  });
});
