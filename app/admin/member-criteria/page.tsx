import { MemberCriteriaPageView } from '@/features/admin/member-criteria/MemberCriteriaPageView';
import { unwrapQueryResult } from '@/lib/api/query-result';
import { getTranslations } from 'next-intl/server';
import { type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { listMemberCriteriaAdminAction } from '@/lib/actions/member-criteria';
import { toPaginatedListInput } from '@/lib/types/common/query';
import { parseTableQuery } from '@/lib/utils/table-url';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminCriteriaListPage({ searchParams }: PageProps) {
  const tCommon = await getTranslations('common');
  const tCommonEntities = await getTranslations('common.entities');
  const tPage = await getTranslations('adminList.memberCriteria');
  const searchPlaceholder = tPage('searchPlaceholder');
  const params = new URLSearchParams();
  const resolved = await searchParams;
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const query = parseTableQuery(params, 'memberCriteria');
  const filterFields: FilterFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name'), type: 'string' },
    { field: 'created_at', label: tCommon('labels.created'), type: 'date' },
  ];

  const sortFields: SortFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name') },
    { field: 'criteria_type', label: tCommon('labels.type') },
    { field: 'created_at', label: tCommon('labels.created') },
  ];

  const result = await listMemberCriteriaAdminAction({
    ...toPaginatedListInput(query),
    includeArchived: params.get('includeArchived') === 'true',
  }).then(unwrapQueryResult);

  return (
    <MemberCriteriaPageView
      result={result}
      filterFields={filterFields}
      sortFields={sortFields}
      searchParams={params.toString()}
      title={tCommonEntities('memberCriteria')}
      searchPlaceholder={searchPlaceholder}
      description={tPage('description')}
    />
  );
}
