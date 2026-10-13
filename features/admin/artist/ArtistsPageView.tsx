'use client';
import type { ComponentProps } from 'react';
import { ServerDataTablePaginationClient } from '@/features/data-table/ServerDataTable/ServerDataTablePaginationClient';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';

import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { ArtistModalProvider, ArtistModals, ArtistsTableContent, CreateArtistButton } from '@/features/admin/artist';

export interface ArtistsPageViewProps extends ComponentProps<typeof ArtistsTableContent> {
  title: string;
  searchParams: string;
  createBindings?: ComponentProps<typeof CreateArtistButton>;
  modalBindings?: ComponentProps<typeof ArtistModals>;
}
export function ArtistsPageView({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  title,
  searchParams,
  createBindings,
  modalBindings,
}: ArtistsPageViewProps) {
  return (
    <ArtistModalProvider>
      <DsLayoutStack>
        <AdminPageHeader
          title={title}
          items={[
            {
              key: 'create-artist',
              type: 'custom',
              content: (
                <CreateArtistButton createAction={createBindings?.createAction} onCreated={createBindings?.onCreated} />
              ),
            },
          ]}
        />

        <ServerDataTable namespace="artists" accessibleLabel={title}>
          <ArtistsTableContent
            result={result}
            searchPlaceholder={searchPlaceholder}
            filterFields={filterFields}
            sortFields={sortFields}
          />
          <ServerDataTablePaginationClient
            namespace="artists"
            result={result}
            searchParams={new URLSearchParams(searchParams)}
          />
        </ServerDataTable>
      </DsLayoutStack>

      <ArtistModals
        previewAction={modalBindings?.previewAction}
        deleteAction={modalBindings?.deleteAction}
        onDeleted={modalBindings?.onDeleted}
      />
    </ArtistModalProvider>
  );
}
