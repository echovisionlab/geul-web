'use client';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { useQuery } from '@tanstack/react-query';

import { listArtistsForBlockAction } from '@/lib/actions/artist';
import { prepareSocialLinksDisplay } from '@/features/social-links/prepare-social-links-display';
import { parseBooleanProp, parseIntegerProp, splitCsv } from '../list-view-utils';
import { ListBlockSkeleton } from '../ListBlockSkeleton';
import type { BlockViewProps } from '../types';
import { parseArtistListProps } from './schema';
import { ArtistListViewClient } from './ViewClient';
import { ArtistInfiniteList } from './InfiniteList';
import { toArtistListItem } from './transform';

export function ArtistListView({ props }: BlockViewProps) {
  const p = parseArtistListProps(props);
  const labelIds = splitCsv(p.labelIds);
  const limit = parseIntegerProp(p.limit, 12);
  const columns = parseIntegerProp(p.columns, 3);
  const showPagination = parseBooleanProp(p.showPagination, false);
  const showMeta = p.showMeta !== 'false';
  const query = {
    labelIds: labelIds.length > 0 ? labelIds : undefined,
    sortBy: (p.sortBy || 'name') as 'name' | 'published_at',
    sortOrder: (p.sortOrder || 'asc') as 'asc' | 'desc',
    limit,
  };

  const artistsQuery = useQuery({
    queryKey: ['artists', 'forBlock', { ...query, offset: 0 }],
    queryFn: () => listArtistsForBlockAction({ ...query, offset: 0 }).then(unwrapQueryResult),
  });
  const { data, isLoading } = artistsQuery;

  if (artistsQuery.isError && artistsQuery.data === undefined) {
    return <QueryErrorAlert queries={[artistsQuery]} />;
  }
  if (isLoading || !data) {
    return (
      <ListBlockSkeleton
        className="artist-list-block"
        columns={columns}
        limit={Math.min(limit, 12)}
        layout={p.layout}
        itemSize={p.itemSize}
        showImage={p.showImage !== 'false'}
        imageAspectRatio={p.imageAspectRatio}
        carouselLoop={p.carouselLoop !== 'false'}
        carouselIndicators={p.carouselIndicators !== 'false'}
      />
    );
  }

  const items = data.artists.map((artist) =>
    toArtistListItem(artist, showMeta ? prepareSocialLinksDisplay(artist.socialLinks ?? {}) : []),
  );
  return (
    <>
      <QueryErrorAlert queries={[artistsQuery]} />
      {showPagination ? (
        <ArtistInfiniteList
          key={JSON.stringify(query)}
          initialArtists={items}
          total={data.pagination.total}
          query={query}
          showMeta={showMeta}
          parsedProps={p}
        />
      ) : (
        <ArtistListViewClient artists={items} parsedProps={p} />
      )}
    </>
  );
}
