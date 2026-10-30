import { Code } from '@connectrpc/connect';
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
    [Code.Unauthenticated, messages.unauthorizedMessage],
    [Code.NotFound, messages.notFoundMessage],
    [Code.FailedPrecondition, messages.conflictMessage],
    ['ACTION_FAILED', messages.fallbackError],
    [Code.Internal, messages.fallbackError],
  ] as const)('maps %s without exposing transport wording for known errors', (errorCode, expected) => {
    expect(getEmailTemplateDeleteErrorMessage({ ...messages, errorCode })).toBe(expected);
  });
});
