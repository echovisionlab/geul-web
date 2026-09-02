import type { EmailLayoutActionErrorCode } from '@/lib/actions/email-layout';

interface GetEmailLayoutActionErrorMessageInput {
  errorCode?: EmailLayoutActionErrorCode;
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
    case 'UNAUTHORIZED':
      return unauthorizedMessage;
    case 'ALREADY_EXISTS':
      return duplicateKeyMessage;
    case 'NOT_FOUND':
      return notFoundMessage;
    case 'FAILED_PRECONDITION':
      return conflictMessage || fallbackError || genericMessage;
    default:
      return fallbackError || genericMessage;
  }
}
