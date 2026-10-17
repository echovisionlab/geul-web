'use client';

import { useCallback } from 'react';
import { unwrapQueryResult } from '@/lib/api/query-result';
import { InfiniteItems } from '../infinite-items';
import type { ArtistListProps } from './schema';
import { toArtistListItem } from './transform';
import { ArtistListViewClient } from './ViewClient';
import type { ArtistListViewClientProps } from './ViewClientRuntime';

type Item = ArtistListViewClientProps['artists'][number];
type ActionQuery = Omit<
  Parameters<typeof import('@/lib/actions/artist').listArtistsForBlockAction>[0],
  'offset' | 'requestedLocale'
>;

/**
 * Server-rendered first page; further pages load through the public artists action, on demand. The
 * social glyph catalog loads with the first extra page that shows metadata, never with the route.
 */
export function ArtistInfiniteList({
  initialArtists,
  total,
  query,
  showMeta,
  parsedProps,
  locale,
}: {
  initialArtists: Item[];
  total: number;
  query: ActionQuery;
  showMeta: boolean;
  parsedProps: ArtistListProps;
  locale?: string;
}) {
  const loadPage = useCallback(
    async (offset: number) => {
      const [{ listArtistsForBlockAction }, social] = await Promise.all([
        import('@/lib/actions/artist'),
        showMeta ? import('@/features/social-links/prepare-social-links-display') : null,
      ]);
      const { artists } = unwrapQueryResult(
        await listArtistsForBlockAction({ ...query, offset, requestedLocale: locale }),
      );
      return artists.map((artist) =>
        toArtistListItem(artist, social ? social.prepareSocialLinksDisplay(artist.socialLinks ?? {}) : []),
      );
    },
    [query, showMeta, locale],
  );
  return (
    <InfiniteItems initialItems={initialArtists} total={total} loadPage={loadPage}>
      {(artists) => <ArtistListViewClient artists={[...artists]} parsedProps={parsedProps} />}
    </InfiniteItems>
  );
}
