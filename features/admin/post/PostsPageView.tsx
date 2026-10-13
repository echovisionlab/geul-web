'use client';
import type { ComponentProps } from 'react';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { ServerDataTablePaginationClient } from '@/features/data-table/ServerDataTable/ServerDataTablePaginationClient';
import { PostsTableContent, PostModals, PostModalProvider, CreatePostButton } from '@/features/admin/post';
export interface PostsPageViewProps extends ComponentProps<typeof PostsTableContent> {
  title: string;
  searchParams: string;
  createBindings?: ComponentProps<typeof CreatePostButton>;
  modalBindings?: ComponentProps<typeof PostModals>;
}
export function PostsPageView({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  title,
  searchParams,
  createBindings,
  modalBindings,
  deleteAction,
}: PostsPageViewProps) {
  return (
    <PostModalProvider>
      <AdminPageHeader
        title={title}
        items={[
          {
            key: 'create-post',
            type: 'custom',
            content: (
              <CreatePostButton createAction={createBindings?.createAction} onCreated={createBindings?.onCreated} />
            ),
          },
        ]}
      />

      <ServerDataTable namespace="posts" accessibleLabel={title}>
        <PostsTableContent
          result={result}
          filterFields={filterFields}
          sortFields={sortFields}
          deleteAction={deleteAction}
          searchPlaceholder={searchPlaceholder}
        />
        <ServerDataTablePaginationClient
          namespace="posts"
          result={result}
          searchParams={new URLSearchParams(searchParams)}
        />
      </ServerDataTable>

      <PostModals deleteAction={modalBindings?.deleteAction} onDeleted={modalBindings?.onDeleted} />
    </PostModalProvider>
  );
}
