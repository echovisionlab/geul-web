'use client';
import type { ComponentProps } from 'react';
import { ServerDataTablePaginationClient } from '@/features/data-table/ServerDataTable/ServerDataTablePaginationClient';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { SeriesTableContent, SeriesModals, SeriesModalProvider, CreateSeriesButton } from '@/features/admin/series';
export interface SeriesPageViewProps extends ComponentProps<typeof SeriesTableContent> {
  title: string;
  searchParams: string;
  modalBindings?: ComponentProps<typeof SeriesModals>;
}
export function SeriesPageView({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  title,
  searchParams,
  modalBindings,
  deleteAction,
}: SeriesPageViewProps) {
  return (
    <SeriesModalProvider>
      <AdminPageHeader
        title={title}
        items={[{ key: 'create-series', type: 'custom', content: <CreateSeriesButton /> }]}
      />

      <ServerDataTable namespace="series" accessibleLabel={title}>
        <SeriesTableContent
          result={result}
          searchPlaceholder={searchPlaceholder}
          filterFields={filterFields}
          sortFields={sortFields}
          deleteAction={deleteAction}
        />
        <ServerDataTablePaginationClient
          namespace="series"
          result={result}
          searchParams={new URLSearchParams(searchParams)}
        />
      </ServerDataTable>

      <SeriesModals
        createAction={modalBindings?.createAction}
        onCreated={modalBindings?.onCreated}
        deleteAction={modalBindings?.deleteAction}
        onDeleted={modalBindings?.onDeleted}
      />
    </SeriesModalProvider>
  );
}
