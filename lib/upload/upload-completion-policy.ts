import { UploadSessionStatus } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import {
  createTerminalUploadCompletionError,
  createUploadError,
  isDefinitiveUploadCompletionError,
} from './upload-errors';
import { UPLOAD_FINALIZATION_FAILED_MESSAGE } from './failure';

interface CompletionIdentity {
  uploadId: string;
  fileId: string;
}

interface CompletionCandidate extends CompletionIdentity {
  status: UploadSessionStatus;
}

export class UploadCompletionPolicyError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'UploadCompletionPolicyError';
  }
}

function isExactRecoverableCandidate(
  candidate: CompletionCandidate | null | undefined,
  identity: CompletionIdentity,
): boolean {
  if (!candidate || candidate.uploadId !== identity.uploadId || candidate.fileId !== identity.fileId) {
    return false;
  }
  return (
    candidate.status === UploadSessionStatus.INITIATED ||
    candidate.status === UploadSessionStatus.UPLOADING ||
    candidate.status === UploadSessionStatus.FINALIZING
  );
}

interface Options<TResult> {
  identity: CompletionIdentity;
  complete: () => Promise<TResult>;
  findCandidate: () => Promise<CompletionCandidate | null>;
  recoverCompleted: () => Promise<TResult>;
}

export async function completeUploadWithRecovery<TResult>({
  identity,
  complete,
  findCandidate,
  recoverCompleted,
}: Options<TResult>): Promise<TResult> {
  try {
    return await complete();
  } catch (completionError) {
    if (isDefinitiveUploadCompletionError(completionError)) {
      throw new UploadCompletionPolicyError(createTerminalUploadCompletionError(completionError).message, false);
    }

    let candidate: CompletionCandidate | null | undefined;
    try {
      candidate = await findCandidate();
    } catch (candidateError) {
      if (isDefinitiveUploadCompletionError(candidateError)) {
        throw new UploadCompletionPolicyError(createTerminalUploadCompletionError(candidateError).message, false);
      }
    }

    if (candidate === null) {
      try {
        return await recoverCompleted();
      } catch (recoveryError) {
        if (isDefinitiveUploadCompletionError(recoveryError)) {
          throw new UploadCompletionPolicyError(createTerminalUploadCompletionError(recoveryError).message, false);
        }
      }
    } else if (candidate !== undefined && !isExactRecoverableCandidate(candidate, identity)) {
      throw new UploadCompletionPolicyError(createTerminalUploadCompletionError(completionError).message, false);
    }

    throw new UploadCompletionPolicyError(createUploadError(UPLOAD_FINALIZATION_FAILED_MESSAGE).message, true);
  }
}
