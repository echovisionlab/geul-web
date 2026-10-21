'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { ContextualBlockSizeLabels } from './DisplaySizeMenuActions';

export function useDisplaySizeLabels(): ContextualBlockSizeLabels {
  const formatting = useTranslations('editorCommon.editor.formatting');
  return useMemo(
    () => ({
      displaySize: formatting('displaySize'),
      displaySizePresets: {
        xs: formatting('displaySizeXs'),
        s: formatting('displaySizeS'),
        m: formatting('displaySizeM'),
        l: formatting('displaySizeL'),
        xl: formatting('displaySizeXl'),
      },
    }),
    [formatting],
  );
}
