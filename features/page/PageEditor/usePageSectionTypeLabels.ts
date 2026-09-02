'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { SectionType } from './types';

export function usePageSectionTypeLabels(): Record<SectionType, string> {
  const t = useTranslations('pageEditor');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonEntities = useTranslations('common.entities');
  return useMemo(
    () => ({
      'rich-text': t('sectionTypes.richText'),
      'post-list': t('sectionTypes.postList'),
      'post-table': t('sectionTypes.postTable'),
      'post-map': t('sectionTypes.postMap'),
      'work-map': t('sectionTypes.workMap'),
      'work-table': t('sectionTypes.workTable'),
      'work-list': t('sectionTypes.worksGallery'),
      'program-event-list': t('sectionTypes.programEventList'),
      'release-list': t('sectionTypes.releasesGallery'),
      'artist-list': t('sectionTypes.artistGrid'),
      'label-list': tCommonEntities('labels'),
      'text-marquee': t('sectionTypes.textMarquee'),
      'client-marquee': t('sectionTypes.clientMarquee'),
      'label-marquee': t('sectionTypes.labelMarquee'),
      'author-list': t('sectionTypes.authorList'),
      form: t('sectionTypes.form'),
      map: tCommonLabels('map'),
      'immersive-scene': t('sectionTypes.immersiveScene'),
      'external-video': t('sectionTypes.externalVideo'),
      columns: t('sectionTypes.columns'),
    }),
    [t, tCommonEntities, tCommonLabels],
  );
}
