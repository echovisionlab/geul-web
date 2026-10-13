'use client';

import { Text as DsText } from '@/components/core/Typography';
import { useTranslations } from 'next-intl';

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
  deleteAction?: typeof deleteGenreAction;
  result: ServerDataTableSelectableSectionProps<GenreRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<GenreRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<GenreRow>['sortFields'];
}

export function GenresTableContent({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  deleteAction = deleteGenreAction,
}: GenresTableContentProps) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tAdmin = useTranslations('adminList');
  const columns = [
    {
      key: 'name',
      header: tCommon('entities.genre'),
      cell: (row: GenreRow) => (
        <div>
          <DsText size="sm" weight="medium">
            {row.name}
          </DsText>
          <DsText size="xs" tone="secondary">
            /{row.slug}
          </DsText>
        </div>
      ),
    },
    {
      key: 'description',
      header: tCommon('labels.description'),
      cell: (row: GenreRow) => (
        <DsText size="sm" tone="secondary" lines={1}>
          {row.description || '-'}
        </DsText>
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
        deleteAction,
        getRowLabel: (row) => row.name || row.slug || row.id,
      }}
    />
  );
}
