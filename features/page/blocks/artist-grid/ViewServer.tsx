import { Suspense } from 'react';
import { ServerDataTablePagination } from '@/features/data-table/ServerDataTable/ServerDataTablePagination';
import { listArtistsForBlockAction } from '@/lib/actions/artist';
import { parseBooleanProp, parseIntegerProp, splitCsv } from '../list-shared';
import { buildBlockTableNamespace, parseBlockTableQuery, queryRecordToSearchParams } from '../table-utils';
import type { BlockViewProps } from '../types';
import { parseArtistListProps } from './schema';
import { ArtistListSkeleton } from './Skeleton';
import { ArtistListViewClient } from './ViewClient';

async function ArtistListViewServer({ sectionId, props, query, requestedLocale }: BlockViewProps) {
  const p = parseArtistListProps(props);
  const labelIds = splitCsv(p.labelIds);
  const limit = parseIntegerProp(p.limit, 12);
  const showPagination = parseBooleanProp(p.showPagination, false);
  const namespace = buildBlockTableNamespace('artistList', sectionId);
  const searchParams = queryRecordToSearchParams(query);
  const tableQuery = showPagination
    ? parseBlockTableQuery(searchParams, namespace, limit)
    : { page: 1, pageSize: limit };

  const { artists, pagination } = await listArtistsForBlockAction({
    labelIds: labelIds.length > 0 ? labelIds : undefined,
    sortBy: p.sortBy as 'name' | 'published_at' | undefined,
    sortOrder: p.sortOrder as 'asc' | 'desc' | undefined,
    limit: tableQuery.pageSize,
    offset: ((tableQuery.page ?? 1) - 1) * (tableQuery.pageSize ?? limit),
    requestedLocale,
  });

  const transformedArtists = artists.map((a) => ({
    id: a.id,
    href: `/artists/${a.slug?.trim() || a.id}`,
    title: a.name,
    imageUrl: a.imageUrl ?? null,
    imageAlt: a.name,
    socialLinks: a.socialLinks ?? null,
  }));

  const result = {
    data: transformedArtists,
    total: pagination.total,
    page: tableQuery.page ?? 1,
    pageSize: tableQuery.pageSize ?? limit,
    totalPages: Math.ceil(pagination.total / (tableQuery.pageSize ?? limit)),
  };

  return (
    <>
      <ArtistListViewClient artists={transformedArtists} parsedProps={p} />
      {showPagination ? (
        <ServerDataTablePagination namespace={namespace} result={result} searchParams={searchParams} />
      ) : null}
    </>
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
          carouselLoop={p.carouselLoop !== 'false'}
          carouselIndicators={p.carouselIndicators !== 'false'}
        />
      }
    >
      <ArtistListViewServer {...blockProps} />
    </Suspense>
  );
}
