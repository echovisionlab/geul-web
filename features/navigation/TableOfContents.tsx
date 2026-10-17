'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { TableOfContentsView, type TocItem } from '@/components/core/TableOfContents';

export type { TocItem };

export interface TableOfContentsProps {
  items: TocItem[];
  /** The document beside which Core reserves the outline (persistent column, rail and phone scrubber). */
  children: ReactNode;
  /** `center` for running-text documents on the reading measure; `start` for section-composed pages. */
  contentPlacement?: 'start' | 'center';
  /** `rail` keeps the compact outline at every width, beside a document that shares the page width. */
  outlinePresentation?: 'responsive' | 'rail';
}

/** Supplies application copy to the Core view. */
export function TableOfContents({ items, children, contentPlacement, outlinePresentation }: TableOfContentsProps) {
  const t = useTranslations('tableOfContents');

  return (
    <TableOfContentsView
      items={items}
      title={t('title')}
      contentPlacement={contentPlacement}
      outlinePresentation={outlinePresentation}
    >
      {children}
    </TableOfContentsView>
  );
}
