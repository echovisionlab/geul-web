import { getTranslations } from 'next-intl/server';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable, type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import {
  CreateUserTagButton,
  UserTagModalProvider,
  UserTagModals,
  UserTagsTableContent,
} from '@/features/admin/user-tag';
import { listUserTagsAdminAction } from '@/lib/actions/user-tag';
import { parseTableQuery } from '@/lib/utils/table-url';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminUserTagsPage({ searchParams }: PageProps) {
  const tCommon = await getTranslations('common');
  const tCommonEntities = await getTranslations('common.entities');
  const tPage = await getTranslations('adminList.userTags');
  const searchPlaceholder = tCommon('placeholders.searchTags');
  const params = new URLSearchParams();
  const resolved = await searchParams;
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const query = parseTableQuery(params, 'userTags');
  const filterFields: FilterFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name'), type: 'string' },
    { field: 'created_at', label: tCommon('labels.created'), type: 'date' },
  ];

  const sortFields: SortFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name') },
    { field: 'user_count', label: tCommon('entities.users') },
    { field: 'created_at', label: tCommon('labels.created') },
  ];

  const result = await listUserTagsAdminAction({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    sort: query.sorts?.map((s) => ({ field: s.field, order: s.direction })),
    filter: query.filters,
    filterBy: query.filterBy,
  });

  return (
    <UserTagModalProvider>
      <AdminPageHeader
        title={tCommonEntities('userTags')}
        description={tPage('description')}
        items={[{ key: 'create-user-tag', type: 'custom', content: <CreateUserTagButton /> }]}
      />

      <ServerDataTable namespace="userTags">
        <UserTagsTableContent
          result={result}
          searchPlaceholder={searchPlaceholder}
          filterFields={filterFields}
          sortFields={sortFields}
        />
        <ServerDataTable.Pagination namespace="userTags" result={result} searchParams={params} />
      </ServerDataTable>

      <UserTagModals />
    </UserTagModalProvider>
  );
}
