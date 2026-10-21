'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { ExternalVideoPlaybackLabelFormatter } from './ExternalVideoView';

/** Localized play control and consent notice for embedded YouTube and Vimeo players. */
export function useExternalVideoPlaybackLabels(): ExternalVideoPlaybackLabelFormatter {
  const labels = useTranslations('editorCommon.editor.runtimeLabels.linkPresentation');
  return useCallback(
    ({ title, provider }) => ({
      play: labels('playVideo', { title }),
      notice: labels('playNotice', { provider }),
    }),
    [labels],
  );
}
