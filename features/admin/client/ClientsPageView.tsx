'use client';
import type { ComponentProps } from 'react';
import { ServerDataTablePaginationClient } from '@/features/data-table/ServerDataTable/ServerDataTablePaginationClient';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { ClientsTableContent, ClientModals, ClientModalProvider, CreateClientButton } from '@/features/admin/client';
export interface ClientsPageViewProps extends ComponentProps<typeof ClientsTableContent> {
  title: string;
  searchParams: string;
  modalBindings?: ComponentProps<typeof ClientModals>;
  createBindings?: ComponentProps<typeof CreateClientButton>;
}
export function ClientsPageView({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  title,
  searchParams,
  modalBindings,
  deleteAction,
  createBindings,
}: ClientsPageViewProps) {
  return (
    <ClientModalProvider>
      <DsLayoutStack>
        <AdminPageHeader
          title={title}
          items={[
            {
              key: 'create-client',
              type: 'custom',
              content: (
                <CreateClientButton createAction={createBindings?.createAction} onCreated={createBindings?.onCreated} />
              ),
            },
          ]}
        />

        <ServerDataTable namespace="clients" accessibleLabel={title}>
          <ClientsTableContent
            result={result}
            searchPlaceholder={searchPlaceholder}
            filterFields={filterFields}
            sortFields={sortFields}
            deleteAction={deleteAction}
          />
          <ServerDataTablePaginationClient
            namespace="clients"
            result={result}
            searchParams={new URLSearchParams(searchParams)}
          />
        </ServerDataTable>
      </DsLayoutStack>

      <ClientModals deleteAction={modalBindings?.deleteAction} onDeleted={modalBindings?.onDeleted} />
    </ClientModalProvider>
  );
}
