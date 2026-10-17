import { unwrapQueryResult } from '@/lib/api/query-result';
import { Suspense } from 'react';
import { listArtistsForBlockAction } from '@/lib/actions/artist';
import { prepareSocialLinksDisplay } from '@/features/social-links/prepare-social-links-display';
import { parseBooleanProp, parseIntegerProp, splitCsv } from '../list-shared';
import type { BlockViewProps } from '../types';
import { parseArtistListProps } from './schema';
import { ArtistListSkeleton } from './Skeleton';
import { ArtistListViewClient } from './ViewClient';
import { ArtistInfiniteList } from './InfiniteList';
import { toArtistListItem } from './transform';

async function ArtistListViewServer({ props, requestedLocale }: BlockViewProps) {
  const p = parseArtistListProps(props);
  const labelIds = splitCsv(p.labelIds);
  const limit = parseIntegerProp(p.limit, 12);
  // Pagination continues the list in place: the first page renders here, later pages on demand.
  const showPagination = parseBooleanProp(p.showPagination, false);
  // Hidden metadata must not add prepared glyph paths to the HTML/RSC payload.
  const showMeta = p.showMeta !== 'false';
  const query = {
    labelIds: labelIds.length > 0 ? labelIds : undefined,
    sortBy: p.sortBy as 'name' | 'published_at' | undefined,
    sortOrder: p.sortOrder as 'asc' | 'desc' | undefined,
    limit,
  };
  const { artists, pagination } = await listArtistsForBlockAction({ ...query, offset: 0, requestedLocale }).then(
    unwrapQueryResult,
  );
  const items = artists.map((artist) =>
    toArtistListItem(artist, showMeta ? prepareSocialLinksDisplay(artist.socialLinks ?? {}) : []),
  );

  return showPagination ? (
    <ArtistInfiniteList
      initialArtists={items}
      total={pagination.total}
      query={query}
      showMeta={showMeta}
      parsedProps={p}
      locale={requestedLocale}
    />
  ) : (
    <ArtistListViewClient artists={items} parsedProps={p} />
  );
}

export function ArtistListViewStreaming(blockProps: BlockViewProps) {
  const { props } = blockProps;
  const p = parseArtistListProps(props);
  const limit = parseIntegerProp(p.limit, 12);
  const columns = parseIntegerProp(p.columns, 3);

  return (
    <Suspense
      fallback={
        <ArtistListSkeleton
          limit={limit}
          columns={columns}
          layout={p.layout}
          itemSize={p.itemSize}
          showImage={p.showImage !== 'false'}
          imageAspectRatio={p.imageAspectRatio}
          carouselLoop={p.carouselLoop !== 'false'}
          carouselIndicators={p.carouselIndicators !== 'false'}
        />
      }
    >
      <ArtistListViewServer {...blockProps} />
    </Suspense>
  );
}
