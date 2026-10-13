'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslationClient } from './TranslationServicesContext';

const translationSettingsQueryKey = ['translation-settings'] as const;

export function useTranslationGenerationAvailability(enabled = true) {
  const translationClient = useTranslationClient();
  return useQuery({
    queryKey: translationSettingsQueryKey,
    queryFn: async () => translationClient.getTranslationSettings({}),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function isTranslationGenerationUnavailable(query: ReturnType<typeof useTranslationGenerationAvailability>) {
  return query.isLoading || query.isError || !query.data?.generationEnabled;
}
