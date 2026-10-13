'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createTranslationClient } from '@/lib/api/browser/secure-translation';
import type { mutateAIDocumentTargetTranslation } from '@/lib/ai/document-client';

export interface TranslationServices {
  client: ReturnType<typeof createTranslationClient>;
  mutateTarget: typeof mutateAIDocumentTargetTranslation;
  openLocale?: (locale: string) => void;
}

const TranslationServicesContext = createContext<TranslationServices | null>(null);

/** Embedded authoring supplies transport/commands; permissions and rendering stay in the production view. */
export function TranslationServicesProvider({
  services,
  children,
}: {
  services: TranslationServices;
  children: ReactNode;
}) {
  return <TranslationServicesContext.Provider value={services}>{children}</TranslationServicesContext.Provider>;
}

export function useOptionalTranslationServices() {
  return useContext(TranslationServicesContext);
}

export function useTranslationClient() {
  const services = useOptionalTranslationServices();
  return useMemo(() => services?.client ?? createTranslationClient(), [services?.client]);
}
