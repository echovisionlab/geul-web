'use client';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Group, Pagination } from '@mantine/core';
import { listArtistsForBlockAction } from '@/lib/actions/artist';
import { parseBooleanProp, parseIntegerProp, splitCsv } from '../list-view-utils';
import { ListBlockSkeleton } from '../ListBlockSkeleton';
import type { BlockViewProps } from '../types';
import { parseArtistListProps } from './schema';
import { ArtistListViewClient } from './ViewClient';

export function ArtistListView({ props }: BlockViewProps) {
  const p = parseArtistListProps(props);
  const [page, setPage] = useState(1);
  const labelIds = splitCsv(p.labelIds);
  const sortBy = p.sortBy || 'name';
  const sortOrder = p.sortOrder || 'asc';
  const limit = parseIntegerProp(p.limit, 12);
  const columns = parseIntegerProp(p.columns, 3);
  const showPagination = parseBooleanProp(p.showPagination, false);

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
          socialLinks: artist.socialLinks ?? null,
        }))}
        parsedProps={p}
      />

      {showPagination && data.pagination.total > limit ? (
        <Group justify="center" mt="md">
          <Pagination total={Math.ceil(data.pagination.total / limit)} value={page} onChange={setPage} />
        </Group>
      ) : null}
    </>
  );
}
