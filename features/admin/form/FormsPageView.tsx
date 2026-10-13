'use client';
import type { ComponentProps } from 'react';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { ServerDataTablePaginationClient } from '@/features/data-table/ServerDataTable/ServerDataTablePaginationClient';
import { FormModalProvider, FormModals, FormsTableContent, CreateFormButton } from '@/features/admin/form';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
export interface FormsPageViewProps extends ComponentProps<typeof FormsTableContent> {
  title: string;
  searchParams: string;
  createBindings?: ComponentProps<typeof CreateFormButton>;
  modalBindings?: ComponentProps<typeof FormModals>;
}
export function FormsPageView({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  title,
  searchParams,
  createBindings,
  modalBindings,
  deleteAction,
}: FormsPageViewProps) {
  return (
    <FormModalProvider>
      <DsLayoutStack>
        <AdminPageHeader
          title={title}
          items={[
            {
              key: 'create-form',
              type: 'custom',
              content: (
                <CreateFormButton createAction={createBindings?.createAction} navigate={createBindings?.navigate} />
              ),
            },
          ]}
        />

        <ServerDataTable namespace="forms" accessibleLabel={title}>
          <FormsTableContent
            result={result}
            searchPlaceholder={searchPlaceholder}
            filterFields={filterFields}
            sortFields={sortFields}
            deleteAction={deleteAction}
          />
          <ServerDataTablePaginationClient
            namespace="forms"
            result={result}
            searchParams={new URLSearchParams(searchParams)}
          />
        </ServerDataTable>
      </DsLayoutStack>

      <FormModals deleteAction={modalBindings?.deleteAction} refresh={modalBindings?.refresh} />
    </FormModalProvider>
  );
}
