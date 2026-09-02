import { getTranslations } from 'next-intl/server';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable, type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { CreatePageButton, PageModalProvider, PageModals, PagesTableContent } from '@/features/admin/cms-page';
import { listPagesAdmin } from '@/lib/queries/page';
import { parseTableQuery } from '@/lib/utils/table-url';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminPagesPage({ searchParams }: PageProps) {
  const tCommon = await getTranslations('common');
  const pagesLabel = tCommon('entities.pages');
  const searchPlaceholder = tCommon('actions.searchItems', { items: pagesLabel.toLowerCase() });
  const params = new URLSearchParams();
  const resolved = await searchParams;
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const query = parseTableQuery(params, 'pages');
  const filterFields: FilterFieldConfig[] = [
    { field: 'title', label: tCommon('labels.title'), type: 'string' },
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
    { field: 'title', label: tCommon('labels.title') },
    { field: 'status', label: tCommon('labels.status') },
    { field: 'created_at', label: tCommon('labels.created') },
    { field: 'updated_at', label: tCommon('labels.updated') },
  ];

  const result = await listPagesAdmin({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    sort: query.sorts?.map((s) => ({ field: s.field, order: s.direction })),
    filter: query.filters,
    filterBy: query.filterBy,
  });

  return (
    <PageModalProvider>
      <AdminPageHeader
        title={pagesLabel}
        items={[{ key: 'create-page', type: 'custom', content: <CreatePageButton /> }]}
      />

      <ServerDataTable namespace="pages">
        <PagesTableContent
          result={result}
          searchPlaceholder={searchPlaceholder}
          filterFields={filterFields}
          sortFields={sortFields}
        />
        <ServerDataTable.Pagination namespace="pages" result={result} searchParams={params} />
      </ServerDataTable>

      <PageModals />
    </PageModalProvider>
  );
}
