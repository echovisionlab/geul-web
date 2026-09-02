'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useFormEditorContext } from '@/lib/contexts/FormEditorContext';

interface FormTranslationContextValue {
  activeEditLocale: ReturnType<typeof useFormEditorContext>['activeEditLocale'];
  isEditingScopedLocale: boolean;
}

const FormTranslationContext = createContext<FormTranslationContextValue | null>(null);

export function FormTranslationProvider({ children }: { children: ReactNode }) {
  const { activeEditLocale } = useFormEditorContext();

  const isEditingScopedLocale = Boolean(activeEditLocale.activeLocale) && !activeEditLocale.isSourceLocale;

  const value = useMemo<FormTranslationContextValue>(
    () => ({
      activeEditLocale,
      isEditingScopedLocale,
    }),
    [activeEditLocale, isEditingScopedLocale],
  );

  return <FormTranslationContext.Provider value={value}>{children}</FormTranslationContext.Provider>;
}

export function useFormTranslationContext(): FormTranslationContextValue {
  const context = useContext(FormTranslationContext);
  if (!context) {
    throw new Error('useFormTranslationContext must be used within FormTranslationProvider');
  }
  return context;
}
