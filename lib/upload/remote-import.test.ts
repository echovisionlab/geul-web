import { Code, ConnectError } from '@connectrpc/connect';
import { describe, expect, it } from 'vitest';
import { createUploadCorrelationId, isRetryableRemoteImportFailure } from './remote-import';

describe('remote import attempt identity', () => {
  it('creates a UUID correlation when Web Crypto is available', () => {
    expect(createUploadCorrelationId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it.each([Code.Unknown, Code.DeadlineExceeded, Code.ResourceExhausted, Code.Aborted, Code.Internal, Code.Unavailable])(
    'keeps retryable transport/completion code %s',
    (code) => {
      expect(isRetryableRemoteImportFailure(new ConnectError('response lost', code))).toBe(true);
    },
  );

  it.each([Code.InvalidArgument, Code.NotFound, Code.PermissionDenied, Code.FailedPrecondition, Code.Unauthenticated])(
    'clears authoritative terminal code %s',
    (code) => {
      expect(isRetryableRemoteImportFailure(new ConnectError('rejected', code))).toBe(false);
    },
  );

  it('clears local unsupported-type validation failures', () => {
    expect(isRetryableRemoteImportFailure(new Error('Unsupported file type for image upload'))).toBe(false);
  });
});
