'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  TranslationEntityType,
  type TranslationEntry,
  type TranslationLocale,
} from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { useQuery } from '@tanstack/react-query';
import { createTranslationClient } from '@/lib/api/browser-client';
import { getSupportedLocaleOptions, normalizeLocale } from '@/lib/i18n/locale';
import { CONTENT_LANGUAGE_QUERY_PARAM } from '@/lib/translation/content-language';
import { extractTranslationContentPreview } from '@/lib/translation/contentPreview';
import type { OgGenerationRunSignal } from '@/lib/types/og-generation';
import type { TranslationLocaleSelectOption } from './locale-option-format';

export type EditorTranslationEntityType =
  | 'artist'
  | 'campaign'
  | 'email_layout'
  | 'email_template'
  | 'form'
  | 'label'
  | 'menu'
  | 'page'
  | 'post'
  | 'post_series'
  | 'program_event'
  | 'privacy'
  | 'release'
  | 'terms'
  | 'work';

export interface UseActiveEditLocaleInput {
  entityType: EditorTranslationEntityType;
  entityId: string;
  sourceTitle: string;
  sourceSummary: string;
  initialSourceLocale?: string | null;
  initialRequestedLocale?: string | null;
  initialRequestedLocaleHasEntry?: boolean;
  initialRequestedLocaleTitle?: string | null;
  initialRequestedLocaleSummary?: string | null;
  enabled?: boolean;
}

export interface UseActiveEditLocaleResult {
  isControlVisible: boolean;
  isLoading: boolean;
  isSourceLocaleReady: boolean;
  activeLocale: string | null;
  activeLocaleLabel: string | null;
  sourceLocale: string | null;
  sourceLocaleLabel: string | null;
  localeOptions: TranslationLocaleSelectOption[];
  isSourceLocale: boolean;
  hasLiveRow: boolean;
  canEditActiveLocale: boolean;
  displayTitle: string;
  displaySummary: string;
  displayOgImageUrl: string | null;
  ogGenerationRun: OgGenerationRunSignal | null;
  contentHtml?: string;
  contentPreview: string;
  contentJson?: Uint8Array;
  contentPreviewLoading: boolean;
  setActiveLocale: (locale: string) => void;
}

const translationLocalesQueryKey = ['translation-locales'] as const;

export function resolveRequestedActiveEditLocale(input: {
  requestedLocale: string | null;
  sourceLocale: string | null;
  availableLocales: readonly string[];
}): string | null {
  const requestedLocale = normalizeLocale(input.requestedLocale);
  return requestedLocale && input.availableLocales.includes(requestedLocale) ? requestedLocale : input.sourceLocale;
}

