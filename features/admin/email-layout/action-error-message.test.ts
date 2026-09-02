import { describe, expect, it } from 'vitest';
import { getEmailLayoutActionErrorMessage } from './action-error-message';

describe('getEmailLayoutActionErrorMessage', () => {
  it('uses the localized in-use message for a delete conflict', () => {
    expect(
      getEmailLayoutActionErrorMessage({
        errorCode: 'FAILED_PRECONDITION',
        fallbackError: '[failed_precondition] layout is in use',
        unauthorizedMessage: 'unauthorized',
        duplicateKeyMessage: 'duplicate',
        notFoundMessage: 'not found',
        conflictMessage: 'Remove every reference before deleting this layout.',
        genericMessage: 'generic',
      }),
    ).toBe('Remove every reference before deleting this layout.');
  });
});
