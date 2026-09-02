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
import { deleteProgramEventSeriesAction } from '@/lib/actions/program-event';
import type { AdminProgramEventSeriesListItem } from '@/lib/queries/program-event';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';

const STATUS_COLORS: Record<AdminProgramEventSeriesListItem['status'], string> = {
  draft: 'gray',
  published: 'green',
};

interface ProgramEventSeriesTableContentProps {
  result: PaginatedQueryResult<AdminProgramEventSeriesListItem>;
  filterFields: FilterFieldConfig[];
  sortFields: SortFieldConfig[];
  searchPlaceholder: string;
}

function statusLabel(status: AdminProgramEventSeriesListItem['status'], labels: { draft: string; published: string }) {
  switch (status) {
    case 'published':
      return labels.published;
    case 'draft':
    default:
      return labels.draft;
  }
}

export function ProgramEventSeriesTableContent({
  result,
  filterFields,
  sortFields,
  searchPlaceholder,
}: ProgramEventSeriesTableContentProps) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tDataTable = useTranslations('dataTable.aria');
  const tProgramEventAdmin = useTranslations('programEventAdmin');

  const columns: ColumnDef<AdminProgramEventSeriesListItem>[] = [
    {
      key: 'title',
      header: tCommon('labels.title'),
      cell: (row) => (
        <Stack gap={2}>
          <TextButton href={`/event-series/${row.id}?edit=true`} size="sm" weight="medium" appearance="accent">
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
          })}
        </StatusBadge>
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
            href: `/event-series/${row.id}?edit=true`,
          },
          {
            label: tCommon('actions.delete'),
            icon: <IconTrash size={16} />,
            color: 'red',
            onClick: () => deleteProgramEventSeriesAction(row.id),
          },
        ];
        return (
          <TableRowMenu
            aria-label={tDataTable('rowActions', {
              label: row.title || tCommonEntities('programEventSeries').toLowerCase(),
            })}
            items={items}
          />
        );
      },
    },
  ];

  return (
    <ServerDataTableSelectableSection
      namespace="eventSeries"
      result={result}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyMessage={tProgramEventAdmin('series.empty')}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
      bulkDelete={{
        entityLabel: tCommonEntities('programEventSeries'),
        deleteAction: deleteProgramEventSeriesAction,
        getRowLabel: (row) => row.title || row.slug || row.id,
      }}
    />
  );
}
