'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useTranslations } from 'next-intl';

import { StatusBadge, type StatusTone } from '@/components/core/Badge';
import { TextButton } from '@/components/core/TextButton';
import {
  ServerDataTableSelectableSection,
  type ServerDataTableSelectableSectionProps,
} from '@/features/data-table/ServerDataTable';
import { deleteSeriesAction } from '@/lib/actions/series';
import { DateTime } from '@/features/date-time/DateTime';
import type { ColumnDef } from '@/lib/types/common/data-table';
import { SeriesRowMenu } from './SeriesRowMenu';

const STATUS_TONES: Record<string, StatusTone> = {
  draft: 'neutral',
  published: 'positive',
  archived: 'neutral',
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
        <DsLayoutStack gap="xxs">
          <TextButton href={`/admin/series/${row.id}`} size="sm" weight="medium" appearance="default">
            {row.title}
          </TextButton>
          {row.slug && (
            <DsText size="xs" tone="secondary">
              /{row.slug}
            </DsText>
          )}
        </DsLayoutStack>
      ),
    },
    {
      key: 'postCount',
      header: labels.posts,
      cell: (row) => <DsText size="sm">{row.postCount}</DsText>,
    },
    {
      key: 'status',
      header: labels.status,
      cell: (row) => (
        <StatusBadge tone={STATUS_TONES[row.status] ?? 'neutral'} size="sm">
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
        <DsText size="sm" tone="secondary">
          <DateTime value={row.createdAt} />
        </DsText>
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
  deleteAction?: typeof deleteSeriesAction;
  result: ServerDataTableSelectableSectionProps<SeriesRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<SeriesRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<SeriesRow>['sortFields'];
}

export function SeriesTableContent({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  deleteAction = deleteSeriesAction,
}: SeriesTableContentProps) {
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
        deleteAction,
        getRowLabel: (row) => row.title || row.slug || row.id,
      }}
    />
  );
}
