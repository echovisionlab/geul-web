'use client';
import type { ComponentProps } from 'react';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { ServerDataTablePaginationClient } from '@/features/data-table/ServerDataTable/ServerDataTablePaginationClient';
import { ProgramEventSeriesTableContent } from './ProgramEventSeriesTableContent';
import { CreateProgramEventSeriesButton } from './CreateProgramEventSeriesButton';
interface Props extends ComponentProps<typeof ProgramEventSeriesTableContent> {
  title: string;
  searchParams: string;
  createBindings?: ComponentProps<typeof CreateProgramEventSeriesButton>;
}
export function ProgramEventSeriesPageView({
  result,
  filterFields,
  sortFields,
  searchPlaceholder,
  title,
  searchParams,
  deleteAction,
  createBindings,
}: Props) {
  return (
    <>
      <AdminPageHeader
        title={title}
        items={[
          {
            key: 'create-event-series',
            type: 'custom',
            content: (
              <CreateProgramEventSeriesButton
                createAction={createBindings?.createAction}
                navigate={createBindings?.navigate}
              />
            ),
          },
        ]}
      />

      <ServerDataTable namespace="eventSeries" accessibleLabel={title}>
        <ProgramEventSeriesTableContent
          result={result}
          deleteAction={deleteAction}
          filterFields={filterFields}
          sortFields={sortFields}
          searchPlaceholder={searchPlaceholder}
        />
        <ServerDataTablePaginationClient
          namespace="eventSeries"
          result={result}
          searchParams={new URLSearchParams(searchParams)}
        />
      </ServerDataTable>
    </>
  );
}
