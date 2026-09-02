'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Group, Pagination } from '@mantine/core';
import { listPublishedReleases } from '@/lib/queries/release-browser';
import { parseBooleanProp, parseIntegerProp, splitCsv } from '../list-shared';
import { ListBlockSkeleton } from '../ListBlockSkeleton';
import type { BlockViewProps } from '../types';
import { parseReleaseListProps } from './schema';
import { ReleaseListViewClient } from './ViewClient';

export function ReleaseListView({ props }: BlockViewProps) {
  const p = parseReleaseListProps(props);
  const [page, setPage] = useState(1);
  const columns = parseIntegerProp(p.columns, 4);
  const limit = parseIntegerProp(p.limit, 8);
  const categoryIds = splitCsv(p.categoryIds);
  const artistId = p.artistId || undefined;
  const labelId = p.labelId || undefined;
  const showPagination = parseBooleanProp(p.showPagination, false);
  const types = splitCsv(p.types) as Array<'album' | 'ep' | 'single' | 'compilation'>;
  const { data, isLoading } = useQuery({
    queryKey: ['releases', 'published', { categoryIds, artistId, labelId, types, limit, page, p }],
    queryFn: () =>
      listPublishedReleases({
        types: types.length > 0 ? types : undefined,
        categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
        artistId,
        labelId,
        limit,
        offset: showPagination ? (page - 1) * limit : 0,
        sortBy: p.sortBy,
        sortOrder: p.sortOrder,
      }),
  });

  if (isLoading || !data) {
    return (
      <ListBlockSkeleton
        className="release-list-block"
        columns={columns}
        limit={limit}
        layout={p.layout}
        carouselLoop={p.carouselLoop !== 'false'}
        carouselIndicators={p.carouselIndicators !== 'false'}
        gridCols={{ base: 2, sm: 3 }}
      />
    );
  }

  return (
    <>
      <ReleaseListViewClient
        releases={data.releases.map((release) => {
          const primaryArtists = release.artists.filter((artist) => artist.role.toLowerCase() === 'primary');
          const selectedArtists = primaryArtists.length > 0 ? primaryArtists : release.artists;
          const seenArtists = new Set<string>();
          const mainArtists = selectedArtists.flatMap((artist) => {
            const dedupeKey = artist.id || artist.slug || artist.name;
            if (!dedupeKey || seenArtists.has(dedupeKey)) {
              return [];
            }

            seenArtists.add(dedupeKey);
            return [
              {
                id: dedupeKey,
                label: artist.name,
                href: `/artists/${artist.slug || artist.id}`,
              },
            ];
          });

          return {
            id: release.id,
            href: `/releases/${release.slug || release.id}`,
            title: release.title,
            imageUrl: release.artworkUrl,
            imageAlt: release.title,
            releaseDate: release.releaseDate?.toISOString() ?? null,
            mainArtists,
          };
        })}
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
