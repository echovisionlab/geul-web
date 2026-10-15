'use client';
import type { ComponentProps } from 'react';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { ServerDataTablePaginationClient } from '@/features/data-table/ServerDataTable/ServerDataTablePaginationClient';
import { SegmentsTableContent } from './SegmentsTableContent';
import { SegmentModals } from './SegmentModals';
import { SegmentModalProvider } from './SegmentModalContext';
import { AudienceArchiveFilter } from './AudienceArchiveFilter';
import { CreateSegmentButton } from './CreateSegmentButton';
interface Props extends ComponentProps<typeof SegmentsTableContent> {
  title: string;
  searchParams: string;
  modalBindings?: ComponentProps<typeof SegmentModals>;
  description: string;
}
export function SegmentsPageView({
  result,
  filterFields,
  sortFields,
  searchPlaceholder,
  title,
  searchParams,
  modalBindings,
  description,
}: Props) {
  return (
    <SegmentModalProvider>
      <AdminPageHeader
        title={title}
        description={description}
        items={[
          {
            key: 'include-archived',
            type: 'custom',
            content: <AudienceArchiveFilter />,
          },
          { key: 'create-segment', type: 'custom', content: <CreateSegmentButton /> },
        ]}
      />

      <ServerDataTable namespace="segments" accessibleLabel={title}>
        <SegmentsTableContent
          result={result}
          searchPlaceholder={searchPlaceholder}
          filterFields={filterFields}
          sortFields={sortFields}
        />
        <ServerDataTablePaginationClient
          namespace="segments"
          result={result}
          searchParams={new URLSearchParams(searchParams)}
        />
      </ServerDataTable>

      <SegmentModals bindings={modalBindings?.bindings} refresh={modalBindings?.refresh} />
    </SegmentModalProvider>
  );
}
