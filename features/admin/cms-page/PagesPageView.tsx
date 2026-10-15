'use client';
import type { ComponentProps } from 'react';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { ServerDataTablePaginationClient } from '@/features/data-table/ServerDataTable/ServerDataTablePaginationClient';
import { PagesTableContent, PageModals, PageModalProvider, CreatePageButton } from '@/features/admin/cms-page';
export interface PagesPageViewProps extends ComponentProps<typeof PagesTableContent> {
  title: string;
  searchParams: string;
  createBindings?: ComponentProps<typeof CreatePageButton>;
  modalBindings?: ComponentProps<typeof PageModals>;
}
export function PagesPageView({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  title,
  searchParams,
  createBindings,
  modalBindings,
  deleteAction,
}: PagesPageViewProps) {
  return (
    <PageModalProvider>
      <AdminPageHeader
        title={title}
        items={[
          {
            key: 'create-page',
            type: 'custom',
            content: (
              <CreatePageButton createAction={createBindings?.createAction} navigate={createBindings?.navigate} />
            ),
          },
        ]}
      />

      <ServerDataTable namespace="pages" accessibleLabel={title}>
        <PagesTableContent
          result={result}
          searchPlaceholder={searchPlaceholder}
          filterFields={filterFields}
          sortFields={sortFields}
          deleteAction={deleteAction}
        />
        <ServerDataTablePaginationClient
          namespace="pages"
          result={result}
          searchParams={new URLSearchParams(searchParams)}
        />
      </ServerDataTable>

      <PageModals deleteAction={modalBindings?.deleteAction} refresh={modalBindings?.refresh} />
    </PageModalProvider>
  );
}
