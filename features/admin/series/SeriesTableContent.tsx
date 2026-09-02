'use client';

import { useTranslations } from 'next-intl';
import { Stack, Text } from '@mantine/core';
import { statusToneFromColor, StatusBadge } from '@/components/core/Badge';
import { TextButton } from '@/components/core/TextButton';
import {
  ServerDataTableSelectableSection,
  type ServerDataTableSelectableSectionProps,
} from '@/features/data-table/ServerDataTable';
import { deleteSeriesAction } from '@/lib/actions/series';
import { DateTime } from '@/features/date-time/DateTime';
import type { ColumnDef } from '@/lib/types/common/data-table';
import { SeriesRowMenu } from './SeriesRowMenu';

const STATUS_COLORS: Record<string, string> = {
  draft: 'yellow',
  published: 'green',
  archived: 'gray',
};

interface SeriesRow {
  id: string;
  title: string;
  slug?: string;
  postCount: number;
  status: string;
  createdAt: Date | undefined;
}

function getColumns(labels: {
  title: string;
  posts: string;
  status: string;
  created: string;
  draft: string;
  published: string;
  archived: string;
}): ColumnDef<SeriesRow>[] {
  return [
    {
      key: 'title',
      header: labels.title,
      cell: (row) => (
        <Stack gap={2}>
          <TextButton href={`/admin/series/${row.id}`} size="sm" weight="medium" appearance="default">
            {row.title}
          </TextButton>
          {row.slug && (
            <Text size="xs" c="dimmed">
              /{row.slug}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: 'postCount',
      header: labels.posts,
      cell: (row) => <Text size="sm">{row.postCount}</Text>,
    },
    {
      key: 'status',
      header: labels.status,
      cell: (row) => (
        <StatusBadge tone={statusToneFromColor(STATUS_COLORS[row.status] || 'blue')} size="sm">
          {row.status === 'published'
            ? labels.published
            : row.status === 'archived'
              ? labels.archived
              : row.status === 'draft'
                ? labels.draft
                : row.status}
        </StatusBadge>
      ),
    },
    {
      key: 'createdAt',
      header: labels.created,
      cell: (row) => (
        <Text size="sm" c="dimmed">
          <DateTime value={row.createdAt} />
        </Text>
      ),
    },
    {
      key: 'actions',
      kind: 'action',
      header: '',
      width: 50,
      cell: (row) => <SeriesRowMenu series={row} />,
    },
  ];
}

interface SeriesTableContentProps {
  result: ServerDataTableSelectableSectionProps<SeriesRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<SeriesRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<SeriesRow>['sortFields'];
}

export function SeriesTableContent({ result, searchPlaceholder, filterFields, sortFields }: SeriesTableContentProps) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tPage = useTranslations('adminList.series');
  const columns = getColumns({
    title: tCommon('labels.title'),
    posts: tCommon('entities.posts'),
    status: tCommon('labels.status'),
    created: tCommon('labels.created'),
    draft: tCommon('statuses.draft'),
    published: tCommon('statuses.published'),
    archived: tCommon('statuses.archived'),
  });

  return (
    <ServerDataTableSelectableSection
      namespace="series"
      result={result}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyMessage={tPage('empty')}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
      bulkDelete={{
        entityLabel: tCommonEntities('series'),
        deleteAction: deleteSeriesAction,
        getRowLabel: (row) => row.title || row.slug || row.id,
      }}
    />
  );
}
