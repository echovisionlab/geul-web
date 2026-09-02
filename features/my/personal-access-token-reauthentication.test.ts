import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  consumePersonalAccessTokenContinuation,
  PERSONAL_ACCESS_TOKEN_CONTINUATION_PARAM,
  personalAccessTokenReauthenticationReturnTo,
  rememberPersonalAccessTokenContinuation,
} from './personal-access-token-reauthentication';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe('personal access token reauthentication continuation', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('round-trips a create intent once for the same member', () => {
    const storage = memoryStorage();
    rememberPersonalAccessTokenContinuation({ action: 'create' }, 'member-1', storage);

    expect(consumePersonalAccessTokenContinuation('member-1', storage)).toEqual({ action: 'create' });
    expect(consumePersonalAccessTokenContinuation('member-1', storage)).toBeNull();
  });

  it('does not expose another member continuation', () => {
    const storage = memoryStorage();
    rememberPersonalAccessTokenContinuation({ action: 'delete', id: 'pat-1' }, 'member-1', storage);

    expect(consumePersonalAccessTokenContinuation('member-2', storage)).toBeNull();
    expect(consumePersonalAccessTokenContinuation('member-1', storage)).toEqual({ action: 'delete', id: 'pat-1' });
  });

  it('discards expired and malformed continuations', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-23T00:00:00.000Z'));
    const storage = memoryStorage();
    rememberPersonalAccessTokenContinuation({ action: 'create' }, 'member-1', storage);
    vi.setSystemTime(new Date('2026-08-23T00:10:00.001Z'));
    expect(consumePersonalAccessTokenContinuation('member-1', storage)).toBeNull();

    storage.setItem(
      'personal_access_token_continuation:member-1',
      JSON.stringify({
        issuedAtMs: Date.now(),
        subjectId: 'member-1',
        continuation: { action: 'unsupported' },
      }),
    );
    expect(consumePersonalAccessTokenContinuation('member-1', storage)).toBeNull();
  });

  it('uses a dedicated return marker on the settings route', () => {
    expect(personalAccessTokenReauthenticationReturnTo()).toBe(
      `/my/settings?${PERSONAL_ACCESS_TOKEN_CONTINUATION_PARAM}=1`,
    );
    expect(personalAccessTokenReauthenticationReturnTo('/admin/users/member-1')).toBe(
      `/admin/users/member-1?${PERSONAL_ACCESS_TOKEN_CONTINUATION_PARAM}=1`,
    );
  });
});
