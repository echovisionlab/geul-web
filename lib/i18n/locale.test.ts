import { describe, expect, it } from 'vitest';
import { getLocaleDirection, normalizeLocale, resolveDisplayedLocale, resolveRequestedLocale } from './locale';

describe('normalizeLocale', () => {
  it('normalizes direct matches, underscores, and language aliases', () => {
    expect(normalizeLocale(' ko ')).toBe('ko');
    expect(normalizeLocale('pt_BR')).toBe('pt-BR');
    expect(normalizeLocale('pt-PT')).toBe('pt-PT');
    expect(normalizeLocale('es-419')).toBe('es-419');
    expect(normalizeLocale('es-MX')).toBe('es-419');
    expect(normalizeLocale('es-ES')).toBe('es');
    expect(normalizeLocale('id-ID')).toBe('id');
    expect(normalizeLocale('ru-RU')).toBe('ru');
    expect(normalizeLocale('fr-CA')).toBe('fr');
  });

  it('maps chinese variants to the supported traditional and simplified locales', () => {
    expect(normalizeLocale('zh')).toBe('zh-CN');
    expect(normalizeLocale('zh-Hans')).toBe('zh-CN');
    expect(normalizeLocale('zh-Hant')).toBe('zh-TW');
    expect(normalizeLocale('zh-HK')).toBe('zh-TW');
  });

  it('returns null for unsupported locales and empty input', () => {
    expect(normalizeLocale('')).toBeNull();
    expect(normalizeLocale('   ')).toBeNull();
    expect(normalizeLocale('xx')).toBeNull();
    expect(normalizeLocale(null)).toBeNull();
  });
});

describe('getLocaleDirection', () => {
  it('uses locale metadata and falls back to english for unknown locales', () => {
    expect(getLocaleDirection('ar')).toBe('rtl');
    expect(getLocaleDirection('ko')).toBe('ltr');
    expect(getLocaleDirection('unknown-locale')).toBe('ltr');
  });
});

describe('resolveRequestedLocale', () => {
  it('prefers route locale over user preference, cookie, and accept-language', () => {
    expect(
      resolveRequestedLocale({
        routeLocale: 'ja',
        userPreferenceLocale: 'ko',
        cookieLocale: 'fr',
        acceptLanguages: ['de-DE'],
      }),
    ).toMatchObject({
      locale: 'ja',
      source: 'route',
      matchedFrom: 'ja',
    });
  });

  it('falls back through explicit candidates, accept-language, and finally default', () => {
    expect(
      resolveRequestedLocale({
        routeLocale: 'xx',
        userPreferenceLocale: 'pt-PT',
        cookieLocale: 'fr',
        acceptLanguages: ['de-DE'],
      }),
    ).toMatchObject({
      locale: 'pt-PT',
      source: 'user_preference',
      matchedFrom: 'pt-PT',
    });

    expect(
      resolveRequestedLocale({
        routeLocale: 'xx',
        userPreferenceLocale: null,
        cookieLocale: 'xx',
        acceptLanguages: ['zh-Hant'],
      }),
    ).toMatchObject({
      locale: 'zh-TW',
      source: 'accept_language',
      matchedFrom: 'zh-Hant',
    });

    expect(resolveRequestedLocale({})).toMatchObject({
      locale: 'en',
      source: 'default',
      matchedFrom: null,
    });
  });
});

describe('resolveDisplayedLocale', () => {
  it('uses the requested locale when it is published', () => {
    expect(
      resolveDisplayedLocale({
        requestedLocale: 'ko',
        sourceLocale: 'en',
        availablePublishedLocales: ['ko', 'en'],
      }),
    ).toMatchObject({
      requestedLocale: 'ko',
      displayedLocale: 'ko',
      reason: 'requested',
      isFallback: false,
      isOriginal: false,
    });
  });

  it('falls back to the source when a requested target is not current', () => {
    expect(
      resolveDisplayedLocale({
        requestedLocale: 'ko',
        sourceLocale: 'en',
        availablePublishedLocales: ['en'],
      }),
    ).toMatchObject({
      displayedLocale: 'en',
      reason: 'fallback_source',
      isFallback: true,
      isOriginal: true,
    });
  });

  it('does not use english as an intermediate fallback', () => {
    expect(
      resolveDisplayedLocale({
        requestedLocale: 'ja',
        sourceLocale: 'ko',
        availablePublishedLocales: ['en'],
      }),
    ).toMatchObject({
      displayedLocale: 'ko',
      reason: 'fallback_source',
      isFallback: true,
      isOriginal: true,
    });

    expect(
      resolveDisplayedLocale({
        requestedLocale: 'ja',
        sourceLocale: 'ko',
        availablePublishedLocales: [],
      }),
    ).toMatchObject({
      displayedLocale: 'ko',
      reason: 'fallback_source',
      isFallback: true,
      isOriginal: true,
    });
  });

  it('honors source overrides regardless of published locale availability', () => {
    expect(
      resolveDisplayedLocale({
        requestedLocale: 'ja',
        sourceLocale: 'ko',
        availablePublishedLocales: ['ja', 'en'],
        preferSourceLocale: true,
      }),
    ).toMatchObject({
      displayedLocale: 'ko',
      reason: 'source_override',
      isFallback: true,
      isOriginal: true,
    });
  });
});
