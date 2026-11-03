'use client';
import type { ComponentProps } from 'react';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { ServerDataTable } from '@/features/data-table/ServerDataTable';
import { ServerDataTablePaginationClient } from '@/features/data-table/ServerDataTable/ServerDataTablePaginationClient';
import { MemberCriteriaTableContent } from './MemberCriteriaTableContent';
import { MemberCriteriaModals } from './MemberCriteriaModals';
import { CriteriaModalProvider } from './MemberCriteriaModalContext';
import { MemberCriteriaArchiveFilter } from './MemberCriteriaArchiveFilter';
import { CreateMemberCriteriaButton } from './CreateMemberCriteriaButton';
interface Props extends ComponentProps<typeof MemberCriteriaTableContent> {
  title: string;
  searchParams: string;
  modalBindings?: ComponentProps<typeof MemberCriteriaModals>;
  description: string;
}
export function MemberCriteriaPageView({
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
    <CriteriaModalProvider>
      <AdminPageHeader
        title={title}
        description={description}
        items={[
          {
            key: 'include-archived',
            type: 'custom',
            content: <MemberCriteriaArchiveFilter />,
          },
          { key: 'create-criteria', type: 'custom', content: <CreateMemberCriteriaButton /> },
        ]}
      />

      <ServerDataTable namespace="memberCriteria" accessibleLabel={title}>
        <MemberCriteriaTableContent
          result={result}
          searchPlaceholder={searchPlaceholder}
          filterFields={filterFields}
          sortFields={sortFields}
        />
        <ServerDataTablePaginationClient
          namespace="memberCriteria"
          result={result}
          searchParams={new URLSearchParams(searchParams)}
        />
      </ServerDataTable>

      <MemberCriteriaModals bindings={modalBindings?.bindings} refresh={modalBindings?.refresh} />
    </CriteriaModalProvider>
  );
}
