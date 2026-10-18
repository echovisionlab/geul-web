import { Code, ConnectError } from '@connectrpc/connect';
import { describe, expect, it } from 'vitest';
import { getTranslationActionErrorMessage } from './action-error';

describe('translation action errors', () => {
  it.each([
    [new ConnectError('private detail', Code.PermissionDenied), 'Forbidden'],
    [new ConnectError('private detail', Code.Unauthenticated), 'Unauthorized'],
    [new ConnectError('private detail', Code.Internal), 'Could not update'],
    [new Error('private detail'), 'Could not update'],
  ])('returns a stable message for %s', (error, message) => {
    expect(getTranslationActionErrorMessage(error, 'Could not update')).toBe(message);
  });
});
