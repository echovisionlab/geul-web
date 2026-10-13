'use client';
import type { ComponentProps } from 'react';
import { ServerDataTablePaginationClient } from '@/features/data-table/ServerDataTable/ServerDataTablePaginationClient';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';

import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import {
  CreateReleaseButton,
  ReleaseModalProvider,
  ReleaseModals,
  ReleasesTableContent,
} from '@/features/admin/release';

export interface ReleasesPageViewProps extends ComponentProps<typeof ReleasesTableContent> {
  title: string;
  searchParams: string;
  createBindings?: ComponentProps<typeof CreateReleaseButton>;
  modalBindings?: ComponentProps<typeof ReleaseModals>;
}
export function ReleasesPageView({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  title,
  searchParams,
  createBindings,
  modalBindings,
  deleteAction,
}: ReleasesPageViewProps) {
  return (
    <ReleaseModalProvider>
      <DsLayoutStack>
        <AdminPageHeader
          title={title}
          items={[
            {
              key: 'create-release',
              type: 'custom',
              content: (
                <CreateReleaseButton
                  createAction={createBindings?.createAction}
                  onCreated={createBindings?.onCreated}
                />
              ),
            },
          ]}
        />

        <ServerDataTable namespace="releases" accessibleLabel={title}>
          <ReleasesTableContent
            deleteAction={deleteAction}
            result={result}
            searchPlaceholder={searchPlaceholder}
            filterFields={filterFields}
            sortFields={sortFields}
          />
          <ServerDataTablePaginationClient
            namespace="releases"
            result={result}
            searchParams={new URLSearchParams(searchParams)}
          />
        </ServerDataTable>
      </DsLayoutStack>

      <ReleaseModals deleteAction={modalBindings?.deleteAction} onDeleted={modalBindings?.onDeleted} />
    </ReleaseModalProvider>
  );
}
