'use client';

import { useRouter } from 'next/navigation';
import { confirmationDialogs } from '@/features/confirmation';
import { notifications } from '@/components/core/Notification';
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
import { deleteProgramEventAction } from '@/lib/actions/program-event';
import type { AdminProgramEventListItem } from '@/lib/queries/program-event';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';

const STATUS_TONES: Record<AdminProgramEventListItem['status'], StatusTone> = {
  draft: 'neutral',
  published: 'positive',
  archived: 'neutral',
};

interface ProgramEventsTableContentProps {
  result: PaginatedQueryResult<AdminProgramEventListItem>;
  filterFields: FilterFieldConfig[];
  sortFields: SortFieldConfig[];
  searchPlaceholder: string;
  deleteAction?: typeof deleteProgramEventAction;
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
  deleteAction = deleteProgramEventAction,
}: ProgramEventsTableContentProps) {
  const tCommon = useTranslations('common');
  const router = useRouter();
  const tCommonEntities = useTranslations('common.entities');
  const tDataTable = useTranslations('dataTable.aria');
  const tProgramEventAdmin = useTranslations('programEventAdmin');

  const columns: ColumnDef<AdminProgramEventListItem>[] = [
    {
      key: 'title',
      header: tCommon('labels.title'),
      cell: (row) => (
        <DsLayoutStack gap="xxs">
          <TextButton
            href={`/events/${encodeURIComponent(row.id)}?edit=true`}
            size="sm"
            weight="medium"
            appearance="accent"
          >
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
            archived: tCommon('statuses.archived'),
          })}
        </StatusBadge>
      ),
    },
    {
      key: 'startsAt',
      header: tProgramEventAdmin('list.starts'),
      cell: (row) => (
        <DsText size="sm" tone="secondary">
          <DateTime value={row.startsAt} display="dateTime" timeZone={row.timezone} />
        </DsText>
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
            href: `/events/${encodeURIComponent(row.id)}?edit=true`,
          },
          {
            label: tCommon('actions.delete'),
            icon: <IconTrash size={16} />,
            tone: 'danger',
            onClick: () => {
              confirmationDialogs.open({
                intent: 'delete',
                title: tCommon('actions.delete'),
                message: tCommon('messages.deleteNamedItemConfirm', { name: row.title || row.slug || row.id }),
                confirmLabel: tCommon('actions.delete'),
                cancelLabel: tCommon('actions.cancel'),
                closeLabel: tCommon('actions.close'),
                onConfirm: async () => {
                  const result = await deleteAction(row.id);
                  if (result.error) {
                    throw new Error(result.error);
                  }
                  router.refresh();
                },
                onError: (error) =>
                  notifications.show({
                    message: error instanceof Error ? error.message : tCommon('errors.generic'),
                    tone: 'danger',
                  }),
              });
            },
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
        deleteAction,
        getRowLabel: (row) => row.title || row.slug || row.id,
      }}
    />
  );
}
