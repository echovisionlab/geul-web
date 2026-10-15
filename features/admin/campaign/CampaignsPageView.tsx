'use client';
import type { ComponentProps } from 'react';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { ServerDataTablePaginationClient } from '@/features/data-table/ServerDataTable/ServerDataTablePaginationClient';
import {
  CampaignModalProvider,
  CampaignModals,
  CampaignsTableContent,
  CreateCampaignButton,
} from '@/features/admin/campaign';
export interface CampaignsPageViewProps extends ComponentProps<typeof CampaignsTableContent> {
  title: string;
  searchParams: string;
  createBindings?: ComponentProps<typeof CreateCampaignButton>;
  modalBindings?: ComponentProps<typeof CampaignModals>;
}
export function CampaignsPageView({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  title,
  searchParams,
  createBindings,
  modalBindings,
}: CampaignsPageViewProps) {
  return (
    <CampaignModalProvider>
      <AdminPageHeader
        title={title}
        items={[
          {
            key: 'create-campaign',
            type: 'custom',
            content: (
              <CreateCampaignButton createAction={createBindings?.createAction} navigate={createBindings?.navigate} />
            ),
          },
        ]}
      />

      <ServerDataTable namespace="campaigns" accessibleLabel={title}>
        <CampaignsTableContent
          result={result}
          searchPlaceholder={searchPlaceholder}
          filterFields={filterFields}
          sortFields={sortFields}
        />
        <ServerDataTablePaginationClient
          namespace="campaigns"
          result={result}
          searchParams={new URLSearchParams(searchParams)}
        />
      </ServerDataTable>

      <CampaignModals deleteAction={modalBindings?.deleteAction} refresh={modalBindings?.refresh} />
    </CampaignModalProvider>
  );
}
