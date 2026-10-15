'use client';
import type { ComponentProps } from 'react';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { ServerDataTablePaginationClient } from '@/features/data-table/ServerDataTable/ServerDataTablePaginationClient';
import { ProgramEventsTableContent } from './ProgramEventsTableContent';
import { CreateProgramEventButton } from './CreateProgramEventButton';
import { ProgramEventTypeManagerButton, type ProgramEventTypeBindings } from './ProgramEventTypeManager';
interface Props extends ComponentProps<typeof ProgramEventsTableContent> {
  title: string;
  searchParams: string;
  createBindings?: ComponentProps<typeof CreateProgramEventButton>;
  eventTypes: ComponentProps<typeof ProgramEventTypeManagerButton>['initialTypes'];
  typeBindings?: ProgramEventTypeBindings;
}
export function ProgramEventsPageView({
  result,
  filterFields,
  sortFields,
  searchPlaceholder,
  title,
  searchParams,
  deleteAction,
  createBindings,
  eventTypes,
  typeBindings,
}: Props) {
  return (
    <>
      <AdminPageHeader
        title={title}
        items={[
          {
            key: 'manage-program-event-types',
            type: 'custom',
            content: <ProgramEventTypeManagerButton initialTypes={eventTypes} bindings={typeBindings} />,
          },
          {
            key: 'create-program-event',
            type: 'custom',
            content: (
              <CreateProgramEventButton
                createAction={createBindings?.createAction}
                navigate={createBindings?.navigate}
              />
            ),
          },
        ]}
      />
      <ServerDataTable namespace="events" accessibleLabel={title}>
        <ProgramEventsTableContent
          result={result}
          deleteAction={deleteAction}
          filterFields={filterFields}
          sortFields={sortFields}
          searchPlaceholder={searchPlaceholder}
        />
        <ServerDataTablePaginationClient
          namespace="events"
          result={result}
          searchParams={new URLSearchParams(searchParams)}
        />
      </ServerDataTable>
    </>
  );
}
