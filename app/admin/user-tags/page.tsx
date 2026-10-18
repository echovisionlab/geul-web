import { unwrapQueryResult } from '@/lib/api/query-result';
import { getTranslations } from 'next-intl/server';
import { type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { UserTagsPageView } from '@/features/admin/user-tag/UserTagsPageView';
import { listUserTagsAdminAction } from '@/lib/actions/user-tag';
import { toPaginatedListInput } from '@/lib/types/common/query';
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

  const result = await listUserTagsAdminAction(toPaginatedListInput(query)).then(unwrapQueryResult);

  return (
    <UserTagsPageView
      title={tCommonEntities('userTags')}
      result={result}
      filterFields={filterFields}
      sortFields={sortFields}
      searchPlaceholder={searchPlaceholder}
      searchParams={params.toString()}
      description={tPage('description')}
    />
  );
}
