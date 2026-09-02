import { getTranslations } from 'next-intl/server';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable, type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { CreateLabelButton, LabelsTableContent } from '@/features/admin/label';
import { listLabelsAdmin } from '@/lib/queries/label';
import { parseTableQuery } from '@/lib/utils/table-url';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminLabelsPage({ searchParams }: PageProps) {
  const tCommon = await getTranslations('common');
  const labelsLabel = tCommon('entities.labels');
  const searchPlaceholder = tCommon('actions.searchItems', { items: labelsLabel.toLowerCase() });
  const params = new URLSearchParams();
  const resolved = await searchParams;
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const query = parseTableQuery(params, 'labels');
  const filterFields: FilterFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name'), type: 'string' },
    {
      field: 'status',
      label: tCommon('labels.status'),
      type: 'string',
      options: [
        { value: 'draft', label: tCommon('statuses.draft') },
        { value: 'published', label: tCommon('statuses.published') },
      ],
    },
    { field: 'country_code', label: tCommon('labels.country'), type: 'string' },
    { field: 'created_at', label: tCommon('labels.created'), type: 'date' },
  ];

  const sortFields: SortFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name') },
    { field: 'releaseCount', label: tCommon('entities.releases') },
    { field: 'created_at', label: tCommon('labels.created') },
  ];

  const result = await listLabelsAdmin({
    filter: query.filters as never,
    filterBy: (query.filterBy || 'AND') as 'AND' | 'OR',
    sort: query.sorts?.map((s) => ({ field: s.field, order: s.direction })),
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
  });

  return (
    <>
      <AdminPageHeader
        title={labelsLabel}
        items={[{ key: 'create-label', type: 'custom', content: <CreateLabelButton /> }]}
      />

      <ServerDataTable namespace="labels">
        <LabelsTableContent
          result={result}
          searchPlaceholder={searchPlaceholder}
          filterFields={filterFields}
          sortFields={sortFields}
        />
        <ServerDataTable.Pagination namespace="labels" result={result} searchParams={params} />
      </ServerDataTable>
    </>
  );
}
