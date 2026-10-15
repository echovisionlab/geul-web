import { FormsPageView } from '@/features/admin/form/FormsPageView';
import { unwrapQueryResult } from '@/lib/api/query-result';
import { getTranslations } from 'next-intl/server';

import { type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { listFormsAdminAction } from '@/lib/actions/form';
import { parseTableQuery } from '@/lib/utils/table-url';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminFormsPage({ searchParams }: PageProps) {
  const tCommon = await getTranslations('common');
  const formsLabel = tCommon('entities.forms');
  const searchPlaceholder = tCommon('actions.searchItems', { items: formsLabel.toLowerCase() });
  const params = new URLSearchParams();
  const resolved = await searchParams;
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const query = parseTableQuery(params, 'forms');
  const filterFields: FilterFieldConfig[] = [
    { field: 'title', label: tCommon('labels.title'), type: 'string' },
    {
      field: 'status',
      label: tCommon('labels.status'),
      type: 'string',
      options: [
        { value: 'draft', label: tCommon('statuses.draft') },
        { value: 'published', label: tCommon('statuses.published') },
      ],
    },
    {
      field: 'is_public',
      label: tCommon('labels.public'),
      type: 'boolean',
    },
    { field: 'created_at', label: tCommon('labels.created'), type: 'date' },
  ];

  const sortFields: SortFieldConfig[] = [
    { field: 'title', label: tCommon('labels.title') },
    { field: 'created_at', label: tCommon('labels.created') },
    { field: 'status', label: tCommon('labels.status') },
  ];

  const result = await listFormsAdminAction({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    sort: query.sorts?.map((s) => ({ field: s.field, order: s.direction })),
    filterBy: query.filterBy,
  }).then(unwrapQueryResult);

  return (
    <FormsPageView
      title={formsLabel}
      result={result}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
      searchParams={params.toString()}
    />
  );
}
