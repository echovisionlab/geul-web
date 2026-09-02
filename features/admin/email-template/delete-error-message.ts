import type { DeleteEmailTemplateErrorCode } from '@/lib/actions/email-template';

interface GetEmailTemplateDeleteErrorMessageInput {
  errorCode?: DeleteEmailTemplateErrorCode;
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
    case 'UNAUTHORIZED':
      return unauthorizedMessage;
    case 'NOT_FOUND':
      return notFoundMessage;
    case 'FAILED_PRECONDITION':
      return conflictMessage;
    default:
      return fallbackError || genericMessage;
  }
}
