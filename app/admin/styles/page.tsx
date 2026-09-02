import { getTranslations } from 'next-intl/server';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable, type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { CreateStyleButton, StyleModalProvider, StyleModals, StylesTableContent } from '@/features/admin/style';
import { listStylesAdminAction } from '@/lib/actions/style';
import { parseTableQuery } from '@/lib/utils/table-url';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminStylesPage({ searchParams }: PageProps) {
  const tCommon = await getTranslations('common');
  const stylesLabel = tCommon('entities.styles');
  const searchPlaceholder = tCommon('actions.searchItems', { items: stylesLabel.toLowerCase() });
  const params = new URLSearchParams();
  const resolved = await searchParams;
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const query = parseTableQuery(params, 'styles');
  const filterFields: FilterFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name'), type: 'string' },
    { field: 'slug', label: tCommon('labels.slug'), type: 'string' },
    { field: 'description', label: tCommon('labels.description'), type: 'string' },
  ];

  const sortFields: SortFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name') },
    { field: 'releaseCount', label: tCommon('entities.releases') },
    { field: 'created_at', label: tCommon('labels.created') },
  ];

  const rawResult = await listStylesAdminAction({
    sort: query.sorts?.map((s) => ({ field: s.field, order: s.direction })),
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
  });

  // Transform the result to match ServerDataTable expected format
  const result = {
    data: rawResult.data,
    total: rawResult.total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.ceil(rawResult.total / query.pageSize),
  };

  return (
    <StyleModalProvider>
      <AdminPageHeader
        title={stylesLabel}
        items={[{ key: 'create-style', type: 'custom', content: <CreateStyleButton /> }]}
      />

      <ServerDataTable namespace="styles">
        <StylesTableContent
          result={result}
          searchPlaceholder={searchPlaceholder}
          filterFields={filterFields}
          sortFields={sortFields}
        />
        <ServerDataTable.Pagination namespace="styles" result={result} searchParams={params} />
      </ServerDataTable>

      <StyleModals />
    </StyleModalProvider>
  );
}
