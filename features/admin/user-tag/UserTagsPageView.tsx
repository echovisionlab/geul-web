'use client';
import type { ComponentProps } from 'react';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { ServerDataTablePaginationClient } from '@/features/data-table/ServerDataTable/ServerDataTablePaginationClient';
import {
  UserTagsTableContent,
  UserTagModals,
  UserTagModalProvider,
  CreateUserTagButton,
} from '@/features/admin/user-tag';
export interface UserTagsPageViewProps extends ComponentProps<typeof UserTagsTableContent> {
  title: string;
  searchParams: string;
  description?: string;
  modalBindings?: ComponentProps<typeof UserTagModals>;
}
export function UserTagsPageView({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  title,
  searchParams,
  modalBindings,
  deleteAction,
  description,
}: UserTagsPageViewProps) {
  return (
    <UserTagModalProvider>
      <AdminPageHeader
        title={title}
        description={description}
        items={[{ key: 'create-user-tag', type: 'custom', content: <CreateUserTagButton /> }]}
      />

      <ServerDataTable namespace="userTags" accessibleLabel={title}>
        <UserTagsTableContent
          result={result}
          searchPlaceholder={searchPlaceholder}
          filterFields={filterFields}
          sortFields={sortFields}
          deleteAction={deleteAction}
        />
        <ServerDataTablePaginationClient
          namespace="userTags"
          result={result}
          searchParams={new URLSearchParams(searchParams)}
        />
      </ServerDataTable>

      <UserTagModals
        createAction={modalBindings?.createAction}
        deleteAction={modalBindings?.deleteAction}
        refresh={modalBindings?.refresh}
      />
    </UserTagModalProvider>
  );
}
