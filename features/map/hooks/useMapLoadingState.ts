'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

export type MapLoadingStage = 'connecting' | 'loading' | 'rendering' | 'ready';

export type MapLoadingMessages = Record<Exclude<MapLoadingStage, 'ready'>, string>;

/**
 * Manages map loading state transitions
 * connecting -> loading -> rendering -> ready
 */
export function useMapLoadingState(messages?: MapLoadingMessages) {
  const t = useTranslations('map.loading');
  const [loadingStage, setLoadingStage] = useState<MapLoadingStage>('connecting');

  // Transition from connecting to loading after brief delay
  useEffect(() => {
    if (loadingStage === 'connecting') {
      const timer = setTimeout(() => setLoadingStage('loading'), 100);
      return () => clearTimeout(timer);
    }
  }, [loadingStage]);

  return {
    loadingStage,
    setLoadingStage,
    isReady: loadingStage === 'ready',
    loadingMessage: loadingStage !== 'ready' ? (messages?.[loadingStage] ?? t(loadingStage)) : undefined,
  };
}
