import { Code, ConnectError } from '@connectrpc/connect';
import { UploadSessionStatus } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { describe, expect, it, vi } from 'vitest';
import { actionFailure, actionSuccess } from '@/lib/actions/action-result';
import { completeUploadWithRecovery } from './upload-completion-policy';
import { CLIENT_MEDIA_ARTIFACTS_MISSING, unwrapClientMediaCompletion } from './upload-errors';

const identity = { fileId: 'file-1', uploadId: 'upload-1' };
const result = { fileId: 'file-1', url: '/media/file-1' };
function callbacks() {
  return {
    identity,
    complete: vi.fn(async () => result),
    findCandidate: vi.fn<() => Promise<(typeof identity & { status: UploadSessionStatus }) | null>>(),
    recoverCompleted: vi.fn(async () => result),
  };
}

describe('client media ActionResult completion contract', () => {
  it('returns the committed identity and delivery URL on success', () => {
    expect(unwrapClientMediaCompletion(actionSuccess(result))).toEqual(result);
  });

  it.each([
    [Code.Unauthenticated, 'Unauthorized'],
    [Code.PermissionDenied, 'Forbidden'],
    [Code.InvalidArgument, 'Upload failed'],
    [Code.NotFound, 'Upload failed'],
    [Code.FailedPrecondition, 'Upload failed'],
    [Code.DataLoss, 'Upload failed'],
    [Code.Unavailable, 'commit unavailable'],
  ])('classifies code %s for the completion policy', (code, message) => {
    expect(() => unwrapClientMediaCompletion(actionFailure('commit unavailable', code))).toThrow(message);
  });

  it('recognizes missing staging from the structured error even when the transport code is unavailable', async () => {
    const options = callbacks();
    options.complete.mockImplementation(async () =>
      unwrapClientMediaCompletion(actionFailure(CLIENT_MEDIA_ARTIFACTS_MISSING, Code.Unavailable)),
    );
    await expect(completeUploadWithRecovery(options)).rejects.toMatchObject({
      message: CLIENT_MEDIA_ARTIFACTS_MISSING,
      code: CLIENT_MEDIA_ARTIFACTS_MISSING,
      retryable: true,
    });
    expect(options.findCandidate).not.toHaveBeenCalled();
    expect(options.recoverCompleted).not.toHaveBeenCalled();
  });
});

describe('completion delivery recovery', () => {
  it('accepts a commit acknowledgement without probing or repeating completion', async () => {
    const options = callbacks();
    await expect(completeUploadWithRecovery(options)).resolves.toEqual(result);
    expect(options.findCandidate).not.toHaveBeenCalled();
    expect(options.recoverCompleted).not.toHaveBeenCalled();
  });

  it.each(['Unauthorized', 'Forbidden', 'Upload failed'])(
    'keeps %s terminal without delivery probing',
    async (message) => {
      const options = callbacks();
      options.complete.mockRejectedValue(new Error(message));
      await expect(completeUploadWithRecovery(options)).rejects.toMatchObject({ message, retryable: false });
      expect(options.findCandidate).not.toHaveBeenCalled();
      expect(options.recoverCompleted).not.toHaveBeenCalled();
    },
  );

  it('recovers a lost response once after the exact session disappears', async () => {
    const options = callbacks();
    options.complete.mockRejectedValue(new ConnectError('response lost', Code.Unavailable));
    options.findCandidate.mockResolvedValue(null);
    await expect(completeUploadWithRecovery(options)).resolves.toEqual(result);
    expect(options.complete).toHaveBeenCalledOnce();
    expect(options.recoverCompleted).toHaveBeenCalledOnce();
  });

  it.each(['active-session', 'lookup-unavailable', 'recovery-unavailable'] as const)(
    'retains same-session finalization for %s',
    async (condition) => {
      const options = callbacks();
      options.complete.mockRejectedValue(new Error('backend unavailable'));
      if (condition === 'active-session') {
        options.findCandidate.mockResolvedValue({ ...identity, status: UploadSessionStatus.FINALIZING });
      }
      if (condition === 'lookup-unavailable') {
        options.findCandidate.mockRejectedValue(new ConnectError('lookup unavailable', Code.Unavailable));
      }
      if (condition === 'recovery-unavailable') {
        options.findCandidate.mockResolvedValue(null);
        options.recoverCompleted.mockRejectedValue(new ConnectError('recovery unavailable', Code.Unavailable));
      }
      await expect(completeUploadWithRecovery(options)).rejects.toMatchObject({
        message: 'Upload finalization failed',
        retryable: true,
      });
      expect(options.recoverCompleted).toHaveBeenCalledTimes(condition === 'recovery-unavailable' ? 1 : 0);
    },
  );

  it.each(['candidate-authority', 'recovery-integrity'] as const)('terminates on %s rejection', async (condition) => {
    const options = callbacks();
    options.complete.mockRejectedValue(new Error('response lost'));
    const message = condition === 'candidate-authority' ? 'Forbidden' : 'Upload failed';
    if (condition === 'candidate-authority') {
      options.findCandidate.mockRejectedValue(new Error(message));
    } else {
      options.findCandidate.mockResolvedValue(null);
      options.recoverCompleted.mockRejectedValue(new Error(message));
    }
    await expect(completeUploadWithRecovery(options)).rejects.toMatchObject({ message, retryable: false });
  });
});
