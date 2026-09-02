import { getTranslations } from 'next-intl/server';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable, type FilterFieldConfig, type SortFieldConfig } from '@/features/data-table/ServerDataTable';
import { CreateProgramEventButton } from '@/features/admin/program-event/CreateProgramEventButton';
import { ProgramEventTypeManagerButton } from '@/features/admin/program-event/ProgramEventTypeManager';
import { ProgramEventsTableContent } from '@/features/admin/program-event/ProgramEventsTableContent';
import {
  listProgramEventsAdmin,
  listProgramEventTypesAdmin,
  toManageProgramEventStatusFilterValue,
} from '@/lib/queries/program-event';
import { parseTableQuery } from '@/lib/utils/table-url';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminProgramEventsPage({ searchParams }: PageProps) {
  const tCommon = await getTranslations('common');
  const tProgramEventAdmin = await getTranslations('programEventAdmin');
  const programEventsLabel = tCommon('entities.programEvents');
  const params = new URLSearchParams();
  const resolved = await searchParams;
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const query = parseTableQuery(params, 'events');
  const filterFields: FilterFieldConfig[] = [
    { field: 'search', label: tProgramEventAdmin('list.search'), type: 'string' },
    {
      field: 'status',
      label: tCommon('labels.status'),
      type: 'string',
      options: [
        { value: toManageProgramEventStatusFilterValue('draft'), label: tCommon('statuses.draft') },
        {
          value: toManageProgramEventStatusFilterValue('published'),
          label: tCommon('statuses.published'),
        },
        {
          value: toManageProgramEventStatusFilterValue('archived'),
          label: tCommon('statuses.archived'),
        },
      ],
    },
    { field: 'starts_at', label: tProgramEventAdmin('list.starts'), type: 'date' },
    { field: 'published_at', label: tCommon('labels.published'), type: 'date' },
  ];
  const sortFields: SortFieldConfig[] = [
    { field: 'starts_at', label: tProgramEventAdmin('list.starts') },
    { field: 'published_at', label: tCommon('labels.published') },
    { field: 'updated_at', label: tCommon('labels.updated') },
    { field: 'created_at', label: tCommon('labels.created') },
  ];

  const [result, eventTypes] = await Promise.all([
    listProgramEventsAdmin({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      sort: query.sorts?.map((s) => ({ field: s.field, order: s.direction })),
      filter: query.filters,
    }),
    listProgramEventTypesAdmin(),
  ]);

  return (
    <>
      <AdminPageHeader
        title={programEventsLabel}
        items={[
          {
            key: 'manage-program-event-types',
            type: 'custom',
            content: <ProgramEventTypeManagerButton initialTypes={eventTypes} />,
          },
          { key: 'create-program-event', type: 'custom', content: <CreateProgramEventButton /> },
        ]}
      />
      <ServerDataTable namespace="events">
        <ProgramEventsTableContent
          result={result}
          filterFields={filterFields}
          sortFields={sortFields}
          searchPlaceholder={tCommon('actions.searchItems', {
            items: programEventsLabel.toLowerCase(),
          })}
        />
        <ServerDataTable.Pagination namespace="events" result={result} searchParams={params} />
      </ServerDataTable>
    </>
  );
}
