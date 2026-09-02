import { describe, expect, it } from 'vitest';
import { formatLoginErrorMessage } from './login-error-messages';

const t = (key: string) =>
  ({
    'errors.accountBanned': 'ACCOUNT_BANNED',
    'errors.flowExpired': 'FLOW_EXPIRED',
    'errors.generic': 'GENERIC',
  })[key] ?? key;

describe('formatLoginErrorMessage', () => {
  it('maps banned account messages', () => {
    expect(formatLoginErrorMessage('Your account has been suspended.', t)).toBe('ACCOUNT_BANNED');
  });

  it('does not expose account existence from upstream errors', () => {
    expect(formatLoginErrorMessage('User account not found.', t)).toBe('GENERIC');
  });

  it('maps expired flow messages', () => {
    expect(formatLoginErrorMessage('Flow not found or expired', t)).toBe('FLOW_EXPIRED');
  });

  it('falls back to generic for unknown raw kratos messages', () => {
    expect(formatLoginErrorMessage('Something unexpected happened upstream', t)).toBe('GENERIC');
  });
});
