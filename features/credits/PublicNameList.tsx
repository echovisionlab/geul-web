'use client';

import { Text as DsText } from '@/components/core/Typography';
import { PublicMetadataLink, PublicMetadataValueGroup } from '@/components/core/PublicMetadata';

export interface PublicNameListItem {
  id: string;
  name: string;
  href?: string | null;
  /** Opens `href` in a new context (client and partner websites). */
  external?: boolean;
  role?: string | null;
}

/** Related names (artists, labels, clients) as one metadata value in the shared slash grammar. */
export function PublicNameList({ items }: { items: PublicNameListItem[] }) {
  return (
    <PublicMetadataValueGroup separator="slash">
      {items.map((item) => (
        <span key={item.id}>
          {item.href ? (
            <PublicMetadataLink href={item.href} external={item.external}>
              {item.name}
            </PublicMetadataLink>
          ) : (
            item.name
          )}
          {item.role ? (
            <DsText as="span" size="sm" tone="secondary">
              {' '}
              ({item.role})
            </DsText>
          ) : null}
        </span>
      ))}
    </PublicMetadataValueGroup>
  );
}
