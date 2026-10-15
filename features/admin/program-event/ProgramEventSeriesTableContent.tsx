'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { StatusBadge, type StatusTone } from '@/components/core/Badge';
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

const STATUS_TONES: Record<AdminProgramEventSeriesListItem['status'], StatusTone> = {
  draft: 'neutral',
  published: 'positive',
};

interface ProgramEventSeriesTableContentProps {
  result: PaginatedQueryResult<AdminProgramEventSeriesListItem>;
  filterFields: FilterFieldConfig[];
  sortFields: SortFieldConfig[];
  searchPlaceholder: string;
  deleteAction?: typeof deleteProgramEventSeriesAction;
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
  deleteAction = deleteProgramEventSeriesAction,
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
        <DsLayoutStack gap="xxs">
          <TextButton href={`/event-series/${row.id}?edit=true`} size="sm" weight="medium" appearance="accent">
            {row.title || tCommon('states.untitled')}
          </TextButton>
          {row.slug ? (
            <DsText size="xs" tone="secondary">
              /{row.slug}
            </DsText>
          ) : null}
        </DsLayoutStack>
      ),
    },
    {
      key: 'status',
      header: tCommon('labels.status'),
      cell: (row) => (
        <StatusBadge tone={STATUS_TONES[row.status] ?? 'neutral'} size="sm">
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
        <DsText size="sm" tone="secondary">
          <DateTime value={row.updatedAt} />
        </DsText>
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
            tone: 'danger',
            onClick: () => deleteAction(row.id),
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
        deleteAction,
        getRowLabel: (row) => row.title || row.slug || row.id,
      }}
    />
  );
}
