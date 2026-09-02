import { getTranslations } from 'next-intl/server';
import { Stack } from '@mantine/core';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable, type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import {
  CreateReleaseButton,
  ReleaseModalProvider,
  ReleaseModals,
  ReleasesTableContent,
} from '@/features/admin/release';
import { listReleasesAdmin } from '@/lib/queries/release';
import { parseTableQuery } from '@/lib/utils/table-url';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminReleasesPage({ searchParams }: PageProps) {
  const tCommon = await getTranslations('common');
  const tReleaseTypes = await getTranslations('releasePage.types');
  const releasesLabel = tCommon('entities.releases');
  const searchPlaceholder = tCommon('actions.searchItems', { items: releasesLabel.toLowerCase() });
  const params = new URLSearchParams();
  const resolved = await searchParams;
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const query = parseTableQuery(params, 'releases');
  const filterFields: FilterFieldConfig[] = [
    { field: 'title', label: tCommon('labels.title'), type: 'string' },
    {
      field: 'type',
      label: tCommon('labels.type'),
      type: 'string',
      options: [
        { value: 'album', label: tReleaseTypes('album') },
        { value: 'ep', label: tReleaseTypes('ep') },
        { value: 'single', label: tReleaseTypes('single') },
        { value: 'compilation', label: tReleaseTypes('compilation') },
      ],
    },
    {
      field: 'status',
      label: tCommon('labels.status'),
      type: 'string',
      options: [
        { value: 'draft', label: tCommon('statuses.draft') },
        { value: 'published', label: tCommon('statuses.published') },
      ],
    },
    { field: 'release_date', label: tCommon('labels.releaseDate'), type: 'date' },
    { field: 'created_at', label: tCommon('labels.created'), type: 'date' },
  ];

  const sortFields: SortFieldConfig[] = [
    { field: 'title', label: tCommon('labels.title') },
    { field: 'release_date', label: tCommon('labels.releaseDate') },
    { field: 'created_at', label: tCommon('labels.created') },
    { field: 'type', label: tCommon('labels.type') },
    { field: 'status', label: tCommon('labels.status') },
  ];

  const result = await listReleasesAdmin({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    sort: query.sorts?.map((s) => ({ field: s.field, order: s.direction })),
    filter: query.filters,
    filterBy: query.filterBy,
  });

  return (
    <ReleaseModalProvider>
      <Stack>
        <AdminPageHeader
          title={releasesLabel}
          items={[{ key: 'create-release', type: 'custom', content: <CreateReleaseButton /> }]}
        />

        <ServerDataTable namespace="releases">
          <ReleasesTableContent
            result={result}
            searchPlaceholder={searchPlaceholder}
            filterFields={filterFields}
            sortFields={sortFields}
          />
          <ServerDataTable.Pagination namespace="releases" result={result} searchParams={params} />
        </ServerDataTable>
      </Stack>

      <ReleaseModals />
    </ReleaseModalProvider>
  );
}
