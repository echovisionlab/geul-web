'use client';
import type { ComponentProps } from 'react';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { ServerDataTablePaginationClient } from '@/features/data-table/ServerDataTable/ServerDataTablePaginationClient';
import { UsersTableContent } from './UsersTableContent';
import { UserModals } from './UserModals';
import { UserModalProvider } from './UserModalContext';
interface Props extends ComponentProps<typeof UsersTableContent> {
  title: string;
  searchParams: string;
  modalBindings?: ComponentProps<typeof UserModals>;
}
export function UsersPageView({
  result,
  filterFields,
  sortFields,
  searchPlaceholder,
  title,
  searchParams,
  modalBindings,
  deleteAction,
}: Props) {
  return (
    <UserModalProvider>
      <AdminPageHeader title={title} />

      <ServerDataTable namespace="users" accessibleLabel={title}>
        <UsersTableContent
          result={result}
          deleteAction={deleteAction}
          searchPlaceholder={searchPlaceholder}
          filterFields={filterFields}
          sortFields={sortFields}
        />
        <ServerDataTablePaginationClient
          namespace="users"
          result={result}
          searchParams={new URLSearchParams(searchParams)}
        />
      </ServerDataTable>

      <UserModals bindings={modalBindings?.bindings} refresh={modalBindings?.refresh} />
    </UserModalProvider>
  );
}
