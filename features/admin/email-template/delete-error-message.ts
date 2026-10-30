import { Code } from '@connectrpc/connect';
import type { ActionErrorCode } from '@/lib/actions/action-result';

interface GetEmailTemplateDeleteErrorMessageInput {
  errorCode?: ActionErrorCode;
  fallbackError?: string;
  unauthorizedMessage: string;
  notFoundMessage: string;
  conflictMessage: string;
  genericMessage: string;
}

export function getEmailTemplateDeleteErrorMessage({
  errorCode,
  fallbackError,
  unauthorizedMessage,
  notFoundMessage,
  conflictMessage,
  genericMessage,
}: GetEmailTemplateDeleteErrorMessageInput): string {
  switch (errorCode) {
    case Code.Unauthenticated:
      return unauthorizedMessage;
    case Code.NotFound:
      return notFoundMessage;
    case Code.FailedPrecondition:
      return conflictMessage;
    default:
      return fallbackError || genericMessage;
  }
}
