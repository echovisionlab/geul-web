'use client';

import { IconEdit, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Stack, Text } from '@mantine/core';
import { statusToneFromColor, StatusBadge } from '@/components/core/Badge';
import { DateTime } from '@/features/date-time/DateTime';
import { TextButton } from '@/components/core/TextButton';
import {
  ServerDataTableSelectableSection,
  type FilterFieldConfig,
  type SortFieldConfig,
} from '@/features/data-table/ServerDataTable';
import { TableRowMenu, type TableRowMenuItem } from '@/components/core/DataTable';
import { deleteProgramEventAction } from '@/lib/actions/program-event';
import type { AdminProgramEventListItem } from '@/lib/queries/program-event';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';

const STATUS_COLORS: Record<AdminProgramEventListItem['status'], string> = {
  draft: 'gray',
  published: 'green',
  archived: 'orange',
};

interface ProgramEventsTableContentProps {
  result: PaginatedQueryResult<AdminProgramEventListItem>;
  filterFields: FilterFieldConfig[];
  sortFields: SortFieldConfig[];
  searchPlaceholder: string;
}

function statusLabel(
  status: AdminProgramEventListItem['status'],
  labels: { draft: string; published: string; archived: string },
) {
  switch (status) {
    case 'published':
      return labels.published;
    case 'archived':
      return labels.archived;
    case 'draft':
    default:
      return labels.draft;
  }
}

export function ProgramEventsTableContent({
  result,
  filterFields,
  sortFields,
  searchPlaceholder,
}: ProgramEventsTableContentProps) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tDataTable = useTranslations('dataTable.aria');
  const tProgramEventAdmin = useTranslations('programEventAdmin');

  const columns: ColumnDef<AdminProgramEventListItem>[] = [
    {
      key: 'title',
      header: tCommon('labels.title'),
      cell: (row) => (
        <Stack gap={2}>
          <TextButton
            href={`/events/${encodeURIComponent(row.id)}?edit=true`}
            size="sm"
            weight="medium"
            appearance="accent"
          >
            {row.title || tCommon('states.untitled')}
          </TextButton>
          {row.slug ? (
            <Text size="xs" c="dimmed">
              /{row.slug}
            </Text>
          ) : null}
        </Stack>
      ),
    },
    {
      key: 'status',
      header: tCommon('labels.status'),
      cell: (row) => (
        <StatusBadge tone={statusToneFromColor(STATUS_COLORS[row.status])} size="sm">
          {statusLabel(row.status, {
            draft: tCommon('statuses.draft'),
            published: tCommon('statuses.published'),
            archived: tCommon('statuses.archived'),
          })}
        </StatusBadge>
      ),
    },
    {
      key: 'startsAt',
      header: tProgramEventAdmin('list.starts'),
      cell: (row) => (
        <Text size="sm" c="dimmed">
          <DateTime value={row.startsAt} display="dateTime" timeZone={row.timezone} />
        </Text>
      ),
    },
    {
      key: 'updatedAt',
      header: tCommon('labels.updated'),
      cell: (row) => (
        <Text size="sm" c="dimmed">
          <DateTime value={row.updatedAt} />
        </Text>
      ),
    },
    {
      key: 'actions',
      kind: 'action',
      header: '',
      width: 50,
      cell: (row) => {
        const items: TableRowMenuItem[] = [
          {
            label: tCommon('actions.edit'),
            icon: <IconEdit size={16} />,
            href: `/events/${encodeURIComponent(row.id)}?edit=true`,
          },
          {
            label: tCommon('actions.delete'),
            icon: <IconTrash size={16} />,
            color: 'red',
            onClick: () => deleteProgramEventAction(row.id),
          },
        ];
        return (
          <TableRowMenu
            aria-label={tDataTable('rowActions', {
              label: row.title || tCommon('labels.event').toLowerCase(),
            })}
            items={items}
          />
        );
      },
    },
  ];

  return (
    <ServerDataTableSelectableSection
      namespace="events"
      result={result}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyMessage={tProgramEventAdmin('list.empty')}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
      bulkDelete={{
        entityLabel: tCommonEntities('programEvents'),
        deleteAction: deleteProgramEventAction,
        getRowLabel: (row) => row.title || row.slug || row.id,
      }}
    />
  );
}
