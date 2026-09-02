import {
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_VERSION,
  getCookieValue,
  hasAnalyticsConsent,
  hasValidAnalyticsConsent,
  isCookieConsentCurrent,
  parseCookieConsentPreferences,
  serializeCookieConsentPreferences,
  type CookieConsentPreferences,
} from './cookie-consent';

describe('cookie consent utilities', () => {
  it('extracts cookie value by name', () => {
    const cookieHeader = `foo=1; ${COOKIE_CONSENT_COOKIE_NAME}=abc123; bar=2`;
    expect(getCookieValue(cookieHeader, COOKIE_CONSENT_COOKIE_NAME)).toBe('abc123');
    expect(getCookieValue(cookieHeader, 'missing')).toBeNull();
  });

  it('serializes and parses preferences round-trip', () => {
    const preferences: CookieConsentPreferences = {
      version: COOKIE_CONSENT_VERSION,
      essential: true,
      analytics: true,
      updatedAt: '2026-03-02T00:00:00.000Z',
    };

    const serialized = serializeCookieConsentPreferences(preferences);
    const parsed = parseCookieConsentPreferences(serialized);

    expect(parsed).toEqual(preferences);
  });

  it('returns null for malformed or invalid payloads', () => {
    expect(parseCookieConsentPreferences('not-json')).toBeNull();
    expect(parseCookieConsentPreferences('')).toBeNull();
    expect(
      parseCookieConsentPreferences(
        encodeURIComponent(
          JSON.stringify({
            version: 1,
            essential: false,
            analytics: true,
            updatedAt: '2026-03-02T00:00:00.000Z',
          }),
        ),
      ),
    ).toBeNull();
    expect(
      parseCookieConsentPreferences(
        encodeURIComponent(
          JSON.stringify({
            version: 1,
            essential: true,
            analytics: 'yes',
            updatedAt: '2026-03-02T00:00:00.000Z',
          }),
        ),
      ),
    ).toBeNull();
  });

  it('treats missing version as outdated consent payload', () => {
    const parsed = parseCookieConsentPreferences(
      encodeURIComponent(
        JSON.stringify({
          essential: true,
          analytics: true,
          updatedAt: '2026-03-02T00:00:00.000Z',
        }),
      ),
    );

    expect(parsed?.version).toBe(0);
    expect(isCookieConsentCurrent(parsed ?? null)).toBe(false);
  });

  it('detects analytics consent', () => {
    expect(hasAnalyticsConsent(null)).toBe(false);
    expect(
      hasAnalyticsConsent({
        version: 1,
        essential: true,
        analytics: false,
        updatedAt: '2026-03-02T00:00:00.000Z',
      }),
    ).toBe(false);
    expect(
      hasAnalyticsConsent({
        version: 1,
        essential: true,
        analytics: true,
        updatedAt: '2026-03-02T00:00:00.000Z',
      }),
    ).toBe(true);
  });

  it('requires current version for valid analytics consent', () => {
    expect(
      hasValidAnalyticsConsent({
        version: COOKIE_CONSENT_VERSION - 1,
        essential: true,
        analytics: true,
        updatedAt: '2026-03-02T00:00:00.000Z',
      }),
    ).toBe(false);
    expect(
      hasValidAnalyticsConsent({
        version: COOKIE_CONSENT_VERSION,
        essential: true,
        analytics: true,
        updatedAt: '2026-03-02T00:00:00.000Z',
      }),
    ).toBe(true);
  });
});
