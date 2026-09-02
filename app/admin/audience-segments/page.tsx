import { getTranslations } from 'next-intl/server';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable, type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { CreateSegmentButton } from '@/features/admin/segment/CreateSegmentButton';
import { AudienceArchiveFilter } from '@/features/admin/segment/AudienceArchiveFilter';
import { SegmentModalProvider } from '@/features/admin/segment/SegmentModalContext';
import { SegmentModals } from '@/features/admin/segment/SegmentModals';
import { SegmentsTableContent } from '@/features/admin/segment/SegmentsTableContent';
import { listSegmentsAdminAction } from '@/lib/actions/audience';
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
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    sort: query.sorts?.map((s) => ({ field: s.field, order: s.direction })),
    filter: query.filters,
    filterBy: query.filterBy,
    includeArchived: params.get('includeArchived') === 'true',
  });

  return (
    <SegmentModalProvider>
      <AdminPageHeader
        title={tCommonEntities('audienceSegments')}
        description={tPage('description')}
        items={[
          {
            key: 'include-archived',
            type: 'custom',
            content: <AudienceArchiveFilter />,
          },
          { key: 'create-segment', type: 'custom', content: <CreateSegmentButton /> },
        ]}
      />

      <ServerDataTable namespace="segments">
        <SegmentsTableContent
          result={result}
          searchPlaceholder={searchPlaceholder}
          filterFields={filterFields}
          sortFields={sortFields}
        />
        <ServerDataTable.Pagination namespace="segments" result={result} searchParams={params} />
      </ServerDataTable>

      <SegmentModals />
    </SegmentModalProvider>
  );
}
