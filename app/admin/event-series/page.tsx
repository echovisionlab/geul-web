import { getTranslations } from 'next-intl/server';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable, type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { CreateProgramEventSeriesButton } from '@/features/admin/program-event/CreateProgramEventSeriesButton';
import { ProgramEventSeriesTableContent } from '@/features/admin/program-event/ProgramEventSeriesTableContent';
import {
  listProgramEventSeriesTableAdmin,
  toManageProgramEventSeriesStatusFilterValue,
} from '@/lib/queries/program-event';
import { parseTableQuery } from '@/lib/utils/table-url';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminEventSeriesPage({ searchParams }: PageProps) {
  const tCommon = await getTranslations('common');
  const tProgramEventAdmin = await getTranslations('programEventAdmin');
  const tCommonEntities = await getTranslations('common.entities');
  const seriesLabel = tCommonEntities('programEventSeries');
  const params = new URLSearchParams();
  const resolved = await searchParams;
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const query = parseTableQuery(params, 'eventSeries');
  const filterFields: FilterFieldConfig[] = [
    { field: 'search', label: tProgramEventAdmin('list.search'), type: 'string' },
    {
      field: 'status',
      label: tCommon('labels.status'),
      type: 'string',
      options: [
        { value: toManageProgramEventSeriesStatusFilterValue('draft'), label: tCommon('statuses.draft') },
        {
          value: toManageProgramEventSeriesStatusFilterValue('published'),
          label: tCommon('statuses.published'),
        },
      ],
    },
  ];
  const sortFields: SortFieldConfig[] = [
    { field: 'title', label: tCommon('labels.title') },
    { field: 'updated_at', label: tCommon('labels.updated') },
    { field: 'created_at', label: tCommon('labels.created') },
  ];

  const result = await listProgramEventSeriesTableAdmin({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    sort: query.sorts?.map((sort) => ({ field: sort.field, order: sort.direction })),
    filter: query.filters,
  });

  return (
    <>
      <AdminPageHeader
        title={seriesLabel}
        items={[
          {
            key: 'create-event-series',
            type: 'custom',
            content: <CreateProgramEventSeriesButton />,
          },
        ]}
      />

      <ServerDataTable namespace="eventSeries">
        <ProgramEventSeriesTableContent
          result={result}
          filterFields={filterFields}
          sortFields={sortFields}
          searchPlaceholder={tCommon('actions.searchItems', {
            items: seriesLabel.toLowerCase(),
          })}
        />
        <ServerDataTable.Pagination namespace="eventSeries" result={result} searchParams={params} />
      </ServerDataTable>
    </>
  );
}
