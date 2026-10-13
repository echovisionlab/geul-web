import { unwrapQueryResult } from '@/lib/api/query-result';
import { getTranslations } from 'next-intl/server';
import { type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { FormatsPageView } from '@/features/admin/format/FormatsPageView';
import { listFormatsAdminAction } from '@/lib/actions/format';
import { parseTableQuery } from '@/lib/utils/table-url';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminFormatsPage({ searchParams }: PageProps) {
  const tCommon = await getTranslations('common');
  const formatsLabel = tCommon('entities.formats');
  const searchPlaceholder = tCommon('actions.searchItems', { items: formatsLabel.toLowerCase() });
  const filterFields: FilterFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name'), type: 'string' },
    { field: 'slug', label: tCommon('labels.slug'), type: 'string' },
  ];

  const sortFields: SortFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name') },
    { field: 'releaseCount', label: tCommon('entities.releases') },
    { field: 'sort_order', label: tCommon('labels.order') },
  ];

  const params = new URLSearchParams();
  const resolved = await searchParams;
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const query = parseTableQuery(params, 'formats');
  const result = await listFormatsAdminAction({
    sort: query.sorts?.map((s) => ({ field: s.field, order: s.direction })),
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
  }).then(unwrapQueryResult);

  return (
    <FormatsPageView
      title={formatsLabel}
      result={result}
      filterFields={filterFields}
      sortFields={sortFields}
      searchPlaceholder={searchPlaceholder}
      searchParams={params.toString()}
    />
  );
}
