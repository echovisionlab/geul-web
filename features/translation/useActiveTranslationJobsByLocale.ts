'use client';

import { useMemo } from 'react';
import { type TranslationJob } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { useTranslationLifecycleSubscription } from '@/features/translation/useTranslationLifecycleSubscription';
import type { TranslationEntityTypeKey, TranslationLifecycleRefetchHint } from '@/lib/translation/lifecycle';
import { isActiveTranslationJobStatus } from './translation-job-polling';

interface UseActiveTranslationJobsByLocaleInput {
  enabled?: boolean;
  provider?: HocuspocusProvider | null;
  entityType: TranslationEntityTypeKey;
  entityId: string;
  jobs: TranslationJob[] | undefined;
  onLifecycleHint?: (hint: TranslationLifecycleRefetchHint) => Promise<void> | void;
  onReconnect?: () => Promise<void> | void;
}

export function selectActiveTranslationJobsByLocale(jobs: TranslationJob[] | undefined): Map<string, TranslationJob> {
  const activeJobByLocale = new Map<string, TranslationJob>();

  for (const job of jobs ?? []) {
    if (!job.targetLocale || !isActiveTranslationJobStatus(job.status) || activeJobByLocale.has(job.targetLocale)) {
      continue;
    }
    activeJobByLocale.set(job.targetLocale, job);
  }

  return activeJobByLocale;
}

export function useActiveTranslationJobsByLocale({
  enabled = true,
  provider = null,
  entityType,
  entityId,
  jobs,
  onLifecycleHint,
  onReconnect,
}: UseActiveTranslationJobsByLocaleInput) {
  useTranslationLifecycleSubscription({
    enabled,
    provider,
    entityType,
    entityId,
    onEvent: onLifecycleHint,
    onReconnect,
  });

  return useMemo(() => selectActiveTranslationJobsByLocale(jobs), [jobs]);
}
