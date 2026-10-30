import { Code } from '@connectrpc/connect';
import type { ActionErrorCode } from '@/lib/actions/action-result';

interface GetEmailLayoutActionErrorMessageInput {
  errorCode?: ActionErrorCode;
  fallbackError?: string;
  unauthorizedMessage: string;
  duplicateKeyMessage: string;
  notFoundMessage: string;
  conflictMessage?: string;
  genericMessage: string;
}

export function getEmailLayoutActionErrorMessage({
  errorCode,
  fallbackError,
  unauthorizedMessage,
  duplicateKeyMessage,
  notFoundMessage,
  conflictMessage,
  genericMessage,
}: GetEmailLayoutActionErrorMessageInput): string {
  switch (errorCode) {
    case Code.Unauthenticated:
      return unauthorizedMessage;
    case Code.AlreadyExists:
      return duplicateKeyMessage;
    case Code.NotFound:
      return notFoundMessage;
    case Code.FailedPrecondition:
      return conflictMessage || fallbackError || genericMessage;
    default:
      return fallbackError || genericMessage;
  }
}
