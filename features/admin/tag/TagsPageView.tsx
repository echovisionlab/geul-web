'use client';
import type { ComponentProps } from 'react';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { ServerDataTablePaginationClient } from '@/features/data-table/ServerDataTable/ServerDataTablePaginationClient';
import { TagsTableContent, TagModals, TagModalProvider, CreateTagButton } from '@/features/admin/tag';
export interface TagsPageViewProps extends ComponentProps<typeof TagsTableContent> {
  title: string;
  searchParams: string;
  description?: string;
  modalBindings?: ComponentProps<typeof TagModals>;
}
export function TagsPageView({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  title,
  searchParams,
  modalBindings,
  deleteAction,
}: TagsPageViewProps) {
  return (
    <TagModalProvider>
      <AdminPageHeader title={title} items={[{ key: 'create-tag', type: 'custom', content: <CreateTagButton /> }]} />

      <ServerDataTable namespace="tags" accessibleLabel={title}>
        <TagsTableContent
          result={result}
          searchPlaceholder={searchPlaceholder}
          filterFields={filterFields}
          sortFields={sortFields}
          deleteAction={deleteAction}
        />
        <ServerDataTablePaginationClient
          namespace="tags"
          result={result}
          searchParams={new URLSearchParams(searchParams)}
        />
      </ServerDataTable>

      <TagModals
        createAction={modalBindings?.createAction}
        deleteAction={modalBindings?.deleteAction}
        updateAction={modalBindings?.updateAction}
        refresh={modalBindings?.refresh}
      />
    </TagModalProvider>
  );
}