export function buildActiveEditLocaleHref(
  pathname: string,
  searchParams: { toString: () => string },
  locale: string,
): string {
  const params = new URLSearchParams(searchParams.toString());
  params.set(CONTENT_LANGUAGE_QUERY_PARAM, locale);
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export function buildAvailableEditLocales(input: {
  sourceLocale: string | null;
  localeOptions: readonly TranslationLocaleSelectOption[];
  supportedLocaleOptions: readonly { value: string }[];
}): string[] {
  const seen = new Set<string>();
  for (const code of [
    input.sourceLocale,
    ...input.supportedLocaleOptions.map((option) => option.value),
    ...input.localeOptions.map((option) => option.value),
  ]) {
    const normalized = normalizeLocale(code);
    if (normalized) {
      seen.add(normalized);
    }
  }
  return [...seen];
}

export function shouldUseSourceLocaleDisplayFallback(input: {
  activeLocale: string | null;
  isSourceLocale: boolean;
  entriesLoading: boolean;
  hasLiveRow: boolean;
}): boolean {
  return Boolean(input.activeLocale) && !input.isSourceLocale && !input.hasLiveRow;
}

export function isSourceLocaleResolutionReady(input: {
  enabled: boolean;
  sourceLocale: string | null | undefined;
  entriesResolved: boolean;
  entriesError: unknown;
}): boolean {
  return (
    !input.enabled ||
    (input.entriesResolved && input.entriesError == null && normalizeLocale(input.sourceLocale) !== null)
  );
}

export function resolveRequestedLocalePrefetch(input: {
  initialRequestedLocale: string | null;
  initialRequestedLocaleHasEntry: boolean;
  activeLocale: string | null;
  sourceLocale: string | null;
}): { hasEntry: boolean } {
  const matchesRequestedTarget =
    input.activeLocale === normalizeLocale(input.initialRequestedLocale) && input.activeLocale !== input.sourceLocale;
  const hasEntry = input.initialRequestedLocaleHasEntry && matchesRequestedTarget;
  return { hasEntry };
}

function translationEntityTypeFor(entityType: EditorTranslationEntityType): TranslationEntityType {
  const types: Record<EditorTranslationEntityType, TranslationEntityType> = {
    artist: TranslationEntityType.ARTIST,
    campaign: TranslationEntityType.CAMPAIGN,
    email_layout: TranslationEntityType.EMAIL_LAYOUT,
    email_template: TranslationEntityType.EMAIL_TEMPLATE,
    form: TranslationEntityType.FORM,
    label: TranslationEntityType.LABEL,
    menu: TranslationEntityType.MENU,
    page: TranslationEntityType.PAGE,
    post: TranslationEntityType.POST,
    post_series: TranslationEntityType.POST_SERIES,
    program_event: TranslationEntityType.PROGRAM_EVENT,
    privacy: TranslationEntityType.PRIVACY,
    release: TranslationEntityType.RELEASE,
    terms: TranslationEntityType.TERMS,
    work: TranslationEntityType.WORK,
  };
  return types[entityType];
}

export function useActiveEditLocale({
  entityType,
  entityId,
  sourceTitle,
  sourceSummary,
  initialSourceLocale = null,
  initialRequestedLocale = null,
  initialRequestedLocaleHasEntry = false,
  initialRequestedLocaleTitle = null,
  initialRequestedLocaleSummary = null,
  enabled = true,
}: UseActiveEditLocaleInput): UseActiveEditLocaleResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const translationClient = useMemo(() => createTranslationClient(), []);
  const supportedLocaleOptions = useMemo(() => getSupportedLocaleOptions(), []);
  const normalizedInitialSourceLocale = normalizeLocale(initialSourceLocale);
  const normalizedInitialRequestedLocale = normalizeLocale(initialRequestedLocale);
  const entriesQueryKey = useMemo(() => ['entity-translations', entityType, entityId] as const, [entityId, entityType]);

  const localesQuery = useQuery({
    queryKey: translationLocalesQueryKey,
    queryFn: async () => {
      const response = await translationClient.listTranslationLocales({});
      return response.locales.filter((item) => item.enabled);
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
  const entriesQuery = useQuery({
    queryKey: entriesQueryKey,
    queryFn: () =>
      translationClient.listEntityTranslations({
        target: { entityType: translationEntityTypeFor(entityType), entityId },
      }),
    enabled,
  });

  const sourceLocale = normalizeLocale(entriesQuery.data?.sourceLocale) ?? normalizedInitialSourceLocale;
  const localeOptions = useMemo<TranslationLocaleSelectOption[]>(() => {
    const values = new Map<string, TranslationLocaleSelectOption>();
    const add = (code: string) => {
      const normalized = normalizeLocale(code);
      if (!normalized || values.has(normalized)) {
        return;
      }
      values.set(normalized, {
        value: normalized,
        label: supportedLocaleOptions.find((option) => option.value === normalized)?.label ?? normalized,
        isSource: normalized === sourceLocale,
      });
    };
    if (sourceLocale) {
      add(sourceLocale);
    }
    (localesQuery.data ?? []).forEach((locale: TranslationLocale) => add(locale.code));
    return [...values.values()];
  }, [localesQuery.data, sourceLocale, supportedLocaleOptions]);
  const availableLocales = useMemo(
    () => buildAvailableEditLocales({ sourceLocale, localeOptions, supportedLocaleOptions }),
    [localeOptions, sourceLocale, supportedLocaleOptions],
  );
  const requestedLocale =
    normalizeLocale(searchParams.get(CONTENT_LANGUAGE_QUERY_PARAM)) ?? normalizedInitialRequestedLocale;
  const activeLocale = enabled
    ? resolveRequestedActiveEditLocale({ requestedLocale, sourceLocale, availableLocales })
    : null;

  useEffect(() => {
    if (!pathname || !activeLocale || requestedLocale === activeLocale) {
      return;
    }
    router.replace(buildActiveEditLocaleHref(pathname, searchParams, activeLocale), { scroll: false });
  }, [activeLocale, pathname, requestedLocale, router, searchParams]);

  const entryByLocale = useMemo(
    () => new Map((entriesQuery.data?.entries ?? []).map((entry: TranslationEntry) => [entry.locale, entry])),
    [entriesQuery.data?.entries],
  );
  const isSourceLocale = !activeLocale || activeLocale === sourceLocale;
  const activeEntry = activeLocale ? entryByLocale.get(activeLocale) : undefined;
  const prefetchedRequestedLocale = resolveRequestedLocalePrefetch({
    initialRequestedLocale: normalizedInitialRequestedLocale,
    initialRequestedLocaleHasEntry,
    activeLocale,
    sourceLocale,
  });
  const hasLiveRow = isSourceLocale || Boolean(activeEntry) || prefetchedRequestedLocale.hasEntry;
  const detailQuery = useQuery({
    queryKey: [...entriesQueryKey, 'preview', activeLocale ?? ''],
    queryFn: () =>
      translationClient.getEntityTranslation({
        target: { entityType: translationEntityTypeFor(entityType), entityId },
        locale: activeLocale ?? '',
      }),
    enabled: enabled && Boolean(activeLocale) && !isSourceLocale && Boolean(activeEntry),
    retry: false,
  });
  const detailEntry = detailQuery.data?.entry ?? activeEntry;
  const displayTitle = isSourceLocale
    ? sourceTitle
    : (detailEntry?.title ?? (prefetchedRequestedLocale.hasEntry ? initialRequestedLocaleTitle : null) ?? sourceTitle);
  const displaySummary = isSourceLocale
    ? sourceSummary
    : (detailEntry?.summary ??
      (prefetchedRequestedLocale.hasEntry ? initialRequestedLocaleSummary : null) ??
      sourceSummary);
  const contentPreview = !isSourceLocale
    ? detailEntry?.contentText?.trim() || extractTranslationContentPreview(detailEntry?.contentJson) || ''
    : '';

  const setActiveLocale = useCallback(
    (locale: string) => {
      const normalized = normalizeLocale(locale);
      if (pathname && normalized) {
        router.replace(buildActiveEditLocaleHref(pathname, searchParams, normalized), { scroll: false });
      }
    },
    [pathname, router, searchParams],
  );
  return {
    isControlVisible: enabled && localeOptions.length > 0,
    isLoading: localesQuery.isLoading || entriesQuery.isLoading,
    isSourceLocaleReady: isSourceLocaleResolutionReady({
      enabled,
      sourceLocale: entriesQuery.data?.sourceLocale ?? normalizedInitialSourceLocale,
      entriesResolved: entriesQuery.isSuccess || Boolean(normalizedInitialSourceLocale),
      entriesError: entriesQuery.error,
    }),
    activeLocale,
    activeLocaleLabel: localeOptions.find((option) => option.value === activeLocale)?.label ?? activeLocale,
    sourceLocale,
    sourceLocaleLabel: localeOptions.find((option) => option.value === sourceLocale)?.label ?? sourceLocale,
    localeOptions,
    isSourceLocale,
    hasLiveRow,
    canEditActiveLocale: hasLiveRow,
    displayTitle,
    displaySummary,
    displayOgImageUrl: detailEntry?.ogAsset?.url ?? null,
    ogGenerationRun: null,
    contentHtml: detailEntry?.contentHtml,
    contentPreview,
    contentJson: detailEntry?.contentJson,
    contentPreviewLoading: detailQuery.isLoading,
    setActiveLocale,
  };
}
