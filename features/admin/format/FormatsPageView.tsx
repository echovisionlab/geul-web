'use client';
import type { ComponentProps } from 'react';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { ServerDataTablePaginationClient } from '@/features/data-table/ServerDataTable/ServerDataTablePaginationClient';
import { FormatsTableContent, FormatModals, FormatModalProvider, CreateFormatButton } from '@/features/admin/format';
export interface FormatsPageViewProps extends ComponentProps<typeof FormatsTableContent> {
  title: string;
  searchParams: string;
  description?: string;
  modalBindings?: ComponentProps<typeof FormatModals>;
}
export function FormatsPageView({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  title,
  searchParams,
  modalBindings,
  deleteAction,
}: FormatsPageViewProps) {
  return (
    <FormatModalProvider>
      <AdminPageHeader
        title={title}
        items={[{ key: 'create-format', type: 'custom', content: <CreateFormatButton /> }]}
      />

      <ServerDataTable namespace="formats" accessibleLabel={title}>
        <FormatsTableContent
          result={result}
          searchPlaceholder={searchPlaceholder}
          filterFields={filterFields}
          sortFields={sortFields}
          deleteAction={deleteAction}
        />
        <ServerDataTablePaginationClient
          namespace="formats"
          result={result}
          searchParams={new URLSearchParams(searchParams)}
        />
      </ServerDataTable>

      <FormatModals
        createAction={modalBindings?.createAction}
        deleteAction={modalBindings?.deleteAction}
        updateAction={modalBindings?.updateAction}
        refresh={modalBindings?.refresh}
      />
    </FormatModalProvider>
  );
}
