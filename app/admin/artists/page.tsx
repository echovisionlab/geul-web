import { ArtistsPageView } from '@/features/admin/artist/ArtistsPageView';
import { getTranslations } from 'next-intl/server';

import { type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';

import { listArtistsAdminAction } from '@/lib/actions/artist';
import { toPaginatedListInput } from '@/lib/types/common/query';
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

  const result = await listArtistsAdminAction(toPaginatedListInput(query));

  return (
    <ArtistsPageView
      title={artistsLabel}
      searchParams={params.toString()}
      result={result}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
    />
  );
}
