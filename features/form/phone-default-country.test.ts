import { describe, expect, it } from 'vitest';
import { inferPhoneCountryCodeFromLocale, resolvePhoneDefaultCountryCode } from './phone-default-country';

describe('phone default country helpers', () => {
  it('prefers explicit field defaults over viewer hints', () => {
    expect(
      resolvePhoneDefaultCountryCode({
        explicitCountryCode: 'DE',
        viewerCountryCode: 'KR',
        viewerLocale: 'ja',
      }),
    ).toBe('DE');
  });

  it('falls back to viewer country code before locale', () => {
    expect(
      resolvePhoneDefaultCountryCode({
        viewerCountryCode: 'FR',
        viewerLocale: 'ko',
      }),
    ).toBe('FR');
  });

  it('infers a sensible country from locale when geo is unavailable', () => {
    expect(inferPhoneCountryCodeFromLocale('pt-BR')).toBe('BR');
    expect(inferPhoneCountryCodeFromLocale('pt-PT')).toBe('PT');
    expect(inferPhoneCountryCodeFromLocale('id-ID')).toBe('ID');
    expect(inferPhoneCountryCodeFromLocale('ru-RU')).toBe('RU');
    expect(inferPhoneCountryCodeFromLocale('ko')).toBe('KR');
    expect(inferPhoneCountryCodeFromLocale('en-US')).toBe('US');
  });
});
