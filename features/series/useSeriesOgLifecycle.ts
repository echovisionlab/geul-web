'use client';

import { useCallback } from 'react';
import { useOgImage } from '@/lib/hooks/useOgImage';

interface UseSeriesOgLifecycleOptions {
  seriesId: string;
  locale: string | null;
  initialOgImageUrl?: string | null;
}

export function useSeriesOgLifecycle({ seriesId, locale, initialOgImageUrl }: UseSeriesOgLifecycleOptions) {
  const ogImage = useOgImage({
    entityType: 'series',
    entityId: seriesId,
    initialOgImageUrl,
    locale,
    provider: null,
  });

  const trackManualGeneration = useCallback(
    (generationId: string | undefined, targetKey: string) => {
      ogImage.trackRequestedGeneration(generationId, targetKey);
    },
    [ogImage.trackRequestedGeneration],
  );

  const trackAutomaticGenerationRun = useCallback(
    (runId?: string) => {
      if (runId) {
        void ogImage.trackLatest();
      }
    },
    [ogImage.trackLatest],
  );

  const trackTitleUpdate = useCallback(
    (update: { title?: string }) => {
      if (update.title !== undefined) {
        void ogImage.trackLatest();
      }
    },
    [ogImage.trackLatest],
  );

  return {
    ...ogImage,
    trackAutomaticGenerationRun,
    trackManualGeneration,
    trackTitleUpdate,
  };
}
