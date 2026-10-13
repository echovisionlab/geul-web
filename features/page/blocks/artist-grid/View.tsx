'use client';
import { LayoutInline as DsLayoutInline, LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import { useTranslations } from 'next-intl';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Pagination } from '@/components/core/Display';
import { listArtistsForBlockAction } from '@/lib/actions/artist';
import { prepareSocialLinksDisplay } from '@/features/social-links/prepare-social-links-display';
import { parseBooleanProp, parseIntegerProp, splitCsv } from '../list-view-utils';
import { ListBlockSkeleton } from '../ListBlockSkeleton';
import type { BlockViewProps } from '../types';
import { parseArtistListProps } from './schema';
import { ArtistListViewClient } from './ViewClient';

export function ArtistListView({ props }: BlockViewProps) {
  const tPagination = useTranslations('dataTable.pagination');
  const p = parseArtistListProps(props);
  const [page, setPage] = useState(1);
  const labelIds = splitCsv(p.labelIds);
  const sortBy = p.sortBy || 'name';
  const sortOrder = p.sortOrder || 'asc';
  const limit = parseIntegerProp(p.limit, 12);
  const columns = parseIntegerProp(p.columns, 3);
  const showPagination = parseBooleanProp(p.showPagination, false);
  const showMeta = p.showMeta !== 'false';

  const recipientsQuery = useQuery({
    queryKey: ['artists', 'forBlock', { labelIds, sortBy, sortOrder, limit, page }],
    queryFn: () =>
      listArtistsForBlockAction({
        labelIds: labelIds.length > 0 ? labelIds : undefined,
        sortBy: sortBy as 'name' | 'published_at',
        sortOrder: sortOrder as 'asc' | 'desc',
        limit,
        offset: showPagination ? (page - 1) * limit : 0,
      }).then(unwrapQueryResult),
  });
  const { data, isLoading } = recipientsQuery;

  if (recipientsQuery.isError && recipientsQuery.data === undefined) {
    return <QueryErrorAlert queries={[recipientsQuery]} />;
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

  return (
    <>
      <QueryErrorAlert queries={[recipientsQuery]} />
      <ArtistListViewClient
        artists={data.artists.map((artist) => ({
          id: artist.id,
          href: `/artists/${artist.slug?.trim() || artist.id}`,
          title: artist.name,
          imageUrl: artist.imageUrl,
          imageAlt: artist.name,
          socialLinkEntries: showMeta ? prepareSocialLinksDisplay(artist.socialLinks ?? {}) : [],
        }))}
        parsedProps={p}
      />

      {showPagination && data.pagination.total > limit ? (
        <DsLayoutInset blockStart="md">
          <DsLayoutInline justify="center">
            <Pagination
              total={Math.ceil(data.pagination.total / limit)}
              value={page}
              onChange={setPage}
              labels={{
                previousPage: tPagination('previousPage'),
                nextPage: tPagination('nextPage'),
                page: (page) => tPagination('page', { page }),
              }}
            />
          </DsLayoutInline>
        </DsLayoutInset>
      ) : null}
    </>
  );
}
