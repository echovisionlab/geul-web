import { getTranslations } from 'next-intl/server';

import { type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { ClientsPageView } from '@/features/admin/client/ClientsPageView';
import { listClientsAdmin } from '@/lib/queries/client';
import { toPaginatedListInput } from '@/lib/types/common/query';
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

  const result = await listClientsAdmin(toPaginatedListInput(query));

  return (
    <ClientsPageView
      title={tCommonEntities('clients')}
      result={result}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
      searchParams={params.toString()}
    />
  );
}
