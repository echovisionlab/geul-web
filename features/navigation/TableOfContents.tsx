'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { TableOfContentsView, type TocItem } from '@/components/core/TableOfContents';

export type { TocItem };

export interface TableOfContentsProps {
  items: TocItem[];
  enabled?: boolean;
  /** The document beside which Core reserves the outline rail. */
  children: ReactNode;
}

/** Supplies application copy to the Core view. */
export function TableOfContents({ items, children, enabled = true }: TableOfContentsProps) {
  const t = useTranslations('tableOfContents');

  return (
    <TableOfContentsView items={enabled ? items : []} title={t('title')}>
      {children}
    </TableOfContentsView>
  );
}
