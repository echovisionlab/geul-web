import { getTranslations } from 'next-intl/server';
import { type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { SeriesPageView } from '@/features/admin/series/SeriesPageView';
import { listSeriesAdmin } from '@/lib/queries/series';
import type { SeriesStatus } from '@/lib/types/series/model';
import { parseTableQuery } from '@/lib/utils/table-url';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminSeriesPage({ searchParams }: PageProps) {
  const tCommon = await getTranslations('common');
  const tCommonEntities = await getTranslations('common.entities');
  const tPage = await getTranslations('adminList.series');
  const searchPlaceholder = tPage('searchPlaceholder');
  const params = new URLSearchParams();
  const resolved = await searchParams;
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const query = parseTableQuery(params, 'series');
  const filterFields: FilterFieldConfig[] = [
    {
      field: 'status',
      label: tCommon('labels.status'),
      type: 'string',
      operators: ['eq'],
      options: [
        { value: 'draft', label: tCommon('statuses.draft') },
        { value: 'published', label: tCommon('statuses.published') },
      ],
    },
  ];

  const sortFields: SortFieldConfig[] = [
    { field: 'title', label: tCommon('labels.title') },
    { field: 'status', label: tCommon('labels.status') },
    { field: 'created_at', label: tCommon('labels.created') },
  ];

  const result = await listSeriesAdmin({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    sort: query.sorts?.map((s) => ({ field: s.field, order: s.direction })),
    status: query.filters?.find((f) => f.field === 'status')?.value as SeriesStatus | undefined,
  });

  return (
    <SeriesPageView
      title={tCommonEntities('series')}
      result={result}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
      searchParams={params.toString()}
    />
  );
}
