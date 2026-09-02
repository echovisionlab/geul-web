export const SUPPORTED_LOCALES = [
  'en',
  'ko',
  'ja',
  'zh-CN',
  'zh-TW',
  'es',
  'es-419',
  'fr',
  'de',
  'pt-BR',
  'pt-PT',
  'it',
  'nl',
  'ar',
  'id',
  'vi',
  'th',
  'tr',
  'pl',
  'ru',
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type LocaleDirection = 'ltr' | 'rtl';
export type LocaleFontProfile =
  'latin' | 'korean' | 'japanese' | 'chinese-simplified' | 'chinese-traditional' | 'arabic';
export type RequestLocaleSource = 'route' | 'user_preference' | 'cookie' | 'accept_language' | 'default';
export type DisplayedLocaleReason = 'requested' | 'fallback_source' | 'source_override';

export interface LocaleDefinition {
  locale: SupportedLocale;
  dir: LocaleDirection;
  machineTranslationAllowed: boolean;
  fontProfile: LocaleFontProfile;
  label: string;
}

export interface ResolveRequestedLocaleInput {
  routeLocale?: string | null;
  userPreferenceLocale?: string | null;
  cookieLocale?: string | null;
  acceptLanguages?: readonly string[];
}

export interface ResolvedRequestedLocale {
  locale: SupportedLocale;
  source: RequestLocaleSource;
  matchedFrom: string | null;
  definition: LocaleDefinition;
}

export interface ResolveDisplayedLocaleInput {
  requestedLocale?: string | null;
  sourceLocale?: string | null;
  availablePublishedLocales?: Iterable<string | null | undefined>;
  preferSourceLocale?: boolean;
}

export interface ResolvedDisplayedLocale {
  requestedLocale: SupportedLocale;
  displayedLocale: SupportedLocale;
  sourceLocale: SupportedLocale;
  reason: DisplayedLocaleReason;
  isFallback: boolean;
  isOriginal: boolean;
}

export const DEFAULT_LOCALE: SupportedLocale = 'en';
export const LOCALE_COOKIE_NAME = 'locale';

const LOCALE_REGISTRY: Record<SupportedLocale, LocaleDefinition> = {
  en: {
    locale: 'en',
    dir: 'ltr',
    machineTranslationAllowed: true,
    fontProfile: 'latin',
    label: 'English',
  },
  ko: {
    locale: 'ko',
    dir: 'ltr',
    machineTranslationAllowed: true,
    fontProfile: 'korean',
    label: '한국어',
  },
  ja: {
    locale: 'ja',
    dir: 'ltr',
    machineTranslationAllowed: true,
    fontProfile: 'japanese',
    label: '日本語',
  },
  'zh-CN': {
    locale: 'zh-CN',
    dir: 'ltr',
    machineTranslationAllowed: true,
    fontProfile: 'chinese-simplified',
    label: '简体中文',
  },
  'zh-TW': {
    locale: 'zh-TW',
    dir: 'ltr',
    machineTranslationAllowed: true,
    fontProfile: 'chinese-traditional',
    label: '繁體中文',
  },
  es: {
    locale: 'es',
    dir: 'ltr',
    machineTranslationAllowed: true,
    fontProfile: 'latin',
    label: 'Español',
  },
  'es-419': {
    locale: 'es-419',
    dir: 'ltr',
    machineTranslationAllowed: true,
    fontProfile: 'latin',
    label: 'Español (Latinoamérica)',
  },
  fr: {
    locale: 'fr',
    dir: 'ltr',
    machineTranslationAllowed: true,
    fontProfile: 'latin',
    label: 'Français',
  },
  de: {
    locale: 'de',
    dir: 'ltr',
    machineTranslationAllowed: true,
    fontProfile: 'latin',
    label: 'Deutsch',
  },
  'pt-BR': {
    locale: 'pt-BR',
    dir: 'ltr',
    machineTranslationAllowed: true,
    fontProfile: 'latin',
    label: 'Português (Brasil)',
  },
  'pt-PT': {
    locale: 'pt-PT',
    dir: 'ltr',
    machineTranslationAllowed: true,
    fontProfile: 'latin',
    label: 'Português (Portugal)',
  },
  it: {
    locale: 'it',
    dir: 'ltr',
    machineTranslationAllowed: true,
    fontProfile: 'latin',
    label: 'Italiano',
  },
  nl: {
    locale: 'nl',
    dir: 'ltr',
    machineTranslationAllowed: true,
    fontProfile: 'latin',
    label: 'Nederlands',
  },
  ar: {
    locale: 'ar',
    dir: 'rtl',
    machineTranslationAllowed: true,
    fontProfile: 'arabic',
    label: 'العربية',
  },
  id: {
    locale: 'id',
    dir: 'ltr',
    machineTranslationAllowed: true,
    fontProfile: 'latin',
    label: 'Bahasa Indonesia',
  },
  vi: {
    locale: 'vi',
    dir: 'ltr',
    machineTranslationAllowed: true,
    fontProfile: 'latin',
    label: 'Tiếng Việt',
  },
  th: {
    locale: 'th',
    dir: 'ltr',
    machineTranslationAllowed: true,
    fontProfile: 'latin',
    label: 'ไทย',
  },
  tr: {
    locale: 'tr',
    dir: 'ltr',
    machineTranslationAllowed: true,
    fontProfile: 'latin',
    label: 'Türkçe',
  },
  pl: {
    locale: 'pl',
    dir: 'ltr',
    machineTranslationAllowed: true,
    fontProfile: 'latin',
    label: 'Polski',
  },
  ru: {
    locale: 'ru',
    dir: 'ltr',
    machineTranslationAllowed: true,
    fontProfile: 'latin',
    label: 'Русский',
  },
};

const LANGUAGE_BASE_ALIAS_MAP: Record<string, SupportedLocale> = {
  ar: 'ar',
  de: 'de',
  en: 'en',
  es: 'es',
  fr: 'fr',
  it: 'it',
  ja: 'ja',
  ko: 'ko',
  nl: 'nl',
  pt: 'pt-BR',
  id: 'id',
  pl: 'pl',
  ru: 'ru',
  th: 'th',
  tr: 'tr',
  vi: 'vi',
};

function getSupportedLocaleDefinition(locale: SupportedLocale): LocaleDefinition {
  return LOCALE_REGISTRY[locale];
}

export function getSupportedLocaleOptions(): Array<{ value: SupportedLocale; label: string }> {
  return SUPPORTED_LOCALES.map((locale) => ({
    value: locale,
    label: LOCALE_REGISTRY[locale].label,
  }));
}

export function normalizeLocale(input: string | null | undefined): SupportedLocale | null {
  if (!input) {
    return null;
  }

  const candidate = input.trim().replaceAll('_', '-');
  if (!candidate) {
    return null;
  }

  const directMatch = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === candidate.toLowerCase());
  if (directMatch) {
    return directMatch;
  }

  const lowerCandidate = candidate.toLowerCase();
  if (lowerCandidate === 'zh' || lowerCandidate.startsWith('zh-')) {
    if (
      lowerCandidate === 'zh-tw' ||
      lowerCandidate === 'zh-hk' ||
      lowerCandidate === 'zh-mo' ||
      lowerCandidate.includes('hant')
    ) {
      return 'zh-TW';
    }
    return 'zh-CN';
  }

  if (lowerCandidate === 'es-419') {
    return 'es-419';
  }

  const [, spanishRegion] = lowerCandidate.split('-', 2);
  if (lowerCandidate.startsWith('es-') && (spanishRegion?.length === 2 || spanishRegion?.length === 3)) {
    if (spanishRegion === 'es') {
      return 'es';
    }
    return 'es-419';
  }

  if (lowerCandidate === 'pt-pt') {
    return 'pt-PT';
  }

  if (lowerCandidate === 'pt' || lowerCandidate.startsWith('pt-')) {
    return 'pt-BR';
  }

  const language = lowerCandidate.split('-')[0];
  return LANGUAGE_BASE_ALIAS_MAP[language] ?? null;
}

