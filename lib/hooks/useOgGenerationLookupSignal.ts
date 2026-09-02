'use client';

import { useEffect } from 'react';
import type { OgGenerationLookupSignal } from '@/lib/types/og-generation';

export function useOgGenerationLookupSignal(
  request: OgGenerationLookupSignal | null | undefined,
  activeLocale: string | null | undefined,
  trackLatest: () => Promise<boolean>,
): void {
  useEffect(() => {
    if (!request || request.locale.trim() !== activeLocale?.trim()) {
      return;
    }
    void trackLatest();
  }, [activeLocale, request, trackLatest]);
}
