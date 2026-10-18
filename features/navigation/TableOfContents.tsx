'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { TableOfContentsView, type TocItem } from '@/components/core/TableOfContents';

export type { TocItem };

export interface TableOfContentsProps {
  items: TocItem[];
  enabled?: boolean;
  /** The document beside which Core reserves the outline (persistent column, rail and phone scrubber). */
  children: ReactNode;
  /** `rail` keeps the compact outline at every width, beside a document that shares the page width. */
  outlinePresentation?: 'responsive' | 'rail';
}

/** Supplies application copy to the Core view. */
export function TableOfContents({ items, children, outlinePresentation, enabled = true }: TableOfContentsProps) {
  const t = useTranslations('tableOfContents');

  return (
    <TableOfContentsView items={enabled ? items : []} title={t('title')} outlinePresentation={outlinePresentation}>
      {children}
    </TableOfContentsView>
  );
}
