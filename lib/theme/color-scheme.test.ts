// @vitest-environment jsdom

import vm from 'node:vm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildInitialColorSchemeScript,
  COLOR_SCHEME_STORAGE_KEY,
  createCookieBackedColorSchemeManager,
  normalizeColorScheme,
  readColorSchemeCookie,
  resolveComputedColorScheme,
  resolveInitialHtmlColorScheme,
} from './color-scheme';

function runBootstrap({
  cookieColorScheme,
  localStorageColorScheme = null,
  prefersDark,
}: {
  cookieColorScheme: 'light' | 'dark' | 'auto' | null;
  localStorageColorScheme?: string | null;
  prefersDark: boolean;
}) {
  const storage = new Map<string, string>();
  if (localStorageColorScheme !== null) {
    storage.set(COLOR_SCHEME_STORAGE_KEY, localStorageColorScheme);
  }
  let htmlColorScheme: string | null = null;

  vm.runInNewContext(buildInitialColorSchemeScript(cookieColorScheme), {
    window: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
      matchMedia: () => ({ matches: prefersDark }),
    },
    document: {
      documentElement: {
        setAttribute: (name: string, value: string) => {
          if (name === 'data-mantine-color-scheme') {
            htmlColorScheme = value;
          }
        },
      },
    },
  });

  return {
    htmlColorScheme,
    storedColorScheme: storage.get(COLOR_SCHEME_STORAGE_KEY) ?? null,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  document.cookie = `${COLOR_SCHEME_STORAGE_KEY}=; Path=/; Max-Age=0`;
});

afterEach(() => {
  window.localStorage.clear();
  document.cookie = `${COLOR_SCHEME_STORAGE_KEY}=; Path=/; Max-Age=0`;
});

describe('color scheme helpers', () => {
  it('normalizes supported color scheme values', () => {
    expect(normalizeColorScheme('light')).toBe('light');
    expect(normalizeColorScheme('dark')).toBe('dark');
    expect(normalizeColorScheme('auto')).toBe('auto');
    expect(normalizeColorScheme('weird')).toBeNull();
  });

  it('reads color scheme cookie values', () => {
    expect(readColorSchemeCookie('mantine-color-scheme-value=dark')).toBe('dark');
    expect(readColorSchemeCookie('foo=bar; mantine-color-scheme-value=light')).toBe('light');
    expect(readColorSchemeCookie('foo=bar')).toBeNull();
  });

  it('only emits explicit light or dark html color schemes', () => {
    expect(resolveInitialHtmlColorScheme('dark')).toBe('dark');
    expect(resolveInitialHtmlColorScheme('light')).toBe('light');
    expect(resolveInitialHtmlColorScheme('auto')).toBeUndefined();
    expect(resolveInitialHtmlColorScheme(null)).toBeUndefined();
  });

  it('resolves automatic and missing preferences against the system scheme', () => {
    expect(resolveComputedColorScheme('auto', false)).toBe('light');
    expect(resolveComputedColorScheme('auto', true)).toBe('dark');
    expect(resolveComputedColorScheme(null, true)).toBe('dark');
    expect(resolveComputedColorScheme('light', true)).toBe('light');
    expect(resolveComputedColorScheme('dark', false)).toBe('dark');
  });

  it.each([
    { cookieColorScheme: 'light' as const, staleStorage: 'dark', prefersDark: true, expected: 'light' },
    { cookieColorScheme: 'dark' as const, staleStorage: 'light', prefersDark: false, expected: 'dark' },
    { cookieColorScheme: 'auto' as const, staleStorage: 'light', prefersDark: true, expected: 'dark' },
  ])(
    'applies $cookieColorScheme cookie preference before first paint and replaces stale storage',
    ({ cookieColorScheme, staleStorage, prefersDark, expected }) => {
      expect(runBootstrap({ cookieColorScheme, localStorageColorScheme: staleStorage, prefersDark })).toEqual({
        htmlColorScheme: expected,
        storedColorScheme: cookieColorScheme,
      });
    },
  );

  it.each([
    { prefersDark: false, expected: 'light' },
    { prefersDark: true, expected: 'dark' },
  ])('uses the system scheme before first paint when no preference exists', ({ prefersDark, expected }) => {
    expect(runBootstrap({ cookieColorScheme: null, prefersDark })).toEqual({
      htmlColorScheme: expected,
      storedColorScheme: null,
    });
  });

  it('retains the manager localStorage fallback when the cookie is absent', () => {
    expect(runBootstrap({ cookieColorScheme: null, localStorageColorScheme: 'dark', prefersDark: false })).toEqual({
      htmlColorScheme: 'dark',
      storedColorScheme: 'dark',
    });
  });

  it('keeps cookie precedence and the pre-paint scheme stable through manager hydration', () => {
    document.cookie = `${COLOR_SCHEME_STORAGE_KEY}=auto; Path=/`;
    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, 'light');
    const beforeHydration = runBootstrap({
      cookieColorScheme: 'auto',
      localStorageColorScheme: 'light',
      prefersDark: true,
    });

    const hydratedPreference = createCookieBackedColorSchemeManager().get('light');

    expect(hydratedPreference).toBe('auto');
    expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe('auto');
    expect(resolveComputedColorScheme(hydratedPreference, true)).toBe(beforeHydration.htmlColorScheme);
  });
});
