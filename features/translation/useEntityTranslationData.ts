'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { FilterOp } from '@echovisionlab/geul-proto/common/common_pb.ts';
import type { TranslationJob } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProtoTranslationEntityType } from '@/features/translation/translation-entity-type';
import { createTranslationClient } from '@/lib/api/browser-client';
import { translationJobEntityTypeFilterValue, type TranslationEntityTypeKey } from '@/lib/translation/lifecycle';
import {
  filterActiveTranslationJobs,
  shouldRefreshTranslationEntries,
  translationJobsRefetchInterval,
} from './translation-job-polling';

const LOCALES_QUERY_KEY = ['translation-locales'] as const;

function entityTranslationJobsQueryKey(entityType: TranslationEntityTypeKey, entityId: string) {
  return ['entity-translation-jobs', entityType, entityId] as const;
}

function entityTranslationAllJobsQueryKey(entityType: TranslationEntityTypeKey, entityId: string) {
  return [...entityTranslationJobsQueryKey(entityType, entityId), 'all'] as const;
}

interface EntityTranslationDataOptions {
  entityType: TranslationEntityTypeKey;
  entityId: string;
  jobsEnabled?: boolean;
}

export function useEntityTranslationData({ entityType, entityId, jobsEnabled = true }: EntityTranslationDataOptions) {
  const queryClient = useQueryClient();
  const translationClient = useMemo(() => createTranslationClient(), []);
  const target = useMemo(
    () => ({ entityType: getProtoTranslationEntityType(entityType), entityId }),
    [entityId, entityType],
  );
  const entriesQueryKey = useMemo(() => ['entity-translations', entityType, entityId] as const, [entityId, entityType]);
  const jobsQueryBaseKey = useMemo(() => entityTranslationJobsQueryKey(entityType, entityId), [entityId, entityType]);
  const jobsQueryKey = useMemo(() => entityTranslationAllJobsQueryKey(entityType, entityId), [entityId, entityType]);
  const previousJobsRef = useRef<TranslationJob[] | undefined>(undefined);
  const previousJobsTargetRef = useRef(`${entityType}:${entityId}`);

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
  const jobsQuery = useQuery({
    queryKey: jobsQueryKey,
    queryFn: async () => {
      const response = await translationClient.listTranslationJobs({
        pagination: { limit: 100, offset: 0 },
        filters: [
          {
            field: 'entity_type',
            op: FilterOp.EQ,
            value: translationJobEntityTypeFilterValue(entityType),
          },
          { field: 'entity_id', op: FilterOp.EQ, value: entityId },
        ],
      });
      return { ...response, jobs: filterActiveTranslationJobs(response.jobs) };
    },
    enabled: jobsEnabled,
    refetchInterval: (query) => translationJobsRefetchInterval(query.state.data?.jobs, query.state.error),
  });

  useEffect(() => {
    const jobsTarget = `${entityType}:${entityId}`;
    if (previousJobsTargetRef.current !== jobsTarget) {
      previousJobsTargetRef.current = jobsTarget;
      previousJobsRef.current = undefined;
    }

    const currentJobs = jobsQuery.data?.jobs;
    if (currentJobs == null) {
      return;
    }

    if (shouldRefreshTranslationEntries(previousJobsRef.current, currentJobs)) {
      void queryClient.invalidateQueries({ queryKey: entriesQueryKey });
    }
    previousJobsRef.current = currentJobs;
  }, [entityId, entityType, entriesQueryKey, jobsQuery.data?.jobs, jobsQuery.dataUpdatedAt, queryClient]);

  const refreshEntries = useCallback(
    () => queryClient.invalidateQueries({ queryKey: entriesQueryKey }),
    [entriesQueryKey, queryClient],
  );
  const refreshJobs = useCallback(
    () => queryClient.invalidateQueries({ queryKey: jobsQueryBaseKey }),
    [jobsQueryBaseKey, queryClient],
  );

  return {
    translationClient,
    target,
    entriesQueryKey,
    localesQuery,
    entriesQuery,
    jobsQuery,
    refreshEntries,
    refreshJobs,
  };
}
