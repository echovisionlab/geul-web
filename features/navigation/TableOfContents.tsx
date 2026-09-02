'use client';

import { useTranslations } from 'next-intl';
import { TableOfContentsView, type TocItem } from '@/components/core/TableOfContents';

export type { TocItem };

export interface TableOfContentsProps {
  items: TocItem[];
}

/** Supplies application copy and the page footer boundary to the Core view. */
export function TableOfContents({ items }: TableOfContentsProps) {
  const t = useTranslations('tableOfContents');

  return <TableOfContentsView items={items} title={t('title')} footerSelector="footer" />;
}
