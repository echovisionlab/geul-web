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
}

/** Supplies application copy to the Core view. */
export function TableOfContents({ items, children, contentPlacement }: TableOfContentsProps) {
  const t = useTranslations('tableOfContents');

  return (
    <TableOfContentsView items={items} title={t('title')} contentPlacement={contentPlacement}>
      {children}
    </TableOfContentsView>
  );
}
