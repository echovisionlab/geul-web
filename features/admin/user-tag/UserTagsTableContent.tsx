'use client';

import { Text as DsText } from '@/components/core/Typography';
import { useTranslations } from 'next-intl';

import { LabelBadge } from '@/components/core/Badge';
import {
  ServerDataTableSelectableSection,
  type ServerDataTableSelectableSectionProps,
} from '@/features/data-table/ServerDataTable';
import { deleteUserTagAction } from '@/lib/actions/user-tag';
import { DateTime } from '@/features/date-time/DateTime';
import type { ColumnDef } from '@/lib/types/common/data-table';
import { UserTagRowMenu } from './UserTagRowMenu';

interface UserTagRow {
  id: string;
  name: string;
  user_count: number;
  created_at: Date;
}

function getColumns(labels: { name: string; users: string; created: string }): ColumnDef<UserTagRow>[] {
  return [
    {
      key: 'name',
      header: labels.name,
      cell: (row) => (
        <DsText size="sm" weight="medium">
          {row.name}
        </DsText>
      ),
    },
    {
      key: 'userCount',
      header: labels.users,
      cell: (row) => <LabelBadge size="sm">{row.user_count}</LabelBadge>,
    },
    {
      key: 'createdAt',
      header: labels.created,
      cell: (row) => (
        <DsText size="sm" tone="secondary">
          <DateTime value={row.created_at} />
        </DsText>
      ),
    },
    {
      key: 'actions',
      kind: 'action',
      header: '',
      width: 50,
      cell: (row) => <UserTagRowMenu tag={row} />,
    },
  ];
}

interface UserTagsTableContentProps {
  deleteAction?: typeof deleteUserTagAction;
  result: ServerDataTableSelectableSectionProps<UserTagRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<UserTagRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<UserTagRow>['sortFields'];
}

export function UserTagsTableContent({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  deleteAction = deleteUserTagAction,
}: UserTagsTableContentProps) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tPage = useTranslations('adminList.userTags');
  const columns = getColumns({
    name: tCommon('labels.name'),
    users: tCommon('entities.users'),
    created: tCommon('labels.created'),
  });

  return (
    <ServerDataTableSelectableSection
      namespace="userTags"
      result={result}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyMessage={tPage('empty')}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
      bulkDelete={{
        entityLabel: tCommonEntities('userTags'),
        deleteAction,
        getRowLabel: (row) => row.name || row.id,
      }}
    />
  );
}
