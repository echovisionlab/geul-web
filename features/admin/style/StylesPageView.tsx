'use client';
import type { ComponentProps } from 'react';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { ServerDataTablePaginationClient } from '@/features/data-table/ServerDataTable/ServerDataTablePaginationClient';
import { StylesTableContent, StyleModals, StyleModalProvider, CreateStyleButton } from '@/features/admin/style';
export interface StylesPageViewProps extends ComponentProps<typeof StylesTableContent> {
  title: string;
  searchParams: string;
  description?: string;
  modalBindings?: ComponentProps<typeof StyleModals>;
}
export function StylesPageView({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  title,
  searchParams,
  modalBindings,
  deleteAction,
}: StylesPageViewProps) {
  return (
    <StyleModalProvider>
      <AdminPageHeader
        title={title}
        items={[{ key: 'create-style', type: 'custom', content: <CreateStyleButton /> }]}
      />

      <ServerDataTable namespace="styles" accessibleLabel={title}>
        <StylesTableContent
          result={result}
          searchPlaceholder={searchPlaceholder}
          filterFields={filterFields}
          sortFields={sortFields}
          deleteAction={deleteAction}
        />
        <ServerDataTablePaginationClient
          namespace="styles"
          result={result}
          searchParams={new URLSearchParams(searchParams)}
        />
      </ServerDataTable>

      <StyleModals
        createAction={modalBindings?.createAction}
        deleteAction={modalBindings?.deleteAction}
        updateAction={modalBindings?.updateAction}
        refresh={modalBindings?.refresh}
      />
    </StyleModalProvider>
  );
}
