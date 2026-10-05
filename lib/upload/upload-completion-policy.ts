import { UploadSessionStatus } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import {
  CLIENT_MEDIA_ARTIFACTS_MISSING,
  isClientMediaArtifactsMissingError,
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
    readonly code?: typeof CLIENT_MEDIA_ARTIFACTS_MISSING,
  ) {
    super(message);
    this.name = 'UploadCompletionPolicyError';
  }
}

/** Known integrity/authority failures and missing staging bypass delivery probing. */
function throwKnownFailure(error: unknown): void {
  if (isClientMediaArtifactsMissingError(error)) {
    throw new UploadCompletionPolicyError(CLIENT_MEDIA_ARTIFACTS_MISSING, true, CLIENT_MEDIA_ARTIFACTS_MISSING);
  }
  if (isDefinitiveUploadCompletionError(error)) {
    throw new UploadCompletionPolicyError(createTerminalUploadCompletionError(error).message, false);
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
    throwKnownFailure(completionError);

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
        throwKnownFailure(recoveryError);
      }
    } else if (candidate !== undefined && !isExactRecoverableCandidate(candidate, identity)) {
      throw new UploadCompletionPolicyError(createTerminalUploadCompletionError(completionError).message, false);
    }

    throw new UploadCompletionPolicyError(createUploadError(UPLOAD_FINALIZATION_FAILED_MESSAGE).message, true);
  }
}
