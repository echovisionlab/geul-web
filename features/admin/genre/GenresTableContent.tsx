'use client';

import { useTranslations } from 'next-intl';
import { Text } from '@mantine/core';
import { LabelBadge } from '@/components/core/Badge';
import {
  ServerDataTableSelectableSection,
  type ServerDataTableSelectableSectionProps,
} from '@/features/data-table/ServerDataTable';
import { deleteGenreAction } from '@/lib/actions/genre';
import { DateTime } from '@/features/date-time/DateTime';
import type { ColumnDef } from '@/lib/types/common/data-table';
import { GenreRowMenu } from './GenreRowMenu';

interface GenreRow {
  id: string;
  name: string;
  slug: string;
  description: string | undefined;
  releaseCount: number;
  createdAt: Date | undefined;
}

interface GenresTableContentProps {
  result: ServerDataTableSelectableSectionProps<GenreRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<GenreRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<GenreRow>['sortFields'];
}

export function GenresTableContent({ result, searchPlaceholder, filterFields, sortFields }: GenresTableContentProps) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tAdmin = useTranslations('adminList');
  const columns = [
    {
      key: 'name',
      header: tCommon('entities.genre'),
      cell: (row: GenreRow) => (
        <div>
          <Text size="sm" fw={500}>
            {row.name}
          </Text>
          <Text size="xs" c="dimmed">
            /{row.slug}
          </Text>
        </div>
      ),
    },
    {
      key: 'description',
      header: tCommon('labels.description'),
      cell: (row: GenreRow) => (
        <Text size="sm" c="dimmed" lineClamp={1}>
          {row.description || '-'}
        </Text>
      ),
    },
    {
      key: 'releaseCount',
      header: tCommon('entities.releases'),
      cell: (row: GenreRow) => <LabelBadge size="sm">{row.releaseCount}</LabelBadge>,
    },
    {
      key: 'createdAt',
      header: tCommon('labels.created'),
      cell: (row: GenreRow) => (
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
      cell: (row: GenreRow) => <GenreRowMenu genre={row} />,
    },
  ] satisfies ColumnDef<GenreRow>[];

  return (
    <ServerDataTableSelectableSection
      namespace="genres"
      result={result}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyMessage={tAdmin('genres.empty')}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
      bulkDelete={{
        entityLabel: tCommonEntities('genres'),
        deleteAction: deleteGenreAction,
        getRowLabel: (row) => row.name || row.slug || row.id,
      }}
    />
  );
}
