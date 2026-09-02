'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { MyArtistsDataTable, type MyArtistsDataTableResult } from '@/features/my/MyArtistsDataTable';
import type { MyArtistsTableRowViewModel } from '@/features/my/ui/MyArtistsTable';
import { listMyArtistsAction } from '@/lib/actions/artist';
import type { PaginatedQuery } from '@/lib/types/common/query';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';

interface MyArtistListItem {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  status: string;
  createdAt: Date | null;
}

interface MyArtistsResult {
  data: MyArtistListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface MyArtistsTableProps {
  initialData: MyArtistsResult;
}

interface ArtistStatusLabels {
  draft: string;
  published: string;
}

function normalizeArtistStatus(status: string): 'draft' | 'published' | string {
  switch (status) {
    case 'draft':
    case 'published':
      return status;
    case 'ARTIST_STATUS_DRAFT':
      return 'draft';
    case 'ARTIST_STATUS_PUBLISHED':
      return 'published';
    default:
      return status;
  }
}

function getArtistStatusLabel(status: string, labels: ArtistStatusLabels): string {
  const normalizedStatus = normalizeArtistStatus(status);

  switch (normalizedStatus) {
    case 'draft':
      return labels.draft;
    case 'published':
      return labels.published;
    default:
      return status;
  }
}

function toRowViewModel(
  artist: MyArtistListItem,
  formatDate: (value: Date) => string,
  statusLabels: ArtistStatusLabels,
): MyArtistsTableRowViewModel {
  return {
    id: artist.id,
    name: artist.name,
    slugLabel: artist.slug ? `/${artist.slug}` : null,
    imageUrl: buildManagedImageUrl(artist.imageUrl, MANAGED_IMAGE_PRESET.AVATAR_SM) ?? null,
    avatarFallback: artist.name.charAt(0).toUpperCase(),
    href: `/artists/${artist.id}?edit=true`,
    statusLabel: getArtistStatusLabel(artist.status, statusLabels),
    createdLabel: artist.createdAt ? formatDate(artist.createdAt) : '-',
  };
}

/** Connects My Artists queries and localization to the table controller. */
export function MyArtistsTable({ initialData }: MyArtistsTableProps) {
  const t = useTranslations('artists');
  const tCommon = useTranslations('common');
  const dateTime = useDateTimeFormatter();
  const [query, setQuery] = useState<PaginatedQuery>({
    page: 1,
    pageSize: 20,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['artists', 'my', query],
    queryFn: () =>
      listMyArtistsAction({
        filter: query.filters,
        filterBy: query.filterBy,
        sort: query.sorts?.map((sort) => ({ field: sort.field, order: sort.direction })),
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        search: query.search,
      }),
    initialData,
  });

  const statusLabels: ArtistStatusLabels = {
    draft: tCommon('statuses.draft'),
    published: tCommon('statuses.published'),
  };
  const result: MyArtistsDataTableResult = {
    ...data,
    data: data.data.map((artist) => toRowViewModel(artist, dateTime.date, statusLabels)),
  };

  return (
    <MyArtistsDataTable
      result={result}
      labels={{
        title: tCommon('entities.artists'),
        name: tCommon('labels.name'),
        status: tCommon('labels.status'),
        created: tCommon('labels.created'),
        empty: t('empty'),
        searchPlaceholder: t('searchPlaceholder'),
      }}
      query={query}
      loading={isLoading}
      onQueryChange={setQuery}
    />
  );
}
