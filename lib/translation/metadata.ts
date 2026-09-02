import type { Metadata } from 'next';
import { DEFAULT_LOCALE, normalizeLocale, SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n/locale';
import { buildContentLanguageHref, readContentLocaleOverride } from '@/lib/translation/content-language';
import { joinUrl } from '@/lib/utils/url';

type QueryLike = Record<string, string | string[] | undefined> | undefined;

interface ContentLocalizationInfoLike {
  requestedLocale?: string | null;
  displayedLocale?: string | null;
  sourceLocale?: string | null;
}

interface LocalizedOgFallbackInput {
  featuredImageUrl?: string | null;
  siteOgImageUrl?: string | null;
}

function isTargetLocalization(localizationInfo: ContentLocalizationInfoLike | null | undefined): boolean {
  const sourceLocale = normalizeLocale(localizationInfo?.sourceLocale);
  const displayedLocale = normalizeLocale(localizationInfo?.displayedLocale);
  return Boolean(sourceLocale && displayedLocale && sourceLocale !== displayedLocale);
}

export function resolveLocalizedMetadataSummary(
  localizationInfo: ContentLocalizationInfoLike | null | undefined,
  localizedSummary: string | null | undefined,
  sourceFallback: string | null | undefined,
): string | null | undefined {
  return isTargetLocalization(localizationInfo) ? localizedSummary : (localizedSummary ?? sourceFallback);
}

/**
 * A translated projection may only use the OG asset generated for
 * that exact target projection. Global/source image fallbacks would mix two
 * locale identities, so keep them disabled until the target OG asset exists.
 */
export function resolveLocalizedOgFallbacks(
  localizationInfo: ContentLocalizationInfoLike | null | undefined,
  input: LocalizedOgFallbackInput,
): LocalizedOgFallbackInput {
  return isTargetLocalization(localizationInfo) ? { featuredImageUrl: null, siteOgImageUrl: null } : input;
}

interface BuildContentMetadataSeoInput {
  canonicalOrigin: string;
  routePath: string;
  query?: QueryLike;
  localizationInfo?: ContentLocalizationInfoLike | null;
}

interface ContentMetadataSeo {
  alternates: NonNullable<Metadata['alternates']>;
  openGraph: {
    url: string;
    locale: string;
    alternateLocale: string[];
  };
  noIndex: boolean;
}

const OPEN_GRAPH_LOCALE: Record<SupportedLocale, string> = {
  en: 'en_US',
  ko: 'ko_KR',
  ja: 'ja_JP',
  'zh-CN': 'zh_CN',
  'zh-TW': 'zh_TW',
  es: 'es_ES',
  'es-419': 'es_MX',
  fr: 'fr_FR',
  de: 'de_DE',
  'pt-BR': 'pt_BR',
  'pt-PT': 'pt_PT',
  it: 'it_IT',
  nl: 'nl_NL',
  ar: 'ar_SA',
  id: 'id_ID',
  vi: 'vi_VN',
  th: 'th_TH',
  tr: 'tr_TR',
  pl: 'pl_PL',
  ru: 'ru_RU',
};

function buildAbsoluteContentHref(
  canonicalOrigin: string,
  routePath: string,
  locale: string | null | undefined,
): string {
  const normalizedLocale = normalizeLocale(locale);
  if (!normalizedLocale || normalizedLocale === DEFAULT_LOCALE) {
    return joinUrl(canonicalOrigin, routePath);
  }

  return joinUrl(
    canonicalOrigin,
    buildContentLanguageHref(routePath, undefined, { requestedLocale: normalizedLocale }),
  );
}

export function buildContentMetadataSeo(input: BuildContentMetadataSeoInput): ContentMetadataSeo {
  const explicitLocale = readContentLocaleOverride(input.query);
  const requestedLocale = normalizeLocale(input.localizationInfo?.requestedLocale) ?? explicitLocale ?? DEFAULT_LOCALE;
  const displayedLocale = normalizeLocale(input.localizationInfo?.displayedLocale) ?? requestedLocale;

  const canonical = explicitLocale
    ? buildAbsoluteContentHref(input.canonicalOrigin, input.routePath, displayedLocale)
    : joinUrl(input.canonicalOrigin, input.routePath);

  const languages = Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [
      locale,
      joinUrl(input.canonicalOrigin, buildContentLanguageHref(input.routePath, undefined, { requestedLocale: locale })),
    ]),
  );
  languages['x-default'] = joinUrl(input.canonicalOrigin, input.routePath);

  return {
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      url: canonical,
      locale: OPEN_GRAPH_LOCALE[displayedLocale],
      alternateLocale: SUPPORTED_LOCALES.filter((locale) => locale !== displayedLocale).map(
        (locale) => OPEN_GRAPH_LOCALE[locale],
      ),
    },
    noIndex: Boolean(explicitLocale && displayedLocale !== explicitLocale),
  };
}

export function applyContentMetadataSeo(metadata: Metadata, seo: ReturnType<typeof buildContentMetadataSeo>): Metadata {
  return {
    ...metadata,
    alternates: seo.alternates,
    ...(metadata.openGraph && {
      openGraph: {
        ...metadata.openGraph,
        ...seo.openGraph,
      },
    }),
  };
}
