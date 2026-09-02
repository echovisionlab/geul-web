import { getTranslations } from 'next-intl/server';
import { Stack } from '@mantine/core';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable, type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { CreateFormButton, FormModalProvider, FormModals, FormsTableContent } from '@/features/admin/form';
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
  });

  return (
    <FormModalProvider>
      <Stack>
        <AdminPageHeader
          title={formsLabel}
          items={[{ key: 'create-form', type: 'custom', content: <CreateFormButton /> }]}
        />

        <ServerDataTable namespace="forms">
          <FormsTableContent
            result={result}
            searchPlaceholder={searchPlaceholder}
            filterFields={filterFields}
            sortFields={sortFields}
          />
          <ServerDataTable.Pagination namespace="forms" result={result} searchParams={params} />
        </ServerDataTable>
      </Stack>

      <FormModals />
    </FormModalProvider>
  );
}
