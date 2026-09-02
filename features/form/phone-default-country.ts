import { DEFAULT_COUNTRY_CODE, getCountryByCode } from '@/lib/constants/phone-countries';
import { normalizeLocale } from '@/lib/i18n/locale';

const PHONE_LOCALE_DEFAULT_COUNTRY_MAP: Record<string, string> = {
  ar: 'AE',
  de: 'DE',
  en: 'US',
  es: 'ES',
  id: 'ID',
  fr: 'FR',
  it: 'IT',
  ja: 'JP',
  ko: 'KR',
  nl: 'NL',
  pl: 'PL',
  'pt-BR': 'BR',
  'pt-PT': 'PT',
  ru: 'RU',
  th: 'TH',
  tr: 'TR',
  vi: 'VN',
  'zh-CN': 'CN',
  'zh-TW': 'TW',
};

function normalizeCountryCode(input: string | null | undefined): string | null {
  const candidate = input?.trim().toUpperCase();
  if (!candidate) {
    return null;
  }
  return getCountryByCode(candidate)?.code ?? null;
}

export function inferPhoneCountryCodeFromLocale(input: string | null | undefined): string | null {
  const candidate = input?.trim().replaceAll('_', '-');
  if (!candidate) {
    return null;
  }

  const [, region] = candidate.split('-', 2);
  const directRegionMatch = normalizeCountryCode(region);
  if (directRegionMatch) {
    return directRegionMatch;
  }

  const normalizedLocale = normalizeLocale(candidate);
  if (!normalizedLocale) {
    return null;
  }

  return PHONE_LOCALE_DEFAULT_COUNTRY_MAP[normalizedLocale] ?? null;
}

export function resolvePhoneDefaultCountryCode(options: {
  explicitCountryCode?: string | null;
  viewerCountryCode?: string | null;
  viewerLocale?: string | null;
}): string {
  return (
    normalizeCountryCode(options.explicitCountryCode) ??
    normalizeCountryCode(options.viewerCountryCode) ??
    inferPhoneCountryCodeFromLocale(options.viewerLocale) ??
    DEFAULT_COUNTRY_CODE
  );
}
