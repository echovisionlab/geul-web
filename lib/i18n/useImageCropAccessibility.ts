'use client';

import { useLocale, useTranslations } from 'next-intl';
import { createImageCropAccessibility } from './image-crop-accessibility';

export function useImageCropAccessibility(areaLabel?: string) {
  const locale = useLocale();
  const t = useTranslations('common');
  return createImageCropAccessibility(locale, {
    area: areaLabel ?? t('messages.cropItem', { item: t('labels.image') }),
    top: t('labels.top'),
    right: t('labels.right'),
    bottom: t('labels.bottom'),
    left: t('labels.left'),
    width: t('labels.width'),
    height: t('labels.height'),
  });
}
