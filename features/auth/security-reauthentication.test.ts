import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  consumeAccountSecurityContinuation,
  consumeEmailVerificationContinuation,
  consumePasskeySecurityContinuation,
  isSecurityReauthenticationReturnTarget,
  isSecuritySessionFresh,
  rememberAccountSecurityContinuation,
  rememberEmailVerificationContinuation,
  rememberPasskeySecurityContinuation,
} from './security-reauthentication';

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe('security reauthentication', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('recognizes only a fresh active current session', () => {
    const now = Date.parse('2026-08-09T05:00:00.000Z');
    expect(
      isSecuritySessionFresh(
        [{ id: 'current', current: true, active: true, authenticated_at: '2026-08-09T04:59:00.000Z' }],
        now,
      ),
    ).toBe(true);
    expect(
      isSecuritySessionFresh(
        [{ id: 'current', current: true, active: true, authenticated_at: '2026-08-09T01:59:59.000Z' }],
        now,
      ),
    ).toBe(false);
  });

  it('claims each continuation exactly once', () => {
    const target = storage();
    rememberAccountSecurityContinuation({ action: 'revoke_other_sessions' }, 'member-1', target);
    expect(consumeAccountSecurityContinuation('member-1', target)).toEqual({
      action: 'revoke_other_sessions',
    });
    expect(consumeAccountSecurityContinuation('member-1', target)).toBeNull();

    rememberPasskeySecurityContinuation({ action: 'remove_passkey', id: 'passkey-1' }, 'member-1', target);
    expect(consumePasskeySecurityContinuation('member-1', target)).toEqual({
      action: 'remove_passkey',
      id: 'passkey-1',
    });
    expect(consumePasskeySecurityContinuation('member-1', target)).toBeNull();

    rememberEmailVerificationContinuation(
      { mode: 'change', email: 'new@example.test', operation: 'restart' },
      'member-1',
      target,
    );
    expect(consumeEmailVerificationContinuation('member-1', target)).toEqual({
      mode: 'change',
      email: 'new@example.test',
      operation: 'restart',
    });
    expect(consumeEmailVerificationContinuation('member-1', target)).toBeNull();
  });

  it('discards an unclaimed continuation after ten minutes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-09T05:00:00.000Z'));
    const target = storage();
    rememberAccountSecurityContinuation({ action: 'revoke_other_sessions' }, 'member-1', target);
    vi.setSystemTime(new Date('2026-08-09T05:10:00.001Z'));

    expect(consumeAccountSecurityContinuation('member-1', target)).toBeNull();
  });

  it('discards a continuation when another member returns from reauthentication', () => {
    const target = storage();
    rememberAccountSecurityContinuation({ action: 'request_account_deletion' }, 'member-1', target);

    expect(consumeAccountSecurityContinuation('member-2', target)).toBeNull();
    expect(consumeAccountSecurityContinuation('member-1', target)).toBeNull();
  });

  it('recognizes security return target paths', () => {
    expect(isSecurityReauthenticationReturnTarget('/my/security?resume=1')).toBe(true);
    expect(isSecurityReauthenticationReturnTarget('https://studio.example.test/verify')).toBe(true);
    expect(isSecurityReauthenticationReturnTarget('/admin')).toBe(false);
  });
});
