import { describe, expect, it } from 'vitest';
import { getEmailTemplateDeleteErrorMessage } from './delete-error-message';

const messages = {
  fallbackError: 'raw transport error',
  unauthorizedMessage: 'Sign in again.',
  notFoundMessage: 'Template not found.',
  conflictMessage: 'Template is currently in use.',
  genericMessage: 'Something went wrong.',
};

describe('getEmailTemplateDeleteErrorMessage', () => {
  it.each([
    ['UNAUTHORIZED', messages.unauthorizedMessage],
    ['NOT_FOUND', messages.notFoundMessage],
    ['FAILED_PRECONDITION', messages.conflictMessage],
    ['UNKNOWN', messages.fallbackError],
  ] as const)('maps %s without exposing transport wording for known errors', (errorCode, expected) => {
    expect(getEmailTemplateDeleteErrorMessage({ ...messages, errorCode })).toBe(expected);
  });
});
