'use client';
import type { ComponentProps } from 'react';
import { ServerDataTablePaginationClient } from '@/features/data-table/ServerDataTable/ServerDataTablePaginationClient';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { CreateLabelButton, LabelsTableContent } from '@/features/admin/label';

export interface LabelsPageViewProps extends ComponentProps<typeof LabelsTableContent> {
  title: string;
  searchParams: string;
  createBindings?: ComponentProps<typeof CreateLabelButton>;
}
export function LabelsPageView({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  title,
  searchParams,
  createBindings,
  rowActions,
}: LabelsPageViewProps) {
  return (
    <>
      <AdminPageHeader
        title={title}
        items={[
          {
            key: 'create-label',
            type: 'custom',
            content: (
              <CreateLabelButton createAction={createBindings?.createAction} onCreated={createBindings?.onCreated} />
            ),
          },
        ]}
      />

      <ServerDataTable namespace="labels" accessibleLabel={title}>
        <LabelsTableContent
          rowActions={rowActions}
          result={result}
          searchPlaceholder={searchPlaceholder}
          filterFields={filterFields}
          sortFields={sortFields}
        />
        <ServerDataTablePaginationClient
          namespace="labels"
          result={result}
          searchParams={new URLSearchParams(searchParams)}
        />
      </ServerDataTable>
    </>
  );
}
