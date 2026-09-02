import { describe, expect, it } from 'vitest';
import {
  clearAcceptedAuthCodeDelivery,
  getAuthCodeTiming,
  readAcceptedAuthCodeDeliveryAt,
  recordAcceptedAuthCodeDelivery,
} from './auth-code-timing';

const NOW = Date.parse('2026-07-31T12:00:00.000Z');

function storageFixture() {
  const values = new Map<string, string>();
  return {
    values,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  };
}

describe('getAuthCodeTiming', () => {
  it('derives code expiry and resend cooldown only from the accepted delivery timestamp', () => {
    expect(
      getAuthCodeTiming(
        {
          acceptedDeliveryAt: NOW - 30_000,
          codeLifespanSeconds: 900,
          flowExpiresAt: '2026-07-31T12:30:00.000Z',
          resendCooldownSeconds: 60,
        },
        NOW,
      ),
    ).toEqual({
      expiresInSeconds: 870,
      flowExpiresInSeconds: 1800,
      resendInSeconds: 30,
    });
  });

  it('does not invent a code deadline from the independent flow expiry', () => {
    expect(
      getAuthCodeTiming(
        {
          acceptedDeliveryAt: null,
          codeLifespanSeconds: 900,
          flowExpiresAt: '2026-07-31T12:15:00.000Z',
          resendCooldownSeconds: 60,
        },
        NOW,
      ),
    ).toEqual({
      expiresInSeconds: null,
      flowExpiresInSeconds: 900,
      resendInSeconds: 0,
    });
  });

  it('keeps code and flow expiry independent', () => {
    expect(
      getAuthCodeTiming(
        {
          acceptedDeliveryAt: NOW - 16 * 60_000,
          codeLifespanSeconds: 900,
          flowExpiresAt: '2026-07-31T12:10:00.000Z',
          resendCooldownSeconds: 60,
        },
        NOW,
      ),
    ).toEqual({
      expiresInSeconds: 0,
      flowExpiresInSeconds: 600,
      resendInSeconds: 0,
    });

    expect(
      getAuthCodeTiming(
        {
          acceptedDeliveryAt: NOW - 10_000,
          codeLifespanSeconds: 900,
          flowExpiresAt: '2026-07-31T11:59:59.000Z',
          resendCooldownSeconds: 60,
        },
        NOW,
      ),
    ).toEqual({
      expiresInSeconds: 890,
      flowExpiresInSeconds: 0,
      resendInSeconds: 50,
    });
  });
});

describe('accepted auth-code delivery persistence', () => {
  it('is scoped by purpose and flow, survives a new reader, and can be cleared', () => {
    const { storage } = storageFixture();

    recordAcceptedAuthCodeDelivery('login', 'flow-1', NOW, storage);

    expect(readAcceptedAuthCodeDeliveryAt('login', 'flow-1', storage)).toBe(NOW);
    expect(readAcceptedAuthCodeDeliveryAt('registration', 'flow-1', storage)).toBeNull();
    expect(readAcceptedAuthCodeDeliveryAt('login', 'flow-2', storage)).toBeNull();

    clearAcceptedAuthCodeDelivery('login', 'flow-1', storage);
    expect(readAcceptedAuthCodeDeliveryAt('login', 'flow-1', storage)).toBeNull();
  });

  it('ignores malformed persisted timestamps', () => {
    const { storage, values } = storageFixture();
    values.set('geul.auth-code-delivery:login:flow-1', 'not-a-timestamp');
    expect(readAcceptedAuthCodeDeliveryAt('login', 'flow-1', storage)).toBeNull();
  });

  it('does not crash the auth flow when browser storage is unavailable', () => {
    const unavailableStorage = {
      getItem: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
      removeItem: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
    };

    expect(readAcceptedAuthCodeDeliveryAt('login', 'flow-1', unavailableStorage)).toBeNull();
    expect(() => recordAcceptedAuthCodeDelivery('login', 'flow-1', NOW, unavailableStorage)).not.toThrow();
    expect(() => clearAcceptedAuthCodeDelivery('login', 'flow-1', unavailableStorage)).not.toThrow();
  });
});
