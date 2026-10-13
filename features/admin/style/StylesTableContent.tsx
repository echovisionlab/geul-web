'use client';

import { Text as DsText } from '@/components/core/Typography';
import { useTranslations } from 'next-intl';

import { LabelBadge } from '@/components/core/Badge';
import {
  ServerDataTableSelectableSection,
  type ServerDataTableSelectableSectionProps,
} from '@/features/data-table/ServerDataTable';
import { deleteStyleAction } from '@/lib/actions/style';
import { DateTime } from '@/features/date-time/DateTime';
import type { ColumnDef } from '@/lib/types/common/data-table';
import { StyleRowMenu } from './StyleRowMenu';

interface StyleRow {
  id: string;
  name: string;
  slug: string;
  description?: string;
  releaseCount: number;
  createdAt?: Date;
}

interface StylesTableContentProps {
  deleteAction?: typeof deleteStyleAction;
  result: ServerDataTableSelectableSectionProps<StyleRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<StyleRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<StyleRow>['sortFields'];
}

export function StylesTableContent({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  deleteAction = deleteStyleAction,
}: StylesTableContentProps) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tAdmin = useTranslations('adminList');
  const columns = [
    {
      key: 'name',
      header: tCommon('entities.style'),
      cell: (row: StyleRow) => (
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
      cell: (row: StyleRow) => (
        <DsText size="sm" tone="secondary" lines={1}>
          {row.description || '-'}
        </DsText>
      ),
    },
    {
      key: 'releaseCount',
      header: tCommon('entities.releases'),
      cell: (row: StyleRow) => <LabelBadge size="sm">{row.releaseCount}</LabelBadge>,
    },
    {
      key: 'createdAt',
      header: tCommon('labels.created'),
      cell: (row: StyleRow) => (
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
      cell: (row: StyleRow) => <StyleRowMenu style={row} />,
    },
  ] satisfies ColumnDef<StyleRow>[];

  return (
    <ServerDataTableSelectableSection
      namespace="styles"
      result={result}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyMessage={tAdmin('styles.empty')}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
      bulkDelete={{
        entityLabel: tCommonEntities('styles'),
        deleteAction,
        getRowLabel: (row) => row.name || row.slug || row.id,
      }}
    />
  );
}
