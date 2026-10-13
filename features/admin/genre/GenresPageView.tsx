'use client';
import type { ComponentProps } from 'react';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { ServerDataTablePaginationClient } from '@/features/data-table/ServerDataTable/ServerDataTablePaginationClient';
import { GenresTableContent, GenreModals, GenreModalProvider, CreateGenreButton } from '@/features/admin/genre';
export interface GenresPageViewProps extends ComponentProps<typeof GenresTableContent> {
  title: string;
  searchParams: string;
  description?: string;
  modalBindings?: ComponentProps<typeof GenreModals>;
}
export function GenresPageView({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  title,
  searchParams,
  modalBindings,
  deleteAction,
}: GenresPageViewProps) {
  return (
    <GenreModalProvider>
      <AdminPageHeader
        title={title}
        items={[{ key: 'create-genre', type: 'custom', content: <CreateGenreButton /> }]}
      />

      <ServerDataTable namespace="genres" accessibleLabel={title}>
        <GenresTableContent
          result={result}
          searchPlaceholder={searchPlaceholder}
          filterFields={filterFields}
          sortFields={sortFields}
          deleteAction={deleteAction}
        />
        <ServerDataTablePaginationClient
          namespace="genres"
          result={result}
          searchParams={new URLSearchParams(searchParams)}
        />
      </ServerDataTable>

      <GenreModals
        createAction={modalBindings?.createAction}
        deleteAction={modalBindings?.deleteAction}
        updateAction={modalBindings?.updateAction}
        refresh={modalBindings?.refresh}
      />
    </GenreModalProvider>
  );
}
