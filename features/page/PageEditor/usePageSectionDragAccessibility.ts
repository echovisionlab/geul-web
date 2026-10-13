'use client';

import type { Announcements, ScreenReaderInstructions } from '@dnd-kit/core';
import { useTranslations } from 'next-intl';
import type { SectionMeta } from './types';
import { usePageSectionTypeLabels } from './usePageSectionTypeLabels';

/** Announce authored sections and positions rather than internal collaboration IDs. */
export function usePageSectionDragAccessibility(
  sections: readonly SectionMeta[],
  labelForSection?: (section: SectionMeta) => string,
) {
  const t = useTranslations('pageEditor');
  const labels = usePageSectionTypeLabels();
  const values = (id: string | number, destination?: string | number) => {
    const index = sections.findIndex((section) => section.id === (destination ?? id));
    const section = sections.find((item) => item.id === id);
    return {
      section: section ? (labelForSection?.(section) ?? labels[section.type]) : '',
      index: index + 1,
      count: sections.length,
    };
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('a11y.dragStart', values(active.id)),
    onDragOver: ({ active, over }) => (over ? t('a11y.dragOver', values(active.id, over.id)) : undefined),
    onDragEnd: ({ active, over }) =>
      over ? t('a11y.dragEnd', values(active.id, over.id)) : t('a11y.dragCancel', values(active.id)),
    onDragCancel: ({ active }) => t('a11y.dragCancel', values(active.id)),
  };
  const screenReaderInstructions: ScreenReaderInstructions = { draggable: t('a11y.dragInstructions') };
  return { announcements, screenReaderInstructions };
}
