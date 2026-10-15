import { unwrapQueryResult } from '@/lib/api/query-result';
import { getTranslations } from 'next-intl/server';
import { type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { GenresPageView } from '@/features/admin/genre/GenresPageView';
import { listGenresAdminAction } from '@/lib/actions/genre';
import { parseTableQuery } from '@/lib/utils/table-url';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminGenresPage({ searchParams }: PageProps) {
  const tCommon = await getTranslations('common');
  const genresLabel = tCommon('entities.genres');
  const searchPlaceholder = tCommon('actions.searchItems', { items: genresLabel.toLowerCase() });
  const params = new URLSearchParams();
  const resolved = await searchParams;
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const query = parseTableQuery(params, 'genres');
  const filterFields: FilterFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name'), type: 'string' },
    { field: 'slug', label: tCommon('labels.slug'), type: 'string' },
    { field: 'description', label: tCommon('labels.description'), type: 'string' },
    { field: 'created_at', label: tCommon('labels.created'), type: 'date' },
  ];

  const sortFields: SortFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name') },
    { field: 'releaseCount', label: tCommon('entities.releases') },
    { field: 'sort_order', label: tCommon('labels.order') },
    { field: 'created_at', label: tCommon('labels.created') },
  ];

  const result = await listGenresAdminAction({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    sort: query.sorts?.map((s) => ({ field: s.field, order: s.direction })),
  }).then(unwrapQueryResult);

  return (
    <GenresPageView
      title={genresLabel}
      result={result}
      filterFields={filterFields}
      sortFields={sortFields}
      searchPlaceholder={searchPlaceholder}
      searchParams={params.toString()}
    />
  );
}
