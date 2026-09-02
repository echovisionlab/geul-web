'use client';

import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { statusToneFromColor, StatusBadge } from '@/components/core/Badge';
import { DateTime } from '@/features/date-time/DateTime';
import { TextButton } from '@/components/core/TextButton';
import {
  ServerDataTableSelectableSection,
  type ServerDataTableSelectableSectionProps,
} from '@/features/data-table/ServerDataTable';
import { deletePageAdminAction } from '@/lib/actions/page';
import { normalizeEnumToken } from '@/lib/i18n/admin-labels';
import { buildPageEditPath } from '@/lib/utils/page-route';
import type { ColumnDef } from '@/lib/types/common/data-table';
import { PageRowMenu } from './PageRowMenu';

const STATUS_COLORS: Record<string, string> = {
  draft: 'yellow',
  published: 'green',
};

interface PageRow {
  id: string;
  title: string;
  slug: string | null;
  status: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

function getColumns(labels: {
  title: string;
  slug: string;
  status: string;
  created: string;
  updated: string;
  untitled: string;
  draft: string;
  published: string;
}): ColumnDef<PageRow>[] {
  return [
    {
      key: 'title',
      header: labels.title,
      cell: (row) => (
        <TextButton href={buildPageEditPath(row.id)} size="sm" weight="medium" appearance="default">
          {row.title || labels.untitled}
        </TextButton>
      ),
    },
    {
      key: 'slug',
      header: labels.slug,
      cell: (row) => (
        <Text size="sm" c="dimmed">
          {row.slug ? `/${row.slug}` : '-'}
        </Text>
      ),
    },
    {
      key: 'status',
      header: labels.status,
      cell: (row) => (
        <StatusBadge tone={statusToneFromColor(STATUS_COLORS[normalizeEnumToken(row.status)] || 'gray')} size="sm">
          {normalizeEnumToken(row.status) === 'published'
            ? labels.published
            : normalizeEnumToken(row.status) === 'draft'
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
      key: 'updatedAt',
      header: labels.updated,
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
      cell: (row) => <PageRowMenu page={row} />,
    },
  ];
}

interface PagesTableContentProps {
  result: ServerDataTableSelectableSectionProps<PageRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<PageRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<PageRow>['sortFields'];
}

export function PagesTableContent({ result, searchPlaceholder, filterFields, sortFields }: PagesTableContentProps) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tAdmin = useTranslations('adminList');
  const columns = getColumns({
    title: tCommon('labels.title'),
    slug: tCommon('labels.slug'),
    status: tCommon('labels.status'),
    created: tCommon('labels.created'),
    updated: tCommon('labels.updated'),
    untitled: tCommon('states.untitled'),
    draft: tCommon('statuses.draft'),
    published: tCommon('statuses.published'),
  });

  return (
    <ServerDataTableSelectableSection
      namespace="pages"
      result={result}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyMessage={tAdmin('pages.empty')}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
      bulkDelete={{
        entityLabel: tCommonEntities('pages'),
        deleteAction: deletePageAdminAction,
        getRowLabel: (row) => row.title || row.slug || row.id,
      }}
    />
  );
}
