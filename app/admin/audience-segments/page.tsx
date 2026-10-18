import { SegmentsPageView } from '@/features/admin/segment/SegmentsPageView';
import { unwrapQueryResult } from '@/lib/api/query-result';
import { getTranslations } from 'next-intl/server';
import { type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { listSegmentsAdminAction } from '@/lib/actions/audience';
import { toPaginatedListInput } from '@/lib/types/common/query';
import { parseTableQuery } from '@/lib/utils/table-url';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminSegmentsPage({ searchParams }: PageProps) {
  const tCommon = await getTranslations('common');
  const tCommonEntities = await getTranslations('common.entities');
  const tPage = await getTranslations('adminList.audienceSegments');
  const searchPlaceholder = tPage('searchPlaceholder');
  const params = new URLSearchParams();
  const resolved = await searchParams;
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const query = parseTableQuery(params, 'segments');
  const filterFields: FilterFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name'), type: 'string' },
    { field: 'created_at', label: tCommon('labels.created'), type: 'date' },
  ];

  const sortFields: SortFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name') },
    { field: 'segment_type', label: tCommon('labels.type') },
    { field: 'created_at', label: tCommon('labels.created') },
  ];

  const result = await listSegmentsAdminAction({
    ...toPaginatedListInput(query),
    includeArchived: params.get('includeArchived') === 'true',
  }).then(unwrapQueryResult);

  return (
    <SegmentsPageView
      result={result}
      filterFields={filterFields}
      sortFields={sortFields}
      searchParams={params.toString()}
      title={tCommonEntities('audienceSegments')}
      searchPlaceholder={searchPlaceholder}
      description={tPage('description')}
    />
  );
}
