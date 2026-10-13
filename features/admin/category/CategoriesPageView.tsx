'use client';
import type { ComponentProps } from 'react';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { ServerDataTablePaginationClient } from '@/features/data-table/ServerDataTable/ServerDataTablePaginationClient';
import {
  CategoriesTableContent,
  CategoryModals,
  CategoryModalProvider,
  CreateCategoryButton,
} from '@/features/admin/category';
export interface CategoriesPageViewProps extends ComponentProps<typeof CategoriesTableContent> {
  title: string;
  searchParams: string;
  description?: string;
  modalBindings?: ComponentProps<typeof CategoryModals>;
}
export function CategoriesPageView({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  title,
  searchParams,
  modalBindings,
  deleteAction,
}: CategoriesPageViewProps) {
  return (
    <CategoryModalProvider>
      <AdminPageHeader
        title={title}
        items={[{ key: 'create-category', type: 'custom', content: <CreateCategoryButton /> }]}
      />

      <ServerDataTable namespace="categories" accessibleLabel={title}>
        <CategoriesTableContent
          result={result}
          searchPlaceholder={searchPlaceholder}
          filterFields={filterFields}
          sortFields={sortFields}
          deleteAction={deleteAction}
        />
        <ServerDataTablePaginationClient
          namespace="categories"
          result={result}
          searchParams={new URLSearchParams(searchParams)}
        />
      </ServerDataTable>

      <CategoryModals
        createAction={modalBindings?.createAction}
        deleteAction={modalBindings?.deleteAction}
        updateAction={modalBindings?.updateAction}
        refresh={modalBindings?.refresh}
      />
    </CategoryModalProvider>
  );
}
