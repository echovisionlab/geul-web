import { getTranslations } from 'next-intl/server';
import { Stack } from '@mantine/core';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable, type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { ArtistModalProvider, ArtistModals, ArtistsTableContent, CreateArtistButton } from '@/features/admin/artist';
import { listArtistsAdminAction } from '@/lib/actions/artist';
import { parseTableQuery } from '@/lib/utils/table-url';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminArtistsPage({ searchParams }: PageProps) {
  const tCommon = await getTranslations('common');
  const artistsLabel = tCommon('entities.artists');
  const searchPlaceholder = tCommon('actions.searchItems', { items: artistsLabel.toLowerCase() });
  const params = new URLSearchParams();
  const resolved = await searchParams;
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const query = parseTableQuery(params, 'artists');
  const filterFields: FilterFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name'), type: 'string' },
    { field: 'slug', label: tCommon('labels.slug'), type: 'string' },
    {
      field: 'status',
      label: tCommon('labels.status'),
      type: 'string',
      options: [
        { value: 'draft', label: tCommon('statuses.draft') },
        { value: 'published', label: tCommon('statuses.published') },
      ],
    },
    { field: 'created_at', label: tCommon('labels.created'), type: 'date' },
  ];

  const sortFields: SortFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name') },
    { field: 'releaseCount', label: tCommon('entities.releases') },
    { field: 'created_at', label: tCommon('labels.created') },
  ];

  const result = await listArtistsAdminAction({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    sort: query.sorts?.map((s) => ({ field: s.field, order: s.direction })),
    filter: query.filters,
    filterBy: query.filterBy,
  });

  return (
    <ArtistModalProvider>
      <Stack>
        <AdminPageHeader
          title={artistsLabel}
          items={[{ key: 'create-artist', type: 'custom', content: <CreateArtistButton /> }]}
        />

        <ServerDataTable namespace="artists">
          <ArtistsTableContent
            result={result}
            searchPlaceholder={searchPlaceholder}
            filterFields={filterFields}
            sortFields={sortFields}
          />
          <ServerDataTable.Pagination namespace="artists" result={result} searchParams={params} />
        </ServerDataTable>
      </Stack>

      <ArtistModals />
    </ArtistModalProvider>
  );
}
