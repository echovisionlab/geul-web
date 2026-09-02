'use client';

import { createContext, useContext } from 'react';
import { DEFAULT_LOCALE, type SupportedLocale } from '@/lib/i18n/locale';

const LocaleContext = createContext<SupportedLocale>(DEFAULT_LOCALE);

interface LocaleProviderProps {
  locale: SupportedLocale;
  children: React.ReactNode;
}

export function LocaleProvider({ locale, children }: LocaleProviderProps) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): SupportedLocale {
  return useContext(LocaleContext);
}
