import { Suspense } from 'react';
import { ServerDataTablePagination } from '@/features/data-table/ServerDataTable/ServerDataTablePagination';
import { listPublishedReleases } from '@/lib/queries/release';
import { parseBooleanProp, parseIntegerProp, splitCsv } from '../list-shared';
import { buildBlockTableNamespace, parseBlockTableQuery, queryRecordToSearchParams } from '../table-utils';
import type { BlockViewProps } from '../types';
import { parseReleaseListProps } from './schema';
import { ReleaseListSkeleton } from './Skeleton';
import { ReleaseListViewClient } from './ViewClient';

async function ReleaseListViewServer({ sectionId, props, query, requestedLocale }: BlockViewProps) {
  const p = parseReleaseListProps(props);
  const categoryIds = splitCsv(p.categoryIds);
  const artistId = p.artistId || undefined;
  const labelId = p.labelId || undefined;
  const limit = parseIntegerProp(p.limit, 8);
  const showPagination = parseBooleanProp(p.showPagination, false);
  const namespace = buildBlockTableNamespace('releaseList', sectionId);
  const searchParams = queryRecordToSearchParams(query);
  const tableQuery = showPagination
    ? parseBlockTableQuery(searchParams, namespace, limit)
    : { page: 1, pageSize: limit };
  const types = splitCsv(p.types) as Array<'album' | 'ep' | 'single' | 'compilation'>;

  const { releases, pagination } = await listPublishedReleases({
    types: types.length > 0 ? types : undefined,
    categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
    artistId,
    labelId,
    limit: tableQuery.pageSize,
    offset: ((tableQuery.page ?? 1) - 1) * (tableQuery.pageSize ?? limit),
    sortBy: p.sortBy,
    sortOrder: p.sortOrder,
    requestedLocale,
  });

  const transformedReleases = releases.map((r) => {
    const primaryArtists = r.artists.filter((artist) => artist.role.toLowerCase() === 'primary');
    const selectedArtists = primaryArtists.length > 0 ? primaryArtists : r.artists;
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
      id: r.id,
      href: `/releases/${r.slug || r.id}`,
      title: r.title,
      imageUrl: r.artworkUrl,
      imageAlt: r.title,
      releaseDate: r.releaseDate?.toISOString() ?? null,
      mainArtists,
    };
  });

  const result = {
    data: transformedReleases,
    total: pagination.total,
    page: tableQuery.page ?? 1,
    pageSize: tableQuery.pageSize ?? limit,
    totalPages: Math.ceil(pagination.total / (tableQuery.pageSize ?? limit)),
  };

  return (
    <>
      <ReleaseListViewClient releases={transformedReleases} parsedProps={p} />
      {showPagination ? (
        <ServerDataTablePagination namespace={namespace} result={result} searchParams={searchParams} />
      ) : null}
    </>
  );
}

export function ReleaseListViewStreaming(blockProps: BlockViewProps) {
  const { props } = blockProps;
  const p = parseReleaseListProps(props);
  const columns = parseIntegerProp(p.columns, 4);
  const limit = parseIntegerProp(p.limit, 8);
  const layout = p.layout || 'grid';
  const carouselLoop = p.carouselLoop !== 'false';
  const carouselIndicators = p.carouselIndicators !== 'false';

  return (
    <Suspense
      fallback={
        <ReleaseListSkeleton
          columns={columns}
          limit={limit}
          layout={layout}
          carouselLoop={carouselLoop}
          carouselIndicators={carouselIndicators}
        />
      }
    >
      <ReleaseListViewServer {...blockProps} />
    </Suspense>
  );
}