export function getLocaleDirection(locale: string | null | undefined): LocaleDirection {
  const normalizedLocale = normalizeLocale(locale) ?? DEFAULT_LOCALE;
  return getSupportedLocaleDefinition(normalizedLocale).dir;
}

export function getLocaleFontProfile(locale: string | null | undefined): LocaleFontProfile {
  const normalizedLocale = normalizeLocale(locale) ?? DEFAULT_LOCALE;
  return getSupportedLocaleDefinition(normalizedLocale).fontProfile;
}

export function resolveRequestedLocale(input: ResolveRequestedLocaleInput): ResolvedRequestedLocale {
  const explicitCandidates: Array<{
    source: RequestLocaleSource;
    value: string | null | undefined;
  }> = [
    { source: 'route', value: input.routeLocale },
    { source: 'user_preference', value: input.userPreferenceLocale },
    { source: 'cookie', value: input.cookieLocale },
  ];

  for (const candidate of explicitCandidates) {
    const locale = normalizeLocale(candidate.value);
    if (locale) {
      return {
        locale,
        source: candidate.source,
        matchedFrom: candidate.value ?? null,
        definition: getSupportedLocaleDefinition(locale),
      };
    }
  }

  for (const acceptLanguage of input.acceptLanguages ?? []) {
    const locale = normalizeLocale(acceptLanguage);
    if (locale) {
      return {
        locale,
        source: 'accept_language',
        matchedFrom: acceptLanguage,
        definition: getSupportedLocaleDefinition(locale),
      };
    }
  }

  return {
    locale: DEFAULT_LOCALE,
    source: 'default',
    matchedFrom: null,
    definition: getSupportedLocaleDefinition(DEFAULT_LOCALE),
  };
}

export function resolveDisplayedLocale(input: ResolveDisplayedLocaleInput): ResolvedDisplayedLocale {
  const requestedLocale = normalizeLocale(input.requestedLocale) ?? DEFAULT_LOCALE;
  const sourceLocale = normalizeLocale(input.sourceLocale) ?? DEFAULT_LOCALE;
  const publishedLocales = normalizeLocaleSet(input.availablePublishedLocales);

  if (input.preferSourceLocale) {
    return buildDisplayedLocaleResult(requestedLocale, sourceLocale, sourceLocale, 'source_override');
  }

  if (requestedLocale === sourceLocale || publishedLocales.has(requestedLocale)) {
    return buildDisplayedLocaleResult(requestedLocale, sourceLocale, requestedLocale, 'requested');
  }
  return buildDisplayedLocaleResult(requestedLocale, sourceLocale, sourceLocale, 'fallback_source');
}

function normalizeLocaleSet(values: Iterable<string | null | undefined> | undefined): Set<SupportedLocale> {
  const locales = new Set<SupportedLocale>();
  if (!values) {
    return locales;
  }

  for (const value of values) {
    const locale = normalizeLocale(value);
    if (locale) {
      locales.add(locale);
    }
  }

  return locales;
}

function buildDisplayedLocaleResult(
  requestedLocale: SupportedLocale,
  sourceLocale: SupportedLocale,
  displayedLocale: SupportedLocale,
  reason: DisplayedLocaleReason,
): ResolvedDisplayedLocale {
  return {
    requestedLocale,
    displayedLocale,
    sourceLocale,
    reason,
    isFallback: requestedLocale !== displayedLocale,
    isOriginal: displayedLocale === sourceLocale,
  };
}
