import { getTranslations } from 'next-intl/server';
import { Stack } from '@mantine/core';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable, type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { ClientModalProvider, ClientModals, ClientsTableContent, CreateClientButton } from '@/features/admin/client';
import { listClientsAdmin } from '@/lib/queries/client';
import { parseTableQuery } from '@/lib/utils/table-url';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminClientsPage({ searchParams }: PageProps) {
  const tCommon = await getTranslations('common');
  const tCommonEntities = await getTranslations('common.entities');
  const searchPlaceholder = tCommon('placeholders.searchClients');
  const params = new URLSearchParams();
  const resolved = await searchParams;
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const query = parseTableQuery(params, 'clients');
  const filterFields: FilterFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name'), type: 'string' },
    { field: 'website', label: tCommon('labels.website'), type: 'string' },
    { field: 'created_at', label: tCommon('labels.created'), type: 'date' },
  ];

  const sortFields: SortFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name') },
    { field: 'workCount', label: tCommon('labels.works') },
    { field: 'created_at', label: tCommon('labels.created') },
  ];

  const result = await listClientsAdmin({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    sort: query.sorts?.map((s) => ({ field: s.field, order: s.direction })),
    filter: query.filters,
    filterBy: query.filterBy,
  });

  return (
    <ClientModalProvider>
      <Stack>
        <AdminPageHeader
          title={tCommonEntities('clients')}
          items={[{ key: 'create-client', type: 'custom', content: <CreateClientButton /> }]}
        />

        <ServerDataTable namespace="clients">
          <ClientsTableContent
            result={result}
            searchPlaceholder={searchPlaceholder}
            filterFields={filterFields}
            sortFields={sortFields}
          />
          <ServerDataTable.Pagination namespace="clients" result={result} searchParams={params} />
        </ServerDataTable>
      </Stack>

      <ClientModals />
    </ClientModalProvider>
  );
}
