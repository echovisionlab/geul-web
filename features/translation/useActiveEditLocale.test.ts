import { describe, expect, it } from 'vitest';
import {
  buildActiveEditLocaleHref,
  buildAvailableEditLocales,
  isSourceLocaleResolutionReady,
  resolveRequestedLocalePrefetch,
  resolveRequestedActiveEditLocale,
  shouldUseSourceLocaleDisplayFallback,
} from './useActiveEditLocale';

describe('useActiveEditLocale helpers', () => {
  it('prefers a requested locale when it is available', () => {
    expect(
      resolveRequestedActiveEditLocale({
        requestedLocale: 'ko',
        sourceLocale: 'en',
        availableLocales: ['en', 'ko', 'ja'],
      }),
    ).toBe('ko');
  });

  it('falls back to the source locale when the requested locale is unavailable', () => {
    expect(
      resolveRequestedActiveEditLocale({
        requestedLocale: 'fr',
        sourceLocale: 'en',
        availableLocales: ['en', 'ko', 'ja'],
      }),
    ).toBe('en');
  });

  it('writes the active locale into the lang query parameter while preserving others', () => {
    expect(buildActiveEditLocaleHref('/page-1', new URLSearchParams('edit=true&tab=settings&foo=bar'), 'ko')).toBe(
      '/page-1?edit=true&tab=settings&foo=bar&lang=ko',
    );
  });

  it('keeps supported locales available before the dynamic locale list finishes loading', () => {
    expect(
      buildAvailableEditLocales({
        sourceLocale: 'en',
        localeOptions: [{ value: 'en', label: 'English', isSource: true }],
        supportedLocaleOptions: [{ value: 'en' }, { value: 'ko' }, { value: 'ja' }],
      }),
    ).toEqual(['en', 'ko', 'ja']);
  });

  it('dedupes and normalizes source, supported, and dynamic locales', () => {
    expect(
      buildAvailableEditLocales({
        sourceLocale: 'pt_BR',
        localeOptions: [
          { value: 'en', label: 'English' },
          { value: 'pt-BR', label: 'Português (Brasil)', isSource: true },
        ],
        supportedLocaleOptions: [{ value: 'pt-PT' }, { value: 'en' }, { value: 'zh-Hant' }],
      }),
    ).toEqual(['pt-BR', 'pt-PT', 'en', 'zh-TW']);
  });

  it('keeps source display values while a requested locale is still loading', () => {
    expect(
      shouldUseSourceLocaleDisplayFallback({
        activeLocale: 'ko',
        isSourceLocale: false,
        entriesLoading: true,
        hasLiveRow: false,
      }),
    ).toBe(true);
  });

  it('stops using the source display fallback after locale data resolves', () => {
    expect(
      shouldUseSourceLocaleDisplayFallback({
        activeLocale: 'ko',
        isSourceLocale: false,
        entriesLoading: false,
        hasLiveRow: true,
      }),
    ).toBe(false);
  });

  it('keeps source values as the missing-target editor fallback', () => {
    expect(
      shouldUseSourceLocaleDisplayFallback({
        activeLocale: 'ko',
        isSourceLocale: false,
        entriesLoading: false,
        hasLiveRow: false,
      }),
    ).toBe(true);
  });

  it('does not use the source display fallback when a live row is already prefetched', () => {
    expect(
      shouldUseSourceLocaleDisplayFallback({
        activeLocale: 'ko',
        isSourceLocale: false,
        entriesLoading: true,
        hasLiveRow: true,
      }),
    ).toBe(false);
  });

  it('keeps a prefetched existing target entry available without lifecycle status', () => {
    expect(
      resolveRequestedLocalePrefetch({
        initialRequestedLocale: 'ko',
        initialRequestedLocaleHasEntry: true,
        activeLocale: 'ko',
        sourceLocale: 'en',
      }),
    ).toEqual({ hasEntry: true });
  });

  it('uses prefetched entry existence only for the same requested target locale', () => {
    expect(
      resolveRequestedLocalePrefetch({
        initialRequestedLocale: 'ko',
        initialRequestedLocaleHasEntry: true,
        activeLocale: 'ja',
        sourceLocale: 'en',
      }),
    ).toEqual({ hasEntry: false });
  });

  it('only marks source-locale ownership ready after the entries query resolves it without an error', () => {
    expect(
      isSourceLocaleResolutionReady({
        enabled: true,
        sourceLocale: null,
        entriesResolved: false,
        entriesError: null,
      }),
    ).toBe(false);
    expect(
      isSourceLocaleResolutionReady({
        enabled: true,
        sourceLocale: 'ko',
        entriesResolved: true,
        entriesError: new Error('translation list failed'),
      }),
    ).toBe(false);
    expect(
      isSourceLocaleResolutionReady({
        enabled: true,
        sourceLocale: 'ko',
        entriesResolved: true,
        entriesError: null,
      }),
    ).toBe(true);
  });
});
