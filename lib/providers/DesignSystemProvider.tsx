'use client';

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nProvider, RouterProvider } from 'react-aria-components';
import { useRouter } from 'next/navigation';
import { NavigationPrefetchContext } from '@/components/core/Navigation/navigation-prefetch';
import { DEFAULT_LOCALE, type SupportedLocale } from '@/lib/i18n/locale';
import {
  createCookieBackedColorSchemeManager,
  resolveComputedColorScheme,
  type ColorScheme,
} from '@/lib/theme/color-scheme';
import { applyDocumentTheme } from '@/lib/theme/document-theme';
import { getThemeDefinition, type ThemeId } from '@/lib/theme/themes';

interface ThemeContextValue {
  colorScheme: ColorScheme;
  computedColorScheme: 'light' | 'dark';
  themeId: ThemeId;
  setColorScheme: (scheme: ColorScheme) => void;
  toggleColorScheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const ThemeDepthContext = createContext(0);
const ForcedThemeContext = createContext<ThemeId | undefined>(undefined);

export interface DesignSystemProviderProps {
  children: ReactNode;
  locale?: SupportedLocale;
  defaultColorScheme?: ColorScheme;
  /** Storybook and deterministic previews never write the user's stored preference. */
  forceColorScheme?: 'light' | 'dark';
  /** Review preset; overrides existing semantic roles and never persists a preference. */
  forceTheme?: ThemeId;
}

export function DesignSystemProvider({
  children,
  locale = DEFAULT_LOCALE,
  defaultColorScheme = 'auto',
  forceColorScheme,
  forceTheme,
}: DesignSystemProviderProps) {
  const parentDepth = useContext(ThemeDepthContext);
  const inheritedForcedTheme = useContext(ForcedThemeContext);
  const manager = useMemo(() => createCookieBackedColorSchemeManager(), []);
  const [preference, setPreference] = useState(defaultColorScheme);
  const [prefersDark, setPrefersDark] = useState(false);
  const forcedTheme = forceTheme ?? forceColorScheme ?? inheritedForcedTheme;
  const themeId = forcedTheme ?? resolveComputedColorScheme(preference, prefersDark);
  const computedColorScheme = getThemeDefinition(themeId).base;

  useLayoutEffect(() => {
    if (forcedTheme) {
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    setPreference(manager.get(defaultColorScheme));
    setPrefersDark(media.matches);
    const update = () => setPrefersDark(media.matches);
    media.addEventListener('change', update);
    manager.subscribe(setPreference);
    return () => {
      media.removeEventListener('change', update);
      manager.unsubscribe();
    };
  }, [defaultColorScheme, forcedTheme, manager]);

  useLayoutEffect(() => {
    return applyDocumentTheme(document, themeId, parentDepth);
  }, [themeId, parentDepth]);

  const setColorScheme = useCallback(
    (scheme: ColorScheme) => {
      if (forcedTheme) {
        return;
      }
      manager.set(scheme);
      setPreference(scheme);
    },
    [forcedTheme, manager],
  );
  const value = useMemo<ThemeContextValue>(
    () => ({
      colorScheme: forcedTheme ? computedColorScheme : preference,
      computedColorScheme,
      themeId,
      setColorScheme,
      toggleColorScheme: () => setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark'),
    }),
    [computedColorScheme, forcedTheme, preference, setColorScheme, themeId],
  );

  return (
    <ThemeContext.Provider value={value}>
      <ThemeDepthContext.Provider value={parentDepth + 1}>
        <ForcedThemeContext.Provider value={forcedTheme}>
          <I18nProvider locale={locale}>{children}</I18nProvider>
        </ForcedThemeContext.Provider>
      </ThemeDepthContext.Provider>
    </ThemeContext.Provider>
  );
}

/** Kept separate so Storybook does not require a Next app-router context. */
export function AppDesignSystemRouter({ children }: { children: ReactNode }) {
  const router = useRouter();
  const prefetch = useCallback(
    (href: string) => {
      if (href.startsWith('/') && !href.startsWith('//')) {
        router.prefetch(href);
      }
    },
    [router],
  );
  return (
    <NavigationPrefetchContext.Provider value={prefetch}>
      <RouterProvider
        navigate={(href, options) => {
          if (options?.replace) {
            router.replace(href, { scroll: options.scroll });
          } else {
            router.push(href, { scroll: options?.scroll });
          }
        }}
      >
        {children}
      </RouterProvider>
    </NavigationPrefetchContext.Provider>
  );
}

export function useColorScheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useColorScheme requires DesignSystemProvider.');
  }
  return context;
}

export function useComputedColorScheme() {
  return useColorScheme().computedColorScheme;
}
