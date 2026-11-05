'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getProtoTranslationEntityType,
  type TranslationEntityTypeKey,
} from '@/features/translation/translation-entity-type';
import { useTranslationClient } from './TranslationServicesContext';

const LOCALES_QUERY_KEY = ['translation-locales'] as const;

interface EntityTranslationDataOptions {
  entityType: TranslationEntityTypeKey;
  entityId: string;
}

export function useEntityTranslationData({ entityType, entityId }: EntityTranslationDataOptions) {
  const queryClient = useQueryClient();
  const translationClient = useTranslationClient();
  const target = useMemo(
    () => ({ entityType: getProtoTranslationEntityType(entityType), entityId }),
    [entityId, entityType],
  );
  const entriesQueryKey = useMemo(() => ['entity-translations', entityType, entityId] as const, [entityId, entityType]);

  const localesQuery = useQuery({
    queryKey: LOCALES_QUERY_KEY,
    queryFn: async () => {
      const response = await translationClient.listTranslationLocales({});
      return response.locales.filter((locale) => locale.enabled);
    },
    staleTime: 5 * 60 * 1000,
  });
  const entriesQuery = useQuery({
    queryKey: entriesQueryKey,
    queryFn: () => translationClient.listEntityTranslations({ target }),
  });

  const refreshEntries = useCallback(
    () => queryClient.invalidateQueries({ queryKey: entriesQueryKey }),
    [entriesQueryKey, queryClient],
  );

  return {
    translationClient,
    target,
    entriesQueryKey,
    localesQuery,
    entriesQuery,
    refreshEntries,
  };
}
