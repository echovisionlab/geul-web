'use client';

import { useTranslations } from 'next-intl';
import type { OgGenerationRunState } from '@/lib/types/og-generation';
import { getBoundedOgFailureReason } from '@/lib/og-generation-error';
import { OgGenerationRunProgressView, type OgGenerationRunProgressViewModel } from './ui/OgGenerationRunProgressView';

interface OgGenerationRunProgressProps {
  run?: OgGenerationRunState | null;
  error?: string | null;
}

export function OgGenerationRunProgress({ run, error }: OgGenerationRunProgressProps) {
  const t = useTranslations('ogImageSettings');
  const model: OgGenerationRunProgressViewModel = {
    countLabel: run
      ? t('runProgress', {
          ready: run.readyCount,
          failed: run.failedCount,
          processing: run.processingCount,
          queued: run.queuedCount,
          total: run.generationCount,
        })
      : undefined,
    failures:
      run?.failures.map((failure) => ({
        id: failure.generationId,
        label: failure.target
          ? `${failure.target.entityType}${failure.target.locale ? `:${failure.target.locale}` : ''} · ${failure.target.entityId} · ${getBoundedOgFailureReason(failure.errorCode)}`
          : `${failure.generationId} · ${getBoundedOgFailureReason(failure.errorCode)}`,
      })) ?? [],
    error: error ?? undefined,
  };

  return <OgGenerationRunProgressView model={model} />;
}
